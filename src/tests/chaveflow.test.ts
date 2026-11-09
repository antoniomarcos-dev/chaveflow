import {
  buildAuthenticatedContext,
  inviteCollaborator,
} from "@/application/auth-service";
import { getCustomerSafeDealView } from "@/application/customer-portal-service";
import {
  authorizeDealRelease,
  confirmPhysicalDelivery,
  createOrSaveGuidedDeal,
  getDealPassportView,
  PreconditionBlockedError,
  recordTaskFormalApproval,
  registerDealBilling,
  reviewDocumentVersion,
  updateTaskOperationalState,
  uploadDocumentVersion,
} from "@/application/deal-service";
import {
  createOrUpdateVehicle,
  getVehicleDetails,
  resolveScannedVehicleCode,
} from "@/application/vehicle-service";
import { answerContextualQuestion } from "@/domain/contextual-assistant";
import { validateWorkflowDAG } from "@/domain/workflow-engine";
import { saveDatabaseState } from "@/infrastructure/database";
import { beforeEach, describe, expect, it } from "vitest";
import { createInitialSeedState, DEMO_BRANCH_ID } from "./fixtures/seed-data";

process.env.CHAVEFLOW_TEST_IN_MEMORY = "true";

describe("ChaveFlow — Suite de Testes Prioritários de Engenharia e Regras de Negócio", () => {
  beforeEach(() => {
    saveDatabaseState(createInitialSeedState());
  });

  it("1. Isolamento entre organizações: usuário de outra organização não acessa veículos nem negociações da Pinauto", async () => {
    const otherOrgManager =
      (await buildAuthenticatedContext("user-other-org"))!;
    expect(otherOrgManager.organization.id).toBe("org-cerrado-isolated");
    expect(
      await buildAuthenticatedContext("user-other-org", "org-pinauto-demo"),
    ).toBeNull();

    // Tentativa de consultar negociação da Pinauto deve falhar com violação de isolamento
    await expect(
      async () =>
        await getDealPassportView({
          ctx: otherOrgManager,
          dealId: "deal-001",
        }),
    ).rejects.toThrow(/outra organização/i);

    // Tentativa de consultar veículo da Pinauto deve falhar
    await expect(
      async () =>
        await getVehicleDetails({
          ctx: otherOrgManager,
          vehicleId: "veh-001",
        }),
    ).rejects.toThrow(/outra organização/i);

    // Escanear QR Code de veículo da Pinauto logado na outra organização não deve reconhecer nem vazar dados
    const scanRes = await resolveScannedVehicleCode({
      ctx: otherOrgManager,
      rawQrCode: "cf://v/qr-pin-byd-001-songplus",
    });
    expect(scanRes.outcome).toBe("UNKNOWN_CODE");
  });

  it("2. Acesso indevido de cliente e proteção de cadastro público: cliente só acessa própria negociação, não usa QR do veículo e não vê dados internos", async () => {
    const helenaCtx = (await buildAuthenticatedContext("user-cliente-helena"))!;
    const agroCtx = (await buildAuthenticatedContext("user-cliente-agro"))!;

    // Helena acessa sua própria negociação (deal-001) com visão filtrada segura
    const helenaView = await getCustomerSafeDealView({
      ctx: helenaCtx,
      dealId: "deal-001",
    });
    expect(helenaView.dealNumber).toBe("NEG-2026-0001");
    // Previsão de entrega NÃO está confirmada em deal-001, logo não deve exibir data confirmada
    expect(helenaView.deliveryForecast.isConfirmedByAuthorizedStaff).toBe(
      false,
    );
    expect(helenaView.deliveryForecast.confirmedDateIso).toBeNull();
    // Documento interno de usado na troca (isCustomerVisible=false) não aparece para o cliente
    expect(
      helenaView.documentRequests.some((d) =>
        d.title.includes("Usado na Troca"),
      ),
    ).toBe(false);

    // Helena tentando acessar a negociação de outro cliente (deal-002 da Agropecuária) é bloqueada
    await expect(
      async () =>
        await getCustomerSafeDealView({
          ctx: helenaCtx,
          dealId: "deal-002",
        }),
    ).rejects.toThrow(/próprias negociações/i);

    // Agropecuária tentando acessar o Passaporte Interno da concessionária é bloqueada
    await expect(
      async () =>
        await getDealPassportView({
          ctx: agroCtx,
          dealId: "deal-002",
        }),
    ).rejects.toThrow(/equipe interna/i);

    // QR Code do veículo NUNCA concede acesso à área do comprador
    await expect(
      async () =>
        await getCustomerSafeDealView({
          ctx: null,
          accessToken: "qr-pin-byd-001-songplus",
        }),
    ).rejects.toThrow(/QR Code do veículo/i);

    // Cadastro público não pode escolher funções privilegiadas
    await expect(
      inviteCollaborator({
        ctx: null,
        isPublicSelfSignup: true,
        email: "invasor@teste.com",
        fullName: "Tentativa Escalonamento",
        phone: "62999999999",
        branchId: DEMO_BRANCH_ID,
        roles: ["ADMIN"],
      }),
    ).rejects.toThrow(/cadastro público não pode escolher funções/i);
  });

  it("3. Permissões de aprovação no servidor: vendedor não pode aprovar financeiro, documental nem autorizar entrega", async () => {
    const sellerCtx = (await buildAuthenticatedContext("user-vendedor"))!;

    await expect(
      recordTaskFormalApproval({
        ctx: sellerCtx,
        dealId: "deal-001",
        taskCode: "TASK_PAYMENT_PROOF",
        decision: "APPROVED",
        justification: "Tentando aprovar pelo vendedor",
      }),
    ).rejects.toThrow(/Somente a função Financeiro/i);

    await expect(
      authorizeDealRelease({
        ctx: sellerCtx,
        dealId: "deal-003",
      }),
    ).rejects.toThrow(/permissão para autorizar a entrega/i);
  });

  it("4. Condições de geração de tarefas: financiamento, usado na troca e procuração alteram tarefas aplicáveis e registram dispensa por regra", async () => {
    const sellerCtx = (await buildAuthenticatedContext("user-vendedor"))!;

    // Criar negociação à vista, sem financiamento, sem troca, mas COM procuração no veículo disponível veh-005 (BYD Seal)
    const { deal } = await createOrSaveGuidedDeal({
      ctx: sellerCtx,
      input: {
        vehicleId: "veh-005",
        branchId: DEMO_BRANCH_ID,
        sellerId: sellerCtx.profile.id,
        customerMode: "EXISTING",
        customerId: "cust-marcelo",
        buyerType: "PF",
        paymentMethod: "CASH",
        hasFinancing: false,
        hasTradeIn: false,
        hasPowerOfAttorney: true,
        attorneyName: "Dra. Camila Soares",
        attorneyDocument: "111.222.333-44",
        expectedDeliveryDate: "2026-11-20",
        saveAsDraft: false,
      },
    });

    const passport = await getDealPassportView({
      ctx: sellerCtx,
      dealId: deal.id,
    });

    const poaTask = passport.tasks.find((t) => t.code === "TASK_POA_DOCS")!;
    const tradeInTask = passport.tasks.find(
      (t) => t.code === "TASK_TRADE_IN_EVAL",
    )!;
    const finTask = passport.tasks.find(
      (t) => t.code === "TASK_FINANCING_CONTRACT",
    )!;

    // Procuração deve estar aplicável (AVAILABLE)
    expect(poaTask.state).toBe("AVAILABLE");

    // Troca e Financiamento devem estar WAIVED_BY_RULE com justificativa explícita da regra
    expect(tradeInTask.state).toBe("WAIVED_BY_RULE");
    expect(tradeInTask.waivedRuleDescription).toContain("hasTradeIn");

    expect(finTask.state).toBe("WAIVED_BY_RULE");
    expect(finTask.waivedRuleDescription).toContain("hasFinancing");
  });

  it("5. Dependências, prevenção de ciclos no DAG e paralelismo entre áreas", async () => {
    // Valida detecção de ciclo no DAG
    const cyclicCheck = validateWorkflowDAG([
      { code: "A", dependsOnTaskCodes: ["B"] },
      { code: "B", dependsOnTaskCodes: ["C"] },
      { code: "C", dependsOnTaskCodes: ["A"] },
    ]);
    expect(cyclicCheck.valid).toBe(false);
    expect(cyclicCheck.cyclePath).toEqual(["A", "B", "C", "A"]);

    // Em deal-002, TASK_DOSSIER_REVIEW depende de TASK_BUYER_DOCS e TASK_POA_DOCS
    const docCtx = (await buildAuthenticatedContext("user-documental"))!;
    await expect(
      recordTaskFormalApproval({
        ctx: docCtx,
        dealId: "deal-002",
        taskCode: "TASK_DOSSIER_REVIEW",
        decision: "APPROVED",
        justification:
          "Tentando aprovar dossiê fora de ordem antes de concluir coleta",
      }),
    ).rejects.toThrow(/pré-requisito/i);

    // Mas a preparação física (TASK_PDI_PREPARATION) não depende do documental nem do financeiro e pode avançar em paralelo!
    const opsCtx = (await buildAuthenticatedContext("user-operacao"))!;
    const pdiCompleted = await updateTaskOperationalState({
      ctx: opsCtx,
      dealId: "deal-002",
      taskCode: "TASK_PDI_PREPARATION",
      action: "COMPLETE_OPERATIONAL",
      notes: "PDI adiantado em paralelo com sucesso",
    });
    expect(pdiCompleted.state).toBe("COMPLETED");
  });

  it("6. Bloqueio de liberação: tentativa de autorizar entrega com pendências é bloqueada e lista todos os requisitos impeditivos", async () => {
    const releaseCtx = (await buildAuthenticatedContext("user-liberacao"))!;

    try {
      await authorizeDealRelease({
        ctx: releaseCtx,
        dealId: "deal-001",
      });
      expect.fail("Deveria ter bloqueado a autorização prematura");
    } catch (err) {
      expect(err).toBeInstanceOf(PreconditionBlockedError);
      const blockedErr = err as PreconditionBlockedError;
      expect(blockedErr.blockers.length).toBeGreaterThan(0);
      expect(
        blockedErr.blockers.some((b) => b.code === "TASK_PAYMENT_PROOF"),
      ).toBe(true);
    }
  });

  it("7. Invalidação de aprovação por substituição de documento aprovado: preserva versão anterior, marca aprovação como OUTDATED, reabre tarefa e invalida autorização", async () => {
    const releaseCtx = (await buildAuthenticatedContext("user-liberacao"))!;
    const sellerCtx = (await buildAuthenticatedContext("user-vendedor"))!;

    // Em deal-003, todos os requisitos estão prontos. Vamos emitir a autorização primeiro:
    const auth = await authorizeDealRelease({
      ctx: releaseCtx,
      dealId: "deal-003",
      notes: "Autorização emitida antes da substituição de documento",
    });
    expect(auth.status).toBe("ACTIVE");

    const beforeView = await getDealPassportView({
      ctx: releaseCtx,
      dealId: "deal-003",
    });
    expect(beforeView.deal.status).toBe("DELIVERY_AUTHORIZED");

    const approvedBuyerDoc = beforeView.documents.find(
      (d) => d.requirementCode === "DOC_BUYER_ID",
    )!;
    expect(approvedBuyerDoc.status).toBe("APPROVED");
    expect(approvedBuyerDoc.currentVersionNumber).toBe(1);

    // Agora o vendedor substitui o documento aprovado por uma versão v2 corrigida
    const replaceRes = await uploadDocumentVersion({
      ctx: sellerCtx,
      dealId: "deal-003",
      documentId: approvedBuyerDoc.id,
      originalFilename: "CNH_Marcelo_Corrigida_v2.txt",
      mimeType: "text/plain",
      contentBuffer: Buffer.from("Conteúdo atualizado v2 do documento"),
      replacementReason: "Atualização de comprovante de endereço do comprador",
    });

    expect(replaceRes.version.versionNumber).toBe(2);
    expect(replaceRes.document.status).toBe("OUTDATED");
    expect(replaceRes.reopenedTasksCount).toBeGreaterThan(0);

    const afterView = await getDealPassportView({
      ctx: releaseCtx,
      dealId: "deal-003",
    });

    // Preserva versão 1 e adiciona versão 2
    const updatedDoc = afterView.documents.find(
      (d) => d.id === approvedBuyerDoc.id,
    )!;
    expect(updatedDoc.versions.length).toBe(2);

    // Aprovação documental dependente foi marcada como OUTDATED
    expect(afterView.approvals.some((a) => a.status === "OUTDATED")).toBe(true);

    // Autorização de entrega anterior foi automaticamente INVALIDADA e o status voltou para ACTIVE!
    expect(afterView.activeReleaseAuthorization).toBeNull();
    expect(
      afterView.allReleaseAuthorizations.some(
        (ra) => ra.status === "INVALIDATED",
      ),
    ).toBe(true);
    expect(afterView.deal.status).toBe("ACTIVE");
    expect(afterView.summary.deliveryEligible).toBe(false);
  });

  it("8. Tentativas concorrentes de liberação ou entrega: impede dupla autorização ativa e dupla entrega", async () => {
    const releaseCtx = (await buildAuthenticatedContext("user-liberacao"))!;
    const opsCtx = (await buildAuthenticatedContext("user-operacao"))!;

    // Duas chamadas concorrentes de autorização na mesma negociação elegível (deal-003)
    const results = await Promise.allSettled([
      authorizeDealRelease({
        ctx: releaseCtx,
        dealId: "deal-003",
        expectedConcurrencyVersion: 2,
      }),
      authorizeDealRelease({
        ctx: releaseCtx,
        dealId: "deal-003",
        expectedConcurrencyVersion: 2,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Duas chamadas concorrentes de confirmação de entrega física
    const deliveryResults = await Promise.allSettled([
      confirmPhysicalDelivery({
        ctx: opsCtx,
        dealId: "deal-003",
        confirmedVehicleIdentifier: "9BWKG22H07B303003",
        recipientName: "Dr. Marcelo Cavalcante",
        recipientDocument: "456.789.123-11",
      }),
      confirmPhysicalDelivery({
        ctx: opsCtx,
        dealId: "deal-003",
        confirmedVehicleIdentifier: "9BWKG22H07B303003",
        recipientName: "Dr. Marcelo Cavalcante",
        recipientDocument: "456.789.123-11",
      }),
    ]);

    expect(deliveryResults.filter((r) => r.status === "fulfilled").length).toBe(
      1,
    );
    expect(deliveryResults.filter((r) => r.status === "rejected").length).toBe(
      1,
    );
  });

  it("9. Prevenção de negociação ativa duplicada e chassi duplicado na organização", async () => {
    const sellerCtx = (await buildAuthenticatedContext("user-vendedor"))!;
    const adminCtx = (await buildAuthenticatedContext("user-admin"))!;

    // veh-001 já possui a negociação ativa NEG-2026-0001
    await expect(
      createOrSaveGuidedDeal({
        ctx: sellerCtx,
        input: {
          vehicleId: "veh-001",
          branchId: DEMO_BRANCH_ID,
          sellerId: sellerCtx.profile.id,
          customerMode: "EXISTING",
          customerId: "cust-marcelo",
          buyerType: "PF",
          paymentMethod: "CASH",
          hasFinancing: false,
          hasTradeIn: false,
          hasPowerOfAttorney: false,
          saveAsDraft: false,
        },
      }),
    ).rejects.toThrow(/já possui uma negociação ativa/i);

    // Tentativa de cadastrar veículo com chassi já existente na organização
    await expect(
      createOrUpdateVehicle({
        ctx: adminCtx,
        input: {
          internalCode: "PIN-BYD-999",
          vin: "9BWSU19F08B301001", // Mesmo chassi de veh-001
          brand: "BYD",
          model: "Song Plus",
          trim: "DM-i",
          manufacturingYear: 2025,
          modelYear: 2026,
          color: "Branco",
          condition: "NEW",
          branchId: DEMO_BRANCH_ID,
          entryDate: "2026-11-09",
        },
      }),
    ).rejects.toThrow(/Chassi duplicado/i);
  });

  it("10. Roteiro Demonstrativo Principal de ponta a ponta (Passos 1 a 15)", async () => {
    const sellerCtx = (await buildAuthenticatedContext("user-vendedor"))!;
    const docCtx = (await buildAuthenticatedContext("user-documental"))!;
    const finCtx = (await buildAuthenticatedContext("user-financeiro"))!;
    const billCtx = (await buildAuthenticatedContext("user-faturamento"))!;
    const releaseCtx = (await buildAuthenticatedContext("user-liberacao"))!;
    const opsCtx = (await buildAuthenticatedContext("user-operacao"))!;
    const helenaCtx = (await buildAuthenticatedContext("user-cliente-helena"))!;

    // Passos 1, 2 e 3: Vendedor escaneia QR Code de PIN-BYD-001, confirma dados e acessa o passaporte NEG-2026-0001
    const scanRes = await resolveScannedVehicleCode({
      ctx: sellerCtx,
      rawQrCode: "cf://v/qr-pin-byd-001-songplus",
    });
    expect(scanRes.outcome).toBe("IDENTIFIED_WITH_ACTIVE_DEAL");
    if (scanRes.outcome !== "IDENTIFIED_WITH_ACTIVE_DEAL") return;
    expect(scanRes.vehicle.model).toBe("Song Plus DM-i");
    expect(scanRes.activeDealNumber).toBe("NEG-2026-0001");

    const dealId = scanRes.activeDealId;

    // Passo 4: Visualiza pendência documental (DOC_TRADE_IN_LAUDO) e seu responsável
    let passport = await getDealPassportView({ ctx: sellerCtx, dealId });
    expect(passport.userNextAction.actionType).toBe("UPLOAD_DOCUMENT");
    const tradeInDoc = passport.documents.find(
      (d) => d.requirementCode === "DOC_TRADE_IN_LAUDO",
    )!;
    expect(tradeInDoc.status).toBe("REQUESTED");

    // Passo 5: Vendedor envia o documento solicitado
    await uploadDocumentVersion({
      ctx: sellerCtx,
      dealId,
      documentId: tradeInDoc.id,
      originalFilename: "Laudo_Vistoria_Corolla_Troca_DEMO.pdf",
      mimeType: "application/pdf",
      contentBuffer: Buffer.from(
        "%PDF-1.4 Documento Demonstrativo Vistoria Usado",
      ),
      uploadNotes: "Laudo cautelar aprovado sem restrições.",
    });

    // Passos 6, 7 e 8: Usuário documental recebe a tarefa, confere e aprova; passaporte atualiza próxima ação
    passport = await getDealPassportView({ ctx: docCtx, dealId });
    expect(passport.userNextAction.actionType).toBe("REVIEW_DOCUMENT");

    await reviewDocumentVersion({
      ctx: docCtx,
      dealId,
      documentId: tradeInDoc.id,
      decision: "APPROVED",
      justification: "Laudo cautelar e CRLV do usado conferidos e aprovados.",
    });

    passport = await getDealPassportView({ ctx: docCtx, dealId });
    expect(passport.summary.pillars.documentation.status).toBe("OK");

    // Passo 9: Tentativa prematura de autorização é bloqueada por requisito financeiro pendente (TASK_PAYMENT_PROOF) e falta de NF
    await expect(
      authorizeDealRelease({
        ctx: releaseCtx,
        dealId,
      }),
    ).rejects.toThrow(PreconditionBlockedError);

    // Passo 10: Financeiro registra sua aprovação com evidência
    await recordTaskFormalApproval({
      ctx: finCtx,
      dealId,
      taskCode: "TASK_PAYMENT_PROOF",
      decision: "APPROVED",
      justification: "PIX de entrada conciliado em conta bancária da Pinauto.",
    });

    // Passo 11: Os demais requisitos demonstrativos são concluídos (Faturamento registra a Nota Fiscal)
    passport = await getDealPassportView({ ctx: billCtx, dealId });
    expect(passport.summary.billingEligible).toBe(true);

    await registerDealBilling({
      ctx: billCtx,
      dealId,
      invoiceNumber: "NF-e 000.483.777 (Série 1 - Demo)",
      notes: "Faturamento emitido após liberação financeira e documental.",
    });

    passport = await getDealPassportView({ ctx: releaseCtx, dealId });
    expect(passport.summary.deliveryEligible).toBe(true);
    expect(passport.deal.status).toBe("ELIGIBLE_FOR_AUTHORIZATION");

    // Passo 12: O responsável autorizado libera a entrega
    const releaseAuth = await authorizeDealRelease({
      ctx: releaseCtx,
      dealId,
      notes: "Dossiê 100% conforme. Entrega autorizada.",
      confirmedDeliveryWindow: "2026-11-10T15:00:00.000Z",
    });
    expect(releaseAuth.status).toBe("ACTIVE");

    passport = await getDealPassportView({ ctx: opsCtx, dealId });
    expect(passport.deal.status).toBe("DELIVERY_AUTHORIZED");

    // Passo 13: A operação reconfirma o veículo (chassi) e registra a entrega
    const delivery = await confirmPhysicalDelivery({
      ctx: opsCtx,
      dealId,
      confirmedVehicleIdentifier: "9BWSU19F08B301001",
      recipientName: "Helena Martins",
      recipientDocument: "123.456.789-00",
      deliveryNotes:
        "Veículo entregue com bateria em 100% e chave NFC configurada.",
    });
    expect(delivery.confirmedVin).toBe("9BWSU19F08B301001");

    // Passo 14: O cliente visualiza a atualização permitida
    const customerView = await getCustomerSafeDealView({
      ctx: helenaCtx,
      dealId,
    });
    expect(customerView.status).toBe("DELIVERED");
    expect(customerView.deliveryForecast.isConfirmedByAuthorizedStaff).toBe(
      true,
    );
    expect(
      customerView.customerUpdates.some((u) =>
        u.summary.includes("Entrega física das chaves realizada"),
      ),
    ).toBe(true);

    // Passo 15: O histórico preserva todos os eventos e o assistente contextual responde sem inventar procedimentos
    const finalPassport = await getDealPassportView({ ctx: sellerCtx, dealId });
    expect(finalPassport.auditEvents.length).toBeGreaterThanOrEqual(8);

    const assistantReply = answerContextualQuestion({
      ctx: sellerCtx,
      question: "O que falta para entregar este carro?",
      deal: finalPassport.deal,
      vehicle: finalPassport.vehicle,
      tasks: finalPassport.tasks,
      documents: finalPassport.documents,
      publishedProcedures: [],
      recentEvents: finalPassport.auditEvents,
      hasActiveReleaseAuthorization: false,
    });
    expect(assistantReply.answerMarkdown).toContain("entrega física concluída");
  });
});
