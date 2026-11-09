import {
  ApplicabilityCondition,
  AREA_LABELS,
  AuthenticatedContext,
  Deal,
  DealConditionContext,
  DealDocument,
  DocumentRequirement,
  ResponsibleArea,
  ROLE_LABELS,
  TaskInstance,
  TaskTemplate,
  WORKFLOW_STAGES,
  WorkflowStageCode,
} from "./types";
import { canActOnArea, canApproveTaskRole, hasPermission } from "./permissions";

// ============================================================================
// 1. AVALIADOR SEGURO E RESTRITO DE CONDIÇÕES (SEM EVAL)
// ============================================================================

export interface ConditionEvaluationResult {
  applicable: boolean;
  waivedReason: string | null;
}

export function evaluateSingleCondition(
  condition: ApplicabilityCondition,
  context: DealConditionContext
): boolean {
  const actualValue = context[condition.field];

  switch (condition.operator) {
    case "IS_TRUE":
      return actualValue === true;
    case "IS_FALSE":
      return actualValue === false;
    case "EQUALS":
      return actualValue === condition.value;
    case "NOT_EQUALS":
      return actualValue !== condition.value;
    case "IN":
      if (Array.isArray(condition.value)) {
        return condition.value.includes(String(actualValue));
      }
      return false;
    default:
      return false;
  }
}

export function evaluateApplicabilityConditions(
  conditions: ApplicabilityCondition[],
  context: DealConditionContext
): ConditionEvaluationResult {
  if (!conditions || conditions.length === 0) {
    return { applicable: true, waivedReason: null };
  }

  for (const cond of conditions) {
    const passed = evaluateSingleCondition(cond, context);
    if (!passed) {
      return {
        applicable: false,
        waivedReason: `Dispensada automaticamente por regra da versão do processo: ${cond.humanExplanation} (campo '${cond.field}' = '${String(
          context[cond.field]
        )}').`,
      };
    }
  }

  return { applicable: true, waivedReason: null };
}

// ============================================================================
// 2. VALIDAÇÃO DE GRAFO ACÍCLICO DIRIGIDO (DAG) — IMPEDE CICLOS
// ============================================================================

export interface DAGValidationResult {
  valid: boolean;
  cyclePath: string[] | null;
  missingDependencies: Array<{ taskCode: string; missingCode: string }>;
}

export function validateWorkflowDAG(
  tasks: Array<{ code: string; dependsOnTaskCodes: string[] }>
): DAGValidationResult {
  const taskMap = new Map<string, string[]>();
  for (const t of tasks) {
    taskMap.set(t.code, t.dependsOnTaskCodes ?? []);
  }

  const missingDependencies: Array<{ taskCode: string; missingCode: string }> = [];
  for (const t of tasks) {
    for (const dep of t.dependsOnTaskCodes ?? []) {
      if (!taskMap.has(dep)) {
        missingDependencies.push({ taskCode: t.code, missingCode: dep });
      }
    }
  }

  if (missingDependencies.length > 0) {
    return {
      valid: false,
      cyclePath: null,
      missingDependencies,
    };
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const pathStack: string[] = [];

  function dfs(node: string): string[] | null {
    visiting.add(node);
    pathStack.push(node);

    const neighbors = taskMap.get(node) ?? [];
    for (const dep of neighbors) {
      if (visiting.has(dep)) {
        const cycleStartIndex = pathStack.indexOf(dep);
        return [...pathStack.slice(cycleStartIndex), dep];
      }
      if (!visited.has(dep)) {
        const cycle = dfs(dep);
        if (cycle) return cycle;
      }
    }

    visiting.delete(node);
    pathStack.pop();
    visited.add(node);
    return null;
  }

  for (const t of tasks) {
    if (!visited.has(t.code)) {
      const cycle = dfs(t.code);
      if (cycle) {
        return {
          valid: false,
          cyclePath: cycle,
          missingDependencies: [],
        };
      }
    }
  }

  return {
    valid: true,
    cyclePath: null,
    missingDependencies: [],
  };
}

// ============================================================================
// 3. RESOLUÇÃO DE DEPENDÊNCIAS E CÁLCULO DE ESTADOS DAS TAREFAS
// ============================================================================

export function isTaskSatisfiedAsDependency(task: TaskInstance): boolean {
  if (task.state === "WAIVED_BY_RULE") return true;
  if (task.state === "COMPLETED") {
    if (task.requiresFormalApproval && task.approvalStatus !== "APPROVED") {
      return false;
    }
    return true;
  }
  return false;
}

export function recalculateTaskStates(
  tasks: TaskInstance[],
  documents: DealDocument[]
): TaskInstance[] {
  const byCode = new Map<string, TaskInstance>();
  const cloned = tasks.map((t) => ({ ...t }));
  for (const t of cloned) {
    byCode.set(t.code, t);
  }

  // Passadas iterativas para propagar desbloqueios em cadeia
  for (let pass = 0; pass < cloned.length + 1; pass++) {
    for (const task of cloned) {
      if (task.state === "WAIVED_BY_RULE" || task.state === "CANCELLED") {
        continue;
      }

      const unmetDeps: string[] = [];
      for (const depCode of task.dependsOnTaskCodes) {
        const depTask = byCode.get(depCode);
        if (depTask && !isTaskSatisfiedAsDependency(depTask)) {
          unmetDeps.push(depTask.title);
        }
      }

      const linkedDocs = documents.filter((d) => d.taskCode === task.code);
      const missingDocs = linkedDocs.filter(
        (d) => d.status === "REQUESTED" || d.status === "REJECTED" || d.status === "CORRECTION_REQUESTED"
      );
      const pendingReviewDocs = linkedDocs.filter(
        (d) => d.status === "UPLOADED_PENDING_REVIEW" || d.status === "OUTDATED"
      );

      if (unmetDeps.length > 0) {
        if (task.state === "AVAILABLE") {
          task.state = "WAITING_PREREQUISITE";
        }
        task.pendingReason = `Aguardando conclusão de pré-requisito(s): ${unmetDeps.join(", ")}.`;
      } else {
        // Todas as dependências satisfeitas!
        if (task.state === "WAITING_PREREQUISITE") {
          task.state = "AVAILABLE";
        }

        if (task.state === "COMPLETED") {
          if (task.requiresFormalApproval && task.approvalStatus !== "APPROVED") {
            task.state = "IN_REVIEW";
            task.pendingReason = `Aguardando aprovação formal de ${
              task.approvalRole ? ROLE_LABELS[task.approvalRole] : AREA_LABELS[task.responsibleArea]
            }.`;
          } else {
            task.pendingReason = null;
          }
        } else if (missingDocs.length > 0) {
          task.pendingReason = `Documento(s) pendente(s) de envio ou correção: ${missingDocs
            .map((d) => d.title)
            .join(", ")}.`;
        } else if (pendingReviewDocs.length > 0) {
          task.pendingReason = `Documento(s) enviado(s) aguardando conferência da área ${
            AREA_LABELS[task.responsibleArea]
          }: ${pendingReviewDocs.map((d) => d.title).join(", ")}.`;
        } else if (task.requiresFormalApproval && task.approvalStatus === "OUTDATED") {
          task.pendingReason =
            "Aprovação anterior foi invalidada por alteração de documento ou requisito. Requer nova conferência.";
        } else if (task.requiresFormalApproval && task.approvalStatus === "REJECTED") {
          task.pendingReason = "Rejeitada ou com solicitação de correção na última revisão.";
        } else if (task.state === "AVAILABLE") {
          task.pendingReason = `Disponível para execução pela área ${AREA_LABELS[task.responsibleArea]}.`;
        } else if (task.state === "IN_PROGRESS") {
          task.pendingReason = `Em andamento pela área ${AREA_LABELS[task.responsibleArea]}.`;
        } else if (task.state === "IN_REVIEW") {
          task.pendingReason = `Aguardando revisão/aprovação formal da área ${AREA_LABELS[task.responsibleArea]}.`;
        }
      }
    }
  }

  return cloned;
}

// ============================================================================
// 4. CÁLCULO DE BLOQUEIOS, ELEGIBILIDADE, PILARES E PRÓXIMA AÇÃO
// ============================================================================

export interface DealBlocker {
  id: string;
  scope: "BILLING" | "DELIVERY";
  sourceType: "TASK" | "DOCUMENT" | "INVOICE" | "AUTHORIZATION";
  code: string;
  title: string;
  reason: string;
  responsibleArea: ResponsibleArea;
  responsibleAreaLabel: string;
  actionRequired: string;
}

export interface PillarIndicator {
  area: "FINANCIAL" | "DOCUMENTATION" | "OPERATIONAL";
  label: string;
  status: "OK" | "PENDING" | "BLOCKED" | "NOT_APPLICABLE";
  summary: string;
  completedCount: number;
  totalApplicableCount: number;
}

export interface DealEligibilitySummary {
  applicableTasksCount: number;
  completedApplicableTasksCount: number;
  waivedTasksCount: number;
  progressPercentage: number;
  currentStage: WorkflowStageCode;
  billingEligible: boolean;
  billingRegistered: boolean;
  billingBlockers: DealBlocker[];
  deliveryEligible: boolean;
  deliveryAuthorized: boolean;
  delivered: boolean;
  deliveryBlockers: DealBlocker[];
  pillars: {
    financial: PillarIndicator;
    documentation: PillarIndicator;
    operational: PillarIndicator;
  };
  parallelTasks: TaskInstance[];
}

export function computeDealEligibilityAndSummary(
  deal: Deal,
  tasks: TaskInstance[],
  documents: DealDocument[],
  hasActiveReleaseAuthorization: boolean
): DealEligibilitySummary {
  const applicableTasks = tasks.filter(
    (t) => t.state !== "WAIVED_BY_RULE" && t.state !== "CANCELLED"
  );
  const waivedTasks = tasks.filter((t) => t.state === "WAIVED_BY_RULE");
  const completedTasks = applicableTasks.filter((t) =>
    isTaskSatisfiedAsDependency(t)
  );

  const progressPercentage =
    applicableTasks.length > 0
      ? Math.round((completedTasks.length / applicableTasks.length) * 100)
      : 0;

  const billingBlockers: DealBlocker[] = [];
  const deliveryBlockers: DealBlocker[] = [];

  for (const task of applicableTasks) {
    // A tarefa final de entrega física não bloqueia a elegibilidade para autorização
    if (task.code === "TASK_CONFIRM_DELIVERY") continue;
    // A tarefa de emissão de autorização é o próprio ato de autorizar
    if (task.code === "TASK_RELEASE_AUTH") continue;

    const isDone = isTaskSatisfiedAsDependency(task);
    if (!isDone) {
      const reason =
        task.pendingReason ??
        `Tarefa '${task.title}' está com status '${task.state}'.`;
      const actionRequired = task.requiresFormalApproval
        ? `Realizar conferência e registrar aprovação formal (${
            task.approvalRole ? ROLE_LABELS[task.approvalRole] : AREA_LABELS[task.responsibleArea]
          }).`
        : `Concluir a tarefa '${task.title}' na área ${AREA_LABELS[task.responsibleArea]}.`;

      if (task.blocksBilling) {
        billingBlockers.push({
          id: `task-bill-${task.code}`,
          scope: "BILLING",
          sourceType: "TASK",
          code: task.code,
          title: task.title,
          reason,
          responsibleArea: task.responsibleArea,
          responsibleAreaLabel: AREA_LABELS[task.responsibleArea],
          actionRequired,
        });
      }

      if (task.blocksDelivery) {
        deliveryBlockers.push({
          id: `task-del-${task.code}`,
          scope: "DELIVERY",
          sourceType: "TASK",
          code: task.code,
          title: task.title,
          reason,
          responsibleArea: task.responsibleArea,
          responsibleAreaLabel: AREA_LABELS[task.responsibleArea],
          actionRequired,
        });
      }
    }
  }

  for (const doc of documents) {
    if (doc.status !== "APPROVED") {
      const reason =
        doc.status === "REQUESTED"
          ? `Documento obrigatório '${doc.title}' ainda não foi enviado.`
          : doc.status === "UPLOADED_PENDING_REVIEW"
          ? `Documento '${doc.title}' foi enviado (v${doc.currentVersionNumber}) e aguarda conferência.`
          : doc.status === "OUTDATED"
          ? `Documento '${doc.title}' teve versão substituída (v${doc.currentVersionNumber}) e exige nova conferência.`
          : `Documento '${doc.title}' foi rejeitado/solicitado correção: ${
              doc.rejectionReason ?? "Verifique o parecer."
            }`;

      const actionRequired =
        doc.status === "REQUESTED" ||
        doc.status === "REJECTED" ||
        doc.status === "CORRECTION_REQUESTED"
          ? `Enviar arquivo atualizado para '${doc.title}'.`
          : `Revisar e aprovar a versão v${doc.currentVersionNumber} de '${doc.title}'.`;

      if (doc.blocksBilling) {
        billingBlockers.push({
          id: `doc-bill-${doc.id}`,
          scope: "BILLING",
          sourceType: "DOCUMENT",
          code: doc.requirementCode ?? doc.id,
          title: `Documento: ${doc.title}`,
          reason,
          responsibleArea: doc.responsibleArea,
          responsibleAreaLabel: AREA_LABELS[doc.responsibleArea],
          actionRequired,
        });
      }

      if (doc.blocksDelivery) {
        deliveryBlockers.push({
          id: `doc-del-${doc.id}`,
          scope: "DELIVERY",
          sourceType: "DOCUMENT",
          code: doc.requirementCode ?? doc.id,
          title: `Documento: ${doc.title}`,
          reason,
          responsibleArea: doc.responsibleArea,
          responsibleAreaLabel: AREA_LABELS[doc.responsibleArea],
          actionRequired,
        });
      }
    }
  }

  if (!deal.billingRegisteredAt || !deal.invoiceNumber) {
    deliveryBlockers.push({
      id: "invoice-missing",
      scope: "DELIVERY",
      sourceType: "INVOICE",
      code: "BILLING_INVOICE",
      title: "Faturamento / Nota Fiscal não registrada",
      reason: "O veículo ainda não possui Nota Fiscal de faturamento registrada.",
      responsibleArea: "BILLING",
      responsibleAreaLabel: AREA_LABELS.BILLING,
      actionRequired: "Registrar o número da Nota Fiscal e concluir a etapa de Faturamento.",
    });
  }

  const billingEligible = billingBlockers.length === 0;
  const billingRegistered = Boolean(deal.billingRegisteredAt && deal.invoiceNumber);
  const deliveryEligible = deliveryBlockers.length === 0;
  const deliveryAuthorized =
    deal.status === "DELIVERY_AUTHORIZED" && hasActiveReleaseAuthorization;
  const delivered = deal.status === "DELIVERED";

  // Calcula etapa atual baseada na primeira etapa com tarefa incompleta
  let currentStage: WorkflowStageCode = "DELIVERY";
  if (!delivered) {
    for (const stage of WORKFLOW_STAGES) {
      const stageTasks = applicableTasks.filter((t) => t.stageCode === stage.code);
      const allStageDone = stageTasks.every((t) => isTaskSatisfiedAsDependency(t));
      if (!allStageDone) {
        currentStage = stage.code;
        break;
      }
    }
  }

  // Pilares: Financeiro, Documental, Operacional
  const buildPillar = (
    areaKey: "FINANCIAL" | "DOCUMENTATION" | "OPERATIONAL",
    label: string,
    areas: ResponsibleArea[]
  ): PillarIndicator => {
    const pillarTasks = applicableTasks.filter((t) =>
      areas.includes(t.responsibleArea)
    );
    const pillarDocs = documents.filter((d) =>
      areas.includes(d.responsibleArea)
    );
    const doneTasks = pillarTasks.filter((t) => isTaskSatisfiedAsDependency(t));
    const hasRejectedOrOutdated =
      pillarTasks.some(
        (t) => t.approvalStatus === "REJECTED" || t.approvalStatus === "OUTDATED"
      ) ||
      pillarDocs.some(
        (d) =>
          d.status === "REJECTED" ||
          d.status === "CORRECTION_REQUESTED" ||
          d.status === "OUTDATED"
      );

    if (pillarTasks.length === 0 && pillarDocs.length === 0) {
      return {
        area: areaKey,
        label,
        status: "NOT_APPLICABLE",
        summary: "Sem exigências aplicáveis",
        completedCount: 0,
        totalApplicableCount: 0,
      };
    }

    const allDocsApproved = pillarDocs.every((d) => d.status === "APPROVED");
    if (doneTasks.length === pillarTasks.length && allDocsApproved) {
      return {
        area: areaKey,
        label,
        status: "OK",
        summary: `Conferido e aprovado (${doneTasks.length}/${pillarTasks.length} tarefas)`,
        completedCount: doneTasks.length,
        totalApplicableCount: pillarTasks.length,
      };
    }

    if (hasRejectedOrOutdated) {
      return {
        area: areaKey,
        label,
        status: "BLOCKED",
        summary: `Correção ou reanálise exigida (${doneTasks.length}/${pillarTasks.length})`,
        completedCount: doneTasks.length,
        totalApplicableCount: pillarTasks.length,
      };
    }

    return {
      area: areaKey,
      label,
      status: "PENDING",
      summary: `Em andamento (${doneTasks.length}/${pillarTasks.length} concluídas)`,
      completedCount: doneTasks.length,
      totalApplicableCount: pillarTasks.length,
    };
  };

  const parallelTasks = applicableTasks.filter(
    (t) =>
      t.state === "AVAILABLE" ||
      t.state === "IN_PROGRESS" ||
      t.state === "IN_REVIEW"
  );

  return {
    applicableTasksCount: applicableTasks.length,
    completedApplicableTasksCount: completedTasks.length,
    waivedTasksCount: waivedTasks.length,
    progressPercentage,
    currentStage,
    billingEligible,
    billingRegistered,
    billingBlockers,
    deliveryEligible,
    deliveryAuthorized,
    delivered,
    deliveryBlockers,
    pillars: {
      financial: buildPillar("FINANCIAL", "Financeiro e Faturamento", [
        "FINANCE",
        "BILLING",
      ]),
      documentation: buildPillar("DOCUMENTATION", "Documental e Jurídico", [
        "DOCUMENTATION",
        "COMMERCIAL",
      ]),
      operational: buildPillar("OPERATIONAL", "Preparação e Liberação", [
        "OPERATIONS",
        "RELEASE",
      ]),
    },
    parallelTasks,
  };
}

// ============================================================================
// 5. DESCOBERTA DA "SUA PRÓXIMA AÇÃO" PARA O USUÁRIO ATUAL
// ============================================================================

export interface UserNextActionRecommendation {
  hasDirectAction: boolean;
  headline: string;
  description: string;
  actionType:
    | "UPLOAD_DOCUMENT"
    | "REVIEW_DOCUMENT"
    | "APPROVE_TASK"
    | "EXECUTE_TASK"
    | "REGISTER_BILLING"
    | "AUTHORIZE_RELEASE"
    | "CONFIRM_DELIVERY"
    | "WAIT_OTHER_AREA"
    | "COMPLETED";
  targetTaskCode?: string;
  targetDocumentId?: string;
  responsibleAreaLabel: string;
}

export function computeUserNextAction(
  ctx: Pick<AuthenticatedContext, "profile" | "roles" | "permissions">,
  deal: Deal,
  tasks: TaskInstance[],
  documents: DealDocument[],
  summary: DealEligibilitySummary
): UserNextActionRecommendation {
  if (deal.status === "DELIVERED") {
    return {
      hasDirectAction: false,
      headline: "Veículo entregue com sucesso",
      description:
        "Todas as etapas, autorizações e a entrega física das chaves já foram concluídas e auditadas.",
      actionType: "COMPLETED",
      responsibleAreaLabel: "Concluído",
    };
  }

  // 1. Verificar documentos pendentes de envio que o usuário atual pode enviar (ex: Vendedor / Comercial)
  const missingDocsForUser = documents.filter(
    (d) =>
      (d.status === "REQUESTED" ||
        d.status === "REJECTED" ||
        d.status === "CORRECTION_REQUESTED") &&
      (canActOnArea(ctx, d.responsibleArea) ||
        ctx.roles.includes("SELLER") ||
        d.requestedBy === ctx.profile.id)
  );
  if (missingDocsForUser.length > 0 && hasPermission(ctx, "document:upload")) {
    const doc = missingDocsForUser[0];
    return {
      hasDirectAction: true,
      headline: `Enviar documento: ${doc.title}`,
      description:
        doc.status === "REQUESTED"
          ? `A negociação aguarda o envio de '${doc.title}' (${doc.whyRequired}).`
          : `Foi solicitada correção para '${doc.title}': ${doc.rejectionReason ?? "Envie nova versão."}`,
      actionType: "UPLOAD_DOCUMENT",
      targetDocumentId: doc.id,
      targetTaskCode: doc.taskCode ?? undefined,
      responsibleAreaLabel: AREA_LABELS[doc.responsibleArea],
    };
  }

  // 2. Verificar documentos aguardando conferência documental (para perfil DOCUMENTATION / ADMIN / MANAGER)
  if (hasPermission(ctx, "document:review")) {
    const docsToReview = documents.filter(
      (d) => d.status === "UPLOADED_PENDING_REVIEW" || d.status === "OUTDATED"
    );
    if (docsToReview.length > 0) {
      const doc = docsToReview[0];
      return {
        hasDirectAction: true,
        headline: `Conferir documento enviado: ${doc.title} (v${doc.currentVersionNumber})`,
        description: `O arquivo já foi anexado e aguarda sua conferência formal na área ${AREA_LABELS[doc.responsibleArea]}.`,
        actionType: "REVIEW_DOCUMENT",
        targetDocumentId: doc.id,
        targetTaskCode: doc.taskCode ?? undefined,
        responsibleAreaLabel: AREA_LABELS[doc.responsibleArea],
      };
    }
  }

  // 3. Verificar faturamento se elegível e usuário tem permissão billing:register
  if (
    summary.billingEligible &&
    !summary.billingRegistered &&
    hasPermission(ctx, "billing:register")
  ) {
    return {
      hasDirectAction: true,
      headline: "Registrar Nota Fiscal de Faturamento",
      description:
        "Todos os pré-requisitos financeiros e documentais de faturamento foram cumpridos. Registre a Nota Fiscal para liberar as etapas finais.",
      actionType: "REGISTER_BILLING",
      targetTaskCode: "TASK_BILLING_INVOICE",
      responsibleAreaLabel: AREA_LABELS.BILLING,
    };
  }

  // 4. Verificar autorização de entrega se elegível e ainda não autorizado
  if (
    summary.deliveryEligible &&
    !summary.deliveryAuthorized &&
    hasPermission(ctx, "release:authorize")
  ) {
    return {
      hasDirectAction: true,
      headline: "Emitir Autorização Formal de Liberação",
      description:
        "Todos os requisitos financeiros, documentais, de faturamento e preparação estão concluídos. Você pode autorizar formalmente a entrega.",
      actionType: "AUTHORIZE_RELEASE",
      targetTaskCode: "TASK_RELEASE_AUTH",
      responsibleAreaLabel: AREA_LABELS.RELEASE,
    };
  }

  // 5. Verificar confirmação de entrega física se já autorizado
  if (
    summary.deliveryAuthorized &&
    !summary.delivered &&
    hasPermission(ctx, "delivery:confirm")
  ) {
    return {
      hasDirectAction: true,
      headline: "Reconfirmar veículo e registrar entrega física das chaves",
      description:
        "A entrega está formalmente autorizada. Confirme o chassi/QR Code do veículo e registre a entrega ao cliente.",
      actionType: "CONFIRM_DELIVERY",
      targetTaskCode: "TASK_CONFIRM_DELIVERY",
      responsibleAreaLabel: AREA_LABELS.OPERATIONS,
    };
  }

  // 6. Verificar tarefas disponíveis ou em revisão da área do usuário
  const actionableTasks = tasks.filter(
    (t) =>
      (t.state === "AVAILABLE" ||
        t.state === "IN_PROGRESS" ||
        t.state === "IN_REVIEW") &&
      t.code !== "TASK_RELEASE_AUTH" &&
      t.code !== "TASK_CONFIRM_DELIVERY" &&
      (canActOnArea(ctx, t.responsibleArea) ||
        t.assigneeId === ctx.profile.id ||
        (t.requiresFormalApproval && canApproveTaskRole(ctx, t.approvalRole)))
  );

  if (actionableTasks.length > 0) {
    const t = actionableTasks[0];
    return {
      hasDirectAction: true,
      headline: t.requiresFormalApproval
        ? `Aprovar ou revisar etapa: ${t.title}`
        : `Executar tarefa: ${t.title}`,
      description: t.pendingReason ?? t.description,
      actionType: t.requiresFormalApproval ? "APPROVE_TASK" : "EXECUTE_TASK",
      targetTaskCode: t.code,
      responsibleAreaLabel: AREA_LABELS[t.responsibleArea],
    };
  }

  // 7. Caso a próxima ação dependa de outra área
  const nextActiveTask = summary.parallelTasks[0];
  if (nextActiveTask) {
    return {
      hasDirectAction: false,
      headline: `Aguardando ação da área: ${AREA_LABELS[nextActiveTask.responsibleArea]}`,
      description: `A tarefa atual em andamento/disponível é '${nextActiveTask.title}' (${
        nextActiveTask.pendingReason ?? "Em fila da área responsável"
      }).`,
      actionType: "WAIT_OTHER_AREA",
      targetTaskCode: nextActiveTask.code,
      responsibleAreaLabel: AREA_LABELS[nextActiveTask.responsibleArea],
    };
  }

  return {
    hasDirectAction: false,
    headline: "Aguardando evolução das etapas",
    description: "Verifique a lista de bloqueios e tarefas disponíveis.",
    actionType: "WAIT_OTHER_AREA",
    responsibleAreaLabel: "Geral",
  };
}

// ============================================================================
// 6. INSTANCIAÇÃO DETERMINÍSTICA DE TAREFAS E DOCUMENTOS DA NEGOCIAÇÃO
// ============================================================================

export function instantiateDealWorkflow(params: {
  deal: Deal;
  vehicleCondition: "NEW" | "USED";
  taskTemplates: TaskTemplate[];
  documentRequirements: DocumentRequirement[];
  nowIso: string;
  generateId: () => string;
}): {
  tasks: TaskInstance[];
  documents: DealDocument[];
} {
  const {
    deal,
    vehicleCondition,
    taskTemplates,
    documentRequirements,
    nowIso,
    generateId,
  } = params;

  const conditionContext: DealConditionContext = {
    buyerType: deal.buyerType,
    paymentMethod: deal.paymentMethod,
    hasFinancing: deal.hasFinancing,
    hasTradeIn: deal.hasTradeIn,
    hasPowerOfAttorney: deal.hasPowerOfAttorney,
    vehicleCondition,
  };

  const baseDate = new Date(nowIso);

  const documents: DealDocument[] = [];
  for (const req of documentRequirements) {
    const evalResult = evaluateApplicabilityConditions(
      req.applicabilityConditions,
      conditionContext
    );
    if (!evalResult.applicable) {
      continue;
    }

    documents.push({
      id: generateId(),
      organizationId: deal.organizationId,
      dealId: deal.id,
      taskCode: req.linkedTaskCode,
      requirementCode: req.code,
      title: req.title,
      category: req.category,
      whyRequired: req.whyRequired,
      responsibleArea: req.responsibleArea,
      status: "REQUESTED",
      currentVersionNumber: 0,
      rejectionReason: null,
      blocksBilling: req.blocksBilling,
      blocksDelivery: req.blocksDelivery,
      isCustomerVisible: req.isCustomerVisible,
      requestedBy: deal.sellerId,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  const rawTasks: TaskInstance[] = [...taskTemplates]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((tpl) => {
      const evalResult = evaluateApplicabilityConditions(
        tpl.applicabilityConditions,
        conditionContext
      );

      const dueAt = new Date(
        baseDate.getTime() + tpl.slaHours * 60 * 60 * 1000
      ).toISOString();

      // A tarefa de identificação inicial já nasce concluída quando o passaporte é aberto
      const isInitialIdentification = tpl.code === "TASK_VEHICLE_IDENTIFICATION";

      return {
        id: generateId(),
        organizationId: deal.organizationId,
        dealId: deal.id,
        taskTemplateId: tpl.id,
        code: tpl.code,
        title: tpl.title,
        description: tpl.description,
        whyRequired: tpl.whyRequired,
        guidance: tpl.guidance,
        stageCode: tpl.stageCode,
        responsibleArea: tpl.responsibleArea,
        assigneeId: tpl.defaultAssigneeId,
        state: !evalResult.applicable
          ? "WAIVED_BY_RULE"
          : isInitialIdentification
          ? "COMPLETED"
          : tpl.dependsOnTaskCodes.length === 0
          ? "AVAILABLE"
          : "WAITING_PREREQUISITE",
        pendingReason: null,
        waivedRuleDescription: evalResult.waivedReason,
        dependsOnTaskCodes: tpl.dependsOnTaskCodes,
        requiredEvidenceTypes: tpl.requiredEvidenceTypes,
        requiresFormalApproval: tpl.requiresFormalApproval,
        approvalRole: tpl.approvalRole,
        approvalStatus: !evalResult.applicable
          ? "NOT_REQUIRED"
          : tpl.requiresFormalApproval
          ? "PENDING"
          : "NOT_REQUIRED",
        blocksBilling: tpl.blocksBilling,
        blocksDelivery: tpl.blocksDelivery,
        procedureCode: tpl.procedureCode,
        dueAt: !evalResult.applicable ? null : dueAt,
        startedAt: isInitialIdentification ? nowIso : null,
        completedAt: isInitialIdentification ? nowIso : null,
        completedBy: isInitialIdentification ? deal.sellerId : null,
        reopenCount: 0,
        sortOrder: tpl.sortOrder,
        updatedAt: nowIso,
      };
    });

  const tasks = recalculateTaskStates(rawTasks, documents);
  return { tasks, documents };
}

