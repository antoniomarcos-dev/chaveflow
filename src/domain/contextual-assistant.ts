import {
  AREA_LABELS,
  AuditEvent,
  AuthenticatedContext,
  Deal,
  DealDocument,
  ProcedureVersion,
  TaskInstance,
  Vehicle,
} from "./types";
import {
  computeDealEligibilityAndSummary,
  computeUserNextAction,
} from "./workflow-engine";
import { assertOrganizationAccess } from "./permissions";

export interface AssistantCitation {
  procedureCode: string;
  procedureTitle: string;
  versionNumber: number;
  sectionNumber: string;
  sectionHeading: string;
}

export interface AssistantResponse {
  mode: "DETERMINISTIC_CONSULTATION_ASSISTANT";
  modeLabel: string;
  question: string;
  answerMarkdown: string;
  citations: AssistantCitation[];
  suggestedFollowUps: string[];
  disclaimer: string;
}

export function answerContextualQuestion(params: {
  ctx: AuthenticatedContext;
  question: string;
  deal: Deal;
  vehicle: Vehicle;
  tasks: TaskInstance[];
  documents: DealDocument[];
  publishedProcedures: ProcedureVersion[];
  recentEvents: AuditEvent[];
  hasActiveReleaseAuthorization: boolean;
}): AssistantResponse {
  const {
    ctx,
    question,
    deal,
    vehicle,
    tasks,
    documents,
    publishedProcedures,
    recentEvents,
    hasActiveReleaseAuthorization,
  } = params;

  // 1. Garantir isolamento estrito por organização
  assertOrganizationAccess(ctx, deal.organizationId);

  // 2. Garantir que somente procedimentos PUBLICADOS da mesma organização sejam consultados
  const safeProcedures = publishedProcedures.filter(
    (p) =>
      p.organizationId === deal.organizationId && p.status === "PUBLISHED"
  );

  const normalized = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const summary = computeDealEligibilityAndSummary(
    deal,
    tasks,
    documents,
    hasActiveReleaseAuthorization
  );
  const nextAction = computeUserNextAction(
    ctx,
    deal,
    tasks,
    documents,
    summary
  );

  const citations: AssistantCitation[] = [];
  const addProcedureCitation = (codeOrArea: string) => {
    for (const proc of safeProcedures) {
      if (
        proc.title.toLowerCase().includes(codeOrArea.toLowerCase()) ||
        proc.responsibleArea.toLowerCase() === codeOrArea.toLowerCase()
      ) {
        const firstSection = proc.sections[0];
        const exists = citations.some(
          (c) =>
            c.procedureTitle === proc.title &&
            c.versionNumber === proc.versionNumber
        );
        if (!exists && firstSection) {
          citations.push({
            procedureCode: proc.procedureId,
            procedureTitle: proc.title,
            versionNumber: proc.versionNumber,
            sectionNumber: firstSection.sectionNumber,
            sectionHeading: firstSection.heading,
          });
        }
      }
    }
  };

  const baseDisclaimer =
    "Assistente de Consulta Determinístico (Sem provedor de IA externo). As respostas utilizam exclusivamente os registros autorizados desta negociação e os procedimentos publicados pela organização. Este assistente não aprova etapas nem executa alterações no sistema.";

  // Proteção contra tentativas de executar ações ou aprovar pelo chat
  if (
    normalized.includes("aprove ") ||
    normalized.includes("aprovar agora") ||
    normalized.includes("libere o carro") ||
    normalized.includes("ignore a regra") ||
    normalized.includes("dispense")
  ) {
    return {
      mode: "DETERMINISTIC_CONSULTATION_ASSISTANT",
      modeLabel: "Assistente de Consulta (Determinístico)",
      question,
      answerMarkdown:
        "**Limitação de Segurança e Governança:** O assistente contextual é exclusivo para consulta e orientação operacional. Ele **não realiza aprovações, não dispensa requisitos obrigatórios e não altera dados de negócio**.\n\nPara aprovar ou avançar uma etapa, utilize os botões de ação na aba **Tarefas**, **Documentos** ou **Aprovações**, conforme as permissões da sua função.",
      citations: [],
      suggestedFollowUps: [
        "O que falta para entregar este carro?",
        "Quem precisa agir agora?",
        "O que posso adiantar?",
      ],
      disclaimer: baseDisclaimer,
    };
  }

  // Pergunta 1: O que falta para entregar este carro? / O que impede a entrega ou faturamento?
  if (
    normalized.includes("falta para entregar") ||
    normalized.includes("impede") ||
    normalized.includes("bloqueio") ||
    normalized.includes("faturar") ||
    normalized.includes("faturamento")
  ) {
    addProcedureCitation("RELEASE");
    addProcedureCitation("BILLING");

    if (summary.delivered) {
      return {
        mode: "DETERMINISTIC_CONSULTATION_ASSISTANT",
        modeLabel: "Assistente de Consulta (Determinístico)",
        question,
        answerMarkdown: `O veículo **${vehicle.brand} ${vehicle.model} (${vehicle.internalCode})** já teve sua **entrega física concluída** na negociação **${deal.dealNumber}**. Não há pendências impeditivas.`,
        citations,
        suggestedFollowUps: ["Qual foi a última atualização?"],
        disclaimer: baseDisclaimer,
      };
    }

    const lines: string[] = [];
    lines.push(
      `### Situação de Elegibilidade — ${deal.dealNumber} (${vehicle.brand} ${vehicle.model})`
    );
    lines.push(
      `- **Elegível para Faturamento:** ${
        summary.billingEligible ? "Sim (Sem bloqueios)" : `Não (${summary.billingBlockers.length} pendência(s))`
      }`
    );
    lines.push(
      `- **Nota Fiscal Registrada:** ${
        summary.billingRegistered ? `Sim (NF ${deal.invoiceNumber})` : "Ainda não registrada"
      }`
    );
    lines.push(
      `- **Elegível para Autorização de Entrega:** ${
        summary.deliveryEligible
          ? "Sim (Todos os requisitos técnicos cumpridos)"
          : `Não (${summary.deliveryBlockers.length} requisito(s) impeditivo(s))`
      }`
    );
    lines.push(
      `- **Autorização Formal de Entrega:** ${
        summary.deliveryAuthorized ? "Emitida e ativa" : "Pendente de emissão pelo Responsável pela Liberação"
      }\n`
    );

    if (summary.deliveryBlockers.length > 0) {
      lines.push("#### Requisitos que impedem a entrega neste momento:");
      for (const b of summary.deliveryBlockers) {
        lines.push(
          `1. **${b.title}** *(Área: ${b.responsibleAreaLabel})* — ${b.reason} **Próximo passo:** ${b.actionRequired}`
        );
      }
    } else if (!summary.deliveryAuthorized) {
      lines.push(
        "Todos os pré-requisitos operacionais, documentais e financeiros foram concluídos. Falta apenas a **Emissão da Autorização Formal de Entrega** pelo perfil *Responsável pela Liberação* ou *Gestor*."
      );
    } else {
      lines.push(
        "A entrega já está formalmente autorizada. Falta apenas a **Reconfirmação física do chassi/QR Code e registro de entrega das chaves** pela área de *Operação*."
      );
    }

    return {
      mode: "DETERMINISTIC_CONSULTATION_ASSISTANT",
      modeLabel: "Assistente de Consulta (Determinístico)",
      question,
      answerMarkdown: lines.join("\n"),
      citations,
      suggestedFollowUps: [
        "Quem precisa agir agora?",
        "O que posso adiantar?",
        "Por que este documento foi solicitado?",
      ],
      disclaimer: baseDisclaimer,
    };
  }

  // Pergunta 2: Quem precisa agir agora?
  if (
    normalized.includes("quem precisa agir") ||
    normalized.includes("responsavel") ||
    normalized.includes("proxima acao")
  ) {
    const lines: string[] = [];
    lines.push(
      `### Responsáveis pelas Ações Atuais (${deal.dealNumber})`
    );
    lines.push(
      `- **Sua próxima ação recomendada (${ctx.profile.fullName}):** **${nextAction.headline}** — ${nextAction.description}`
    );

    if (summary.parallelTasks.length > 0) {
      lines.push("\n#### Fila ativa por área neste momento:");
      for (const t of summary.parallelTasks) {
        lines.push(
          `- **${AREA_LABELS[t.responsibleArea]}** → *${t.title}*: ${
            t.pendingReason ?? "Disponível para execução"
          }`
        );
      }
    }

    return {
      mode: "DETERMINISTIC_CONSULTATION_ASSISTANT",
      modeLabel: "Assistente de Consulta (Determinístico)",
      question,
      answerMarkdown: lines.join("\n"),
      citations,
      suggestedFollowUps: [
        "O que falta para entregar este carro?",
        "O que posso adiantar?",
      ],
      disclaimer: baseDisclaimer,
    };
  }

  // Pergunta 3: Por que este documento foi solicitado? / Documentos
  if (
    normalized.includes("documento") ||
    normalized.includes("por que") ||
    normalized.includes("procuracao") ||
    normalized.includes("troca")
  ) {
    addProcedureCitation("DOCUMENTATION");
    addProcedureCitation("FINANCE");

    const lines: string[] = [];
    lines.push(
      `### Justificativa de Documentos Exigidos na Negociação ${deal.dealNumber}`
    );
    lines.push(
      `Condições configuradas nesta negociação: Comprador **${deal.buyerType}**, Pagamento **${deal.paymentMethod}**, Financiamento: **${
        deal.hasFinancing ? "Sim" : "Não"
      }**, Usado na troca: **${deal.hasTradeIn ? "Sim" : "Não"}**, Procuração: **${
        deal.hasPowerOfAttorney ? "Sim" : "Não"
      }**.\n`
    );

    for (const doc of documents) {
      lines.push(
        `- **${doc.title}** *(Status: ${doc.status}, Área: ${
          AREA_LABELS[doc.responsibleArea]
        })*: Exigido porque **${doc.whyRequired}** ${
          doc.blocksBilling
            ? "[Bloqueia Faturamento e Entrega]"
            : doc.blocksDelivery
            ? "[Bloqueia Entrega]"
            : ""
        }`
      );
    }

    const waivedTasks = tasks.filter((t) => t.state === "WAIVED_BY_RULE");
    if (waivedTasks.length > 0) {
      lines.push("\n#### Etapas dispensadas automaticamente por regra:");
      for (const wt of waivedTasks) {
        lines.push(`- *${wt.title}*: ${wt.waivedRuleDescription}`);
      }
    }

    return {
      mode: "DETERMINISTIC_CONSULTATION_ASSISTANT",
      modeLabel: "Assistente de Consulta (Determinístico)",
      question,
      answerMarkdown: lines.join("\n"),
      citations,
      suggestedFollowUps: [
        "O que falta para entregar este carro?",
        "Quem precisa agir agora?",
      ],
      disclaimer: baseDisclaimer,
    };
  }

  // Pergunta 4: O que posso adiantar? / Paralelo
  if (
    normalized.includes("adiantar") ||
    normalized.includes("paralelo") ||
    normalized.includes("simultaneo")
  ) {
    addProcedureCitation("OPERATIONS");
    const lines: string[] = [];
    lines.push(
      `### Tarefas que podem avançar em paralelo (${deal.dealNumber})`
    );
    if (summary.parallelTasks.length === 0) {
      lines.push(
        "Não há tarefas abertas para adiantamento em paralelo neste momento."
      );
    } else {
      lines.push(
        "O motor de processos permite executar simultaneamente qualquer tarefa cujos pré-requisitos já foram cumpridos:"
      );
      for (const t of summary.parallelTasks) {
        lines.push(
          `- **${t.title}** *(Área: ${AREA_LABELS[t.responsibleArea]})* — Estado: **${t.state}**. Orientação: ${t.guidance}`
        );
      }
    }

    return {
      mode: "DETERMINISTIC_CONSULTATION_ASSISTANT",
      modeLabel: "Assistente de Consulta (Determinístico)",
      question,
      answerMarkdown: lines.join("\n"),
      citations,
      suggestedFollowUps: [
        "O que falta para entregar este carro?",
        "Qual foi a última atualização?",
      ],
      disclaimer: baseDisclaimer,
    };
  }

  // Pergunta 5: Qual foi a última atualização? / Histórico
  if (
    normalized.includes("ultima atualizacao") ||
    normalized.includes("historico") ||
    normalized.includes("aconteceu")
  ) {
    const latest = recentEvents.slice(0, 5);
    const lines: string[] = [];
    lines.push(
      `### Últimas Atualizações Registradas (${deal.dealNumber})`
    );
    if (latest.length === 0) {
      lines.push("Nenhum evento de auditoria registrado até o momento.");
    } else {
      for (const ev of latest) {
        const formattedDate = new Date(ev.createdAt).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        });
        lines.push(
          `- **${formattedDate}** — *${ev.actorName} (${ev.actorRole})*: ${ev.summary}`
        );
      }
    }

    return {
      mode: "DETERMINISTIC_CONSULTATION_ASSISTANT",
      modeLabel: "Assistente de Consulta (Determinístico)",
      question,
      answerMarkdown: lines.join("\n"),
      citations,
      suggestedFollowUps: [
        "O que falta para entregar este carro?",
        "Quem precisa agir agora?",
      ],
      disclaimer: baseDisclaimer,
    };
  }

  // Resposta padrão estruturada com diagnóstico completo e indicação de área responsável
  for (const proc of safeProcedures) {
    const firstSec = proc.sections[0];
    if (firstSec) {
      citations.push({
        procedureCode: proc.procedureId,
        procedureTitle: proc.title,
        versionNumber: proc.versionNumber,
        sectionNumber: firstSec.sectionNumber,
        sectionHeading: firstSec.heading,
      });
    }
  }

  return {
    mode: "DETERMINISTIC_CONSULTATION_ASSISTANT",
    modeLabel: "Assistente de Consulta (Determinístico)",
    question,
    answerMarkdown: [
      `### Resumo Operacional da Negociação ${deal.dealNumber}`,
      `- **Veículo:** ${vehicle.brand} ${vehicle.model} ${vehicle.trim} (${vehicle.internalCode} / Chassi final ${vehicle.vin.slice(-6)})`,
      `- **Progresso de Tarefas Aplicáveis:** ${summary.completedApplicableTasksCount} de ${summary.applicableTasksCount} concluídas (${summary.progressPercentage}%) — *Nota: o percentual não substitui a autorização formal de entrega.*`,
      `- **Sua próxima ação:** **${nextAction.headline}** (${nextAction.description})`,
      `- **Bloqueios para Faturamento:** ${summary.billingBlockers.length}`,
      `- **Bloqueios para Entrega:** ${summary.deliveryBlockers.length}`,
      `\nCaso sua dúvida envolva uma exceção comercial ou jurídica não prevista nos procedimentos publicados abaixo, consulte diretamente a área **${nextAction.responsibleAreaLabel}** ou a **Gestão da Unidade**.`,
    ].join("\n"),
    citations: citations.slice(0, 3),
    suggestedFollowUps: [
      "O que falta para entregar este carro?",
      "Quem precisa agir agora?",
      "Por que este documento foi solicitado?",
      "O que posso adiantar?",
      "Qual foi a última atualização?",
    ],
    disclaimer: baseDisclaimer,
  };
}
