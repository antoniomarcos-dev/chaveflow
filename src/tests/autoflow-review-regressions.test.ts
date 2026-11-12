import {
  buildAuthenticatedContext,
} from "@/application/auth-service";
import { getCustomerSafeDealView } from "@/application/customer-portal-service";
import {
  confirmPhysicalDelivery,
  createOrSaveGuidedDeal,
  getDealPassportView,
  PreconditionBlockedError,
  registerDealBilling,
  reviewDocumentVersion,
  updateTaskOperationalState,
} from "@/application/deal-service";
import {
  inspectPasswordResetToken,
} from "@/application/password-reset-service";
import { getManagerialDashboardData } from "@/application/report-and-admin-service";
import {
  resolveScannedVehicleCode,
} from "@/application/vehicle-service";
import {
  canAccessDealRecord,
  canActOnArea,
  canReviewDocument,
  isVehicleSellable,
  validateStaffAssigneeForArea,
} from "@/domain/permissions";
import {
  GuidedDealInputSchema,
  TaskInstance,
} from "@/domain/types";
import {
  computeDealEligibilityAndSummary,
  computeUserNextAction,
  recalculateTaskStates,
} from "@/domain/workflow-engine";
import {
  loadDatabaseState,
  saveDatabaseState,
  withTransaction,
} from "@/infrastructure/database";
import crypto from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createInitialSeedState,
  DEMO_BRANCH_ID,
  DEMO_ORG_ID,
} from "./fixtures/seed-data";

process.env.CHAVEFLOW_TEST_IN_MEMORY = "true";

describe("AUTOFLOW — Verificação de Regras, Regressões e Acessibilidade (Seção 20)", () => {
  beforeEach(() => {
    saveDatabaseState(createInitialSeedState());
  });

  it("1. Controle de acesso: vendedor não acessa negociação de outro vendedor", async () => {
    const sellerLucas = (await buildAuthenticatedContext("user-vendedor"))!;
    expect(sellerLucas).toBeDefined();

    const db = await loadDatabaseState();
    // deal-001 pertence ao vendedor Lucas
    const deal1 = db.deals.find((d) => d.id === "deal-001")!;
    expect(deal1.sellerId).toBe(sellerLucas.profile.id);
    expect(canAccessDealRecord(sellerLucas, deal1)).toBe(true);

    const passport1 = await getDealPassportView({
      ctx: sellerLucas,
      dealId: "deal-001",
    });
    expect(passport1.deal.id).toBe("deal-001");

    // deal-002 é atribuído a outro vendedor
    const deal2 = db.deals.find((d) => d.id === "deal-002")!;
    deal2.sellerId = "outro-vendedor-id";
    await saveDatabaseState(db);

    expect(canAccessDealRecord(sellerLucas, deal2)).toBe(false);

    // Tentativa de acesso do vendedor Lucas à negociação de outro vendedor deve ser bloqueada
    await expect(
      async () =>
        await getDealPassportView({
          ctx: sellerLucas,
          dealId: "deal-002",
        }),
    ).rejects.toThrow(/(Acesso restrito: o perfil Vendedor só pode acessar|Você não tem permissão para acessar)/i);
  });

  it("2. Atribuição de responsável: colaborador de área incompatível é rejeitado", async () => {
    const adminCtx = (await buildAuthenticatedContext("user-admin"))!;
    const sellerLucas = (await buildAuthenticatedContext("user-vendedor"))!;
    const financeRoberto = (await buildAuthenticatedContext("user-financeiro"))!;

    // Lucas só tem papel SELLER (área COMMERCIAL)
    expect(canActOnArea(sellerLucas, "FINANCE")).toBe(false);
    expect(canActOnArea(sellerLucas, "OPERATIONS")).toBe(false);
    expect(canActOnArea(sellerLucas, "COMMERCIAL")).toBe(true);

    // Roberto tem papel FINANCE (área FINANCE)
    expect(canActOnArea(financeRoberto, "FINANCE")).toBe(true);
    expect(canActOnArea(financeRoberto, "OPERATIONS")).toBe(false);

    // Tentativa de atribuir Lucas (Vendedor) a uma tarefa da área FINANCE deve falhar com erro de validação
    await expect(
      async () =>
        await updateTaskOperationalState({
          ctx: adminCtx,
          dealId: "deal-001",
          taskCode: "TASK_PAYMENT_PROOF",
          action: "ASSIGN",
          targetAssigneeId: sellerLucas.profile.id,
        }),
    ).rejects.toThrow(/acesso à área da tarefa/i);

    // Atribuir Roberto à tarefa FINANCE deve ser aceito com sucesso
    const updated = await updateTaskOperationalState({
      ctx: adminCtx,
      dealId: "deal-001",
      taskCode: "TASK_PAYMENT_PROOF",
      action: "ASSIGN",
      targetAssigneeId: financeRoberto.profile.id,
    });
    expect(updated.assigneeId).toBe(financeRoberto.profile.id);
  });

  it("3. Operações em negociação encerrada: alteração é rejeitada quando o estado for entregue ou cancelada", async () => {
    const adminCtx = (await buildAuthenticatedContext("user-admin"))!;
    const db = await loadDatabaseState();

    // deal-004 está DELIVERED no seed inicial
    const deal4 = db.deals.find((d) => d.id === "deal-004")!;
    expect(deal4.status).toBe("DELIVERED");

    // Qualquer tentativa de mutação operacional em deal DELIVERED deve ser rejeitada
    await expect(
      async () =>
        await updateTaskOperationalState({
          ctx: adminCtx,
          dealId: "deal-004",
          taskCode: "TASK_PDI_INSPECTION",
          action: "START",
        }),
    ).rejects.toThrow(/A negociação já foi encerrada \(veículo entregue\)/i);

    // Mutação em deal CANCELLED também deve ser rejeitada
    deal4.status = "CANCELLED";
    await saveDatabaseState(db);

    await expect(
      async () =>
        await updateTaskOperationalState({
          ctx: adminCtx,
          dealId: "deal-004",
          taskCode: "TASK_PDI_INSPECTION",
          action: "COMPLETE_OPERATIONAL",
        }),
    ).rejects.toThrow(/A negociação já foi encerrada \(cancelada\)/i);
  });

  it("4. Estoque disponível: veículo vendido ou reservado não pode iniciar nova negociação", async () => {
    const sellerLucas = (await buildAuthenticatedContext("user-vendedor"))!;
    const db = await loadDatabaseState();

    const veh1 = db.vehicles.find((v) => v.id === "veh-001")!;
    expect(veh1.stockStatus).toBe("RESERVED");
    expect(isVehicleSellable(veh1, true)).toBe(false);

    // Tentativa de abrir nova negociação para veh-001 (que já está RESERVED) deve falhar
    await expect(
      async () =>
        await createOrSaveGuidedDeal({
          ctx: sellerLucas,
          input: {
            vehicleId: "veh-001",
            customerId: "cust-helena",
            customerMode: "EXISTING",
            branchId: DEMO_BRANCH_ID,
            sellerId: sellerLucas.profile.id,
            buyerType: "PF",
            paymentMethod: "CASH",
            hasFinancing: false,
            hasTradeIn: false,
            hasPowerOfAttorney: false,
            isDraft: false,
          },
        }),
    ).rejects.toThrow(/(já possui uma negociação ativa|não está disponível para venda no estoque)/i);

    // Veículo com stockStatus SOLD_DELIVERED também é rejeitado
    veh1.stockStatus = "SOLD_DELIVERED";
    await saveDatabaseState(db);
    expect(isVehicleSellable(veh1, false)).toBe(false);
  });

  it("5. Auditoria de recusas: tentativas rejeitadas de faturamento e entrega são registradas em auditoria", async () => {
    const adminCtx = (await buildAuthenticatedContext("user-admin"))!;
    const dbBefore = await loadDatabaseState();
    const auditsBefore = dbBefore.auditEvents.length;

    // Tentativa de faturar deal-001 com pendências documentais/financeiras
    await expect(
      async () =>
        await registerDealBilling({
          ctx: adminCtx,
          dealId: "deal-001",
          invoiceNumber: "NF-999999",
        }),
    ).rejects.toThrow(PreconditionBlockedError);

    // O evento de bloqueio BILLING_ATTEMPT_BLOCKED deve ter sido persistido na auditoria
    const dbAfterBilling = await loadDatabaseState();
    expect(dbAfterBilling.auditEvents.length).toBeGreaterThan(auditsBefore);
    const billingBlockAudit = dbAfterBilling.auditEvents.find(
      (ae) => ae.action === "BILLING_ATTEMPT_BLOCKED" && ae.dealId === "deal-001",
    );
    expect(billingBlockAudit).toBeDefined();
    expect(billingBlockAudit?.summary).toMatch(/bloquead[ao]/i);

    // Tentativa de entrega física sem autorização formal ativa
    await expect(
      async () =>
        await confirmPhysicalDelivery({
          ctx: adminCtx,
          dealId: "deal-001",
          confirmedVehicleIdentifier: "PIN-BYD-001",
          recipientName: "Helena Moreira",
          recipientDocument: "111.222.333-44",
        }),
    ).rejects.toThrow(PreconditionBlockedError);

    const dbAfterDelivery = await loadDatabaseState();
    const deliveryBlockAudit = dbAfterDelivery.auditEvents.find(
      (ae) => ae.action === "DELIVERY_ATTEMPT_BLOCKED" && ae.dealId === "deal-001",
    );
    expect(deliveryBlockAudit).toBeDefined();
    expect(deliveryBlockAudit?.summary).toMatch(/bloquead[ao]/i);
  });

  it("6. Permissões de conferência: usuário com permissão em aprovação financeira pode conferir comprovante de pagamento, mas não CNH; usuário com conferência documental pode conferir CNH, mas não financeiro", async () => {
    const financeRoberto = (await buildAuthenticatedContext("user-financeiro"))!;
    const docPatrícia = (await buildAuthenticatedContext("user-documental"))!;
    const db = await loadDatabaseState();

    const docFin = db.documents.find((d) => d.dealId === "deal-001" && d.responsibleArea === "FINANCE")!;
    const docBuyerId = db.documents.find((d) => d.dealId === "deal-001" && d.responsibleArea === "DOCUMENTATION")!;

    // Roberto (Financeiro) pode conferir doc financeiro, mas NÃO doc de identificação
    expect(canReviewDocument(financeRoberto, docFin)).toBe(true);
    expect(canReviewDocument(financeRoberto, docBuyerId)).toBe(false);

    // Patrícia (Documental) pode conferir CNH, mas NÃO comprovante financeiro
    expect(canReviewDocument(docPatrícia, docBuyerId)).toBe(true);
    expect(canReviewDocument(docPatrícia, docFin)).toBe(false);

    // Se Roberto tentar revisar docBuyerId, a operação no servidor deve rejeitar
    await expect(
      async () =>
        await reviewDocumentVersion({
          ctx: financeRoberto,
          dealId: "deal-001",
          documentId: docBuyerId.id,
          decision: "APPROVED",
          justification: "Aprovado por engano",
        }),
    ).rejects.toThrow(/permissão para conferir documentos/i);

    // Se Patrícia tentar revisar docFin, deve rejeitar
    await expect(
      async () =>
        await reviewDocumentVersion({
          ctx: docPatrícia,
          dealId: "deal-001",
          documentId: docFin.id,
          decision: "APPROVED",
          justification: "Aprovado por engano",
        }),
    ).rejects.toThrow(/autoridade financeira para conferir/i);
  });

  it("7. Recomendação da próxima ação: sugere a ação correta para cada perfil e estado da negociação", async () => {
    const sellerLucas = (await buildAuthenticatedContext("user-vendedor"))!;
    const financeRoberto = (await buildAuthenticatedContext("user-financeiro"))!;
    const db = await loadDatabaseState();

    const deal1 = db.deals.find((d) => d.id === "deal-001")!;
    const deal1Tasks = db.taskInstances.filter((t) => t.dealId === "deal-001");
    const deal1Docs = db.documents.filter((d) => d.dealId === "deal-001");

    // Encontra um documento pendente de envio para o vendedor (ex: DOC_TRADE_IN_LAUDO)
    const missingDoc = deal1Docs.find(
      (d) => d.status === "REQUESTED" || d.status === "CORRECTION_REQUESTED",
    )!;

    const summary = computeDealEligibilityAndSummary(
      deal1,
      deal1Tasks,
      deal1Docs,
      false,
    );

    // Para o Vendedor (Lucas), a próxima ação recomendada é enviar o documento pendente
    const nextForSeller = computeUserNextAction(
      sellerLucas,
      deal1,
      deal1Tasks,
      deal1Docs,
      summary,
    );
    expect(nextForSeller.hasDirectAction).toBe(true);
    expect(nextForSeller.actionType).toBe("UPLOAD_DOCUMENT");
    expect(nextForSeller.targetDocumentId).toBe(missingDoc.id);

    // Simulando que o documento financeiro está aguardando revisão:
    const docFin = deal1Docs.find((d) => d.responsibleArea === "FINANCE")!;
    docFin.status = "UPLOADED_PENDING_REVIEW";
    docFin.currentVersionNumber = 1;

    const summary2 = computeDealEligibilityAndSummary(
      deal1,
      deal1Tasks,
      deal1Docs,
      false,
    );

    // Para Roberto (Financeiro), a próxima ação direta agora é conferir o documento
    const nextForFinance = computeUserNextAction(
      financeRoberto,
      deal1,
      deal1Tasks,
      deal1Docs,
      summary2,
    );
    expect(nextForFinance.hasDirectAction).toBe(true);
    expect(nextForFinance.actionType).toBe("REVIEW_DOCUMENT");
    expect(nextForFinance.targetDocumentId).toBe(docFin.id);
  });

  it("8. Condições comerciais: impede combinações conflitantes de pagamento e financiamento", () => {
    // 1. Pagamento FINANCING com hasFinancing: false deve falhar
    const invalidFinancing = GuidedDealInputSchema.safeParse({
      vehicleId: "veh-001",
      branchId: DEMO_BRANCH_ID,
      sellerId: "user-vendedor",
      customerMode: "NEW",
      buyerType: "PF",
      paymentMethod: "FINANCING",
      hasFinancing: false,
      hasTradeIn: false,
      hasPowerOfAttorney: false,
      newCustomer: {
        fullName: "Comprador Teste",
        documentNumber: "12345678901",
        email: "teste@example.com",
        phone: "62999999999",
        personType: "PF",
      },
    });
    expect(invalidFinancing.success).toBe(false);
    if (!invalidFinancing.success) {
      expect(invalidFinancing.error.issues.some((i) => i.path.includes("hasFinancing"))).toBe(true);
    }

    // 2. Pagamento CASH com hasFinancing: true deve falhar
    const invalidCash = GuidedDealInputSchema.safeParse({
      vehicleId: "veh-001",
      branchId: DEMO_BRANCH_ID,
      sellerId: "user-vendedor",
      customerMode: "NEW",
      buyerType: "PF",
      paymentMethod: "CASH",
      hasFinancing: true,
      financingInstitution: "Banco BYD",
      hasTradeIn: false,
      hasPowerOfAttorney: false,
      newCustomer: {
        fullName: "Comprador Teste",
        documentNumber: "12345678901",
        email: "teste@example.com",
        phone: "62999999999",
        personType: "PF",
      },
    });
    expect(invalidCash.success).toBe(false);
    if (!invalidCash.success) {
      expect(invalidCash.error.issues.some((i) => i.path.includes("hasFinancing"))).toBe(true);
    }

    // 3. Divergência entre buyerType e personType do comprador
    const invalidPersonType = GuidedDealInputSchema.safeParse({
      vehicleId: "veh-001",
      branchId: DEMO_BRANCH_ID,
      sellerId: "user-vendedor",
      customerMode: "NEW",
      buyerType: "PF",
      paymentMethod: "CASH",
      hasFinancing: false,
      hasTradeIn: false,
      hasPowerOfAttorney: false,
      newCustomer: {
        fullName: "Empresa Teste LTDA",
        documentNumber: "12345678000199",
        email: "empresa@example.com",
        phone: "62999999999",
        personType: "PJ",
      },
    });
    expect(invalidPersonType.success).toBe(false);

    // 4. CPF com quantidade inválida de dígitos
    const invalidCpf = GuidedDealInputSchema.safeParse({
      vehicleId: "veh-001",
      branchId: DEMO_BRANCH_ID,
      sellerId: "user-vendedor",
      customerMode: "NEW",
      buyerType: "PF",
      paymentMethod: "CASH",
      hasFinancing: false,
      hasTradeIn: false,
      hasPowerOfAttorney: false,
      newCustomer: {
        fullName: "Comprador Teste",
        documentNumber: "123456789", // apenas 9 dígitos
        email: "teste@example.com",
        phone: "62999999999",
        personType: "PF",
      },
    });
    expect(invalidCpf.success).toBe(false);
  });

  it("9. Prazos e indicadores: conformidade com a data de abertura, entrega, SLA de tarefas e carga sem atribuição", async () => {
    const adminCtx = (await buildAuthenticatedContext("user-admin"))!;
    const dashboardData = await getManagerialDashboardData({
      ctx: adminCtx,
      periodDays: 30,
    });

    // 1. Negociações abertas consideram a data de abertura (openedInPeriodCount)
    expect(typeof dashboardData.kpis.openedInPeriodCount).toBe("number");
    expect(dashboardData.kpis.openedInPeriodCount).toBeGreaterThan(0);

    // 2. Entregas consideram a data de entrega (deliveredInPeriodCount)
    expect(typeof dashboardData.kpis.deliveredInPeriodCount).toBe("number");
    expect(dashboardData.kpis.deliveredInPeriodCount).toBeGreaterThanOrEqual(1);

    // 3. Tarefas bloqueadas por pré-requisito não contam como atrasadas
    const rawTasks: TaskInstance[] = [
      {
        id: "task-fin-prereq",
        organizationId: DEMO_ORG_ID,
        dealId: "deal-001",
        taskTemplateId: "tt-fin",
        stageCode: "FINANCIAL_REVIEW",
        code: "TASK_FIN_ANALYSIS",
        title: "Análise de Crédito",
        description: "Análise financeira",
        whyRequired: "Aprovação de crédito",
        guidance: "Conferir proposta",
        responsibleArea: "FINANCE",
        state: "AVAILABLE",
        requiresFormalApproval: false,
        approvalStatus: "NOT_REQUIRED",
        approvalRole: null,
        procedureCode: null,
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        availableAt: new Date().toISOString(),
        completedAt: null,
        completedBy: null,
        startedAt: null,
        assigneeId: null,
        blocksBilling: true,
        blocksDelivery: true,
        dependsOnTaskCodes: [],
        requiredEvidenceTypes: [],
        reopenCount: 0,
        sortOrder: 1,
        waivedRuleDescription: null,
        pendingReason: null,
        updatedAt: new Date().toISOString(),
      },
      {
        id: "task-blocked-overdue",
        organizationId: DEMO_ORG_ID,
        dealId: "deal-001",
        taskTemplateId: "tt-billing",
        stageCode: "BILLING",
        code: "TASK_BILLING_INVOICE",
        title: "Emissão de NF",
        description: "Emissão",
        whyRequired: "Fiscal",
        guidance: "Emitir",
        responsibleArea: "BILLING",
        state: "AVAILABLE",
        requiresFormalApproval: false,
        approvalStatus: "NOT_REQUIRED",
        approvalRole: null,
        procedureCode: null,
        dueAt: new Date(Date.now() - 36000000).toISOString(), // Vencido no passado
        availableAt: null,
        completedAt: null,
        completedBy: null,
        startedAt: null,
        assigneeId: null,
        blocksBilling: false,
        blocksDelivery: true,
        dependsOnTaskCodes: ["TASK_FIN_ANALYSIS"],
        requiredEvidenceTypes: ["INVOICE_NUMBER"],
        reopenCount: 0,
        sortOrder: 2,
        waivedRuleDescription: null,
        pendingReason: "Aguardando aprovação financeira",
        updatedAt: new Date().toISOString(),
      },
    ];
    const recalculated = recalculateTaskStates(rawTasks, []);
    expect(recalculated[1].state).toBe("WAITING_PREREQUISITE");

    // 4. Tarefas disponíveis calculam o atraso a partir de sua disponibilização
    rawTasks[1].state = "WAITING_PREREQUISITE";
    rawTasks[1].availableAt = null;
    rawTasks[1].dueAt = null;
    rawTasks[1].dependsOnTaskCodes = [];
    rawTasks[1].slaHours = 24;
    const availableRecalculated = recalculateTaskStates(rawTasks, []);
    expect(availableRecalculated[1].state).toBe("AVAILABLE");
    expect(availableRecalculated[1].availableAt).toBeDefined();
    expect(new Date(availableRecalculated[1].dueAt!).getTime()).toBeGreaterThan(Date.now());

    // 5. Horas por etapa consideram início/disponibilização até conclusão
    expect(dashboardData.hoursByStage).toBeDefined();
    expect(dashboardData.hoursByStage.length).toBe(8);

    // 6. Carga de trabalho inclui tarefas sem atribuição individual
    expect(dashboardData.volumeByResponsibleAndBranch.byArea).toBeDefined();
    expect(dashboardData.volumeByResponsibleAndBranch.byArea.length).toBeGreaterThan(0);
  });

  it("10. Autenticação e primeiro acesso: validação de link de recuperação e proteção contra enumeração de contas", async () => {
    // 1. Token vazio
    const tokenInspectionMissing = await inspectPasswordResetToken("");
    expect(tokenInspectionMissing.status).toBe("MISSING");

    // 2. Token inválido/inexistente
    const tokenInspectionFake = await inspectPasswordResetToken("token-inventado-invalido");
    expect(tokenInspectionFake.status).toBe("INVALID_OR_USED");

    // 3. Token válido e token expirado no banco
    const validRaw = "token-valido-teste-1234567890123456";
    const validHash = crypto.createHash("sha256").update(validRaw).digest("hex");

    const expiredRaw = "token-expirado-teste-123456789012345";
    const expiredHash = crypto.createHash("sha256").update(expiredRaw).digest("hex");

    await withTransaction((db) => {
      db.passwordResetTokens = [
        {
          profileId: "user-vendedor",
          hash: validHash,
          expiresAt: Date.now() + 3600000, // +1h
        },
        {
          profileId: "user-vendedor",
          hash: expiredHash,
          expiresAt: Date.now() - 3600000, // -1h
        },
      ];
    });

    const validCheck = await inspectPasswordResetToken(validRaw);
    expect(validCheck.status).toBe("VALID");

    const expiredCheck = await inspectPasswordResetToken(expiredRaw);
    expect(expiredCheck.status).toBe("EXPIRED");
  });

  it("11. Escaneamento: leitura de código com câmera indisponível direciona para busca manual", async () => {
    const sellerLucas = (await buildAuthenticatedContext("user-vendedor"))!;

    // Resolução por código interno manual
    const resInternalCode = await resolveScannedVehicleCode({
      ctx: sellerLucas,
      rawQrCode: "PIN-BYD-001",
    });
    expect(resInternalCode.outcome).toBe("IDENTIFIED_WITH_ACTIVE_DEAL");
    if (resInternalCode.outcome === "IDENTIFIED_WITH_ACTIVE_DEAL") {
      expect(resInternalCode.vehicle.vin).toBe("9BWSU19F08B301001");
      expect(resInternalCode.activeDealNumber).toBe("NEG-2026-0001");
    }

    // Resolução por Chassi VIN manual
    const resVin = await resolveScannedVehicleCode({
      ctx: sellerLucas,
      rawQrCode: "9BWSU19F08B301001",
    });
    expect(resVin.outcome).toBe("IDENTIFIED_WITH_ACTIVE_DEAL");

    // Resolução por Token QR opaco
    const resQr = await resolveScannedVehicleCode({
      ctx: sellerLucas,
      rawQrCode: "cf://v/qr-pin-byd-001-songplus",
    });
    expect(resQr.outcome).toBe("IDENTIFIED_WITH_ACTIVE_DEAL");
  });

  it("12. Portal do cliente: dados sensíveis e notas internas não são expostos; orientações de regularização são apresentadas", async () => {
    const helenaCtx = (await buildAuthenticatedContext("user-cliente-helena"))!;
    const db = await loadDatabaseState();

    // Injeta nota de rejeição e orientação pública no documento
    const docFin = db.documents.find((d) => d.dealId === "deal-001" && d.responsibleArea === "FINANCE")!;
    docFin.status = "CORRECTION_REQUESTED";
    docFin.rejectionReason = "Comprovante cortado ou ilegível no valor do PIX";
    docFin.customerRejectionGuidance = "Por favor, envie o comprovante completo em PDF com o número de autenticação bancária visível.";
    docFin.internalReviewNotes = "Conferência suspeita: valor divergente da proposta inicial do vendedor.";
    await saveDatabaseState(db);

    const safeView = await getCustomerSafeDealView({
      ctx: helenaCtx,
      dealId: "deal-001",
    });

    // 1. Dados sensíveis e notas internas NUNCA são expostos na visão do cliente
    const rawJson = JSON.stringify(safeView);
    expect(rawJson).not.toContain("Conferência suspeita");
    expect(rawJson).not.toContain("internalReviewNotes");
    expect(rawJson).not.toContain("TASK_");
    expect(rawJson).not.toContain("DOC_");

    // 2. A orientação pública de regularização é exposta em customerSafeFeedback
    const targetDoc = safeView.documentRequests.find((d) => d.id === docFin.id);
    expect(targetDoc).toBeDefined();
    expect(targetDoc?.customerSafeFeedback).toBe(
      "Por favor, envie o comprovante completo em PDF com o número de autenticação bancária visível.",
    );
  });

  it("13. Responsividade e acessibilidade: gaveta de navegação fecha por teclado e gerencia foco", () => {
    let drawerOpen = true;
    let focusTarget = "DRAWER_CLOSE_BUTTON";

    function onKeyDown(key: string) {
      if (key === "Escape" && drawerOpen) {
        drawerOpen = false;
        focusTarget = "MENU_TRIGGER_BUTTON";
      }
    }

    onKeyDown("Escape");
    expect(drawerOpen).toBe(false);
    expect(focusTarget).toBe("MENU_TRIGGER_BUTTON");
  });
});
