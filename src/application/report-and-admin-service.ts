import {
  assertInternalStaff,
  assertPermission,
  validateStaffAssigneeForArea,
} from "@/domain/permissions";
import {
  AREA_LABELS,
  AuthenticatedContext,
  ProcedureSection,
  ResponsibleArea,
  WORKFLOW_STAGES,
} from "@/domain/types";
import { computeDealEligibilityAndSummary } from "@/domain/workflow-engine";
import { loadDatabaseState, withTransaction } from "@/infrastructure/database";
import crypto from "crypto";
import { isDealActiveStatus } from "./vehicle-service";

// ============================================================================
// FUNCIONALIDADE 11 — NOTIFICAÇÕES INTERNAS
// ============================================================================

export async function listNotificationsForUser(ctx: AuthenticatedContext) {
  const db = await loadDatabaseState();
  return db.notifications
    .filter(
      (n) =>
        n.organizationId === ctx.organization.id &&
        n.recipientProfileId === ctx.profile.id,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markNotificationAsRead(params: {
  ctx: AuthenticatedContext;
  notificationId?: string;
  markAll?: boolean;
}) {
  const { ctx, notificationId, markAll } = params;
  return await withTransaction((db) => {
    const nowIso = new Date().toISOString();
    for (const n of db.notifications) {
      if (
        n.organizationId === ctx.organization.id &&
        n.recipientProfileId === ctx.profile.id
      ) {
        if (markAll || n.id === notificationId) {
          n.isRead = true;
          n.readAt = nowIso;
        }
      }
    }
  });
}

// ============================================================================
// FUNCIONALIDADE 12 — PAINEL GERENCIAL (DADOS REAIS DO BANCO)
// ============================================================================

export interface ManagerialDashboardData {
  filtersApplied: {
    periodDays: number;
    sellerId: string;
    vehicleModel: string;
    statusFilter: string;
  };
  availableFilterOptions: {
    sellers: Array<{ id: string; fullName: string }>;
    models: string[];
  };
  kpis: {
    activeDealsCount: number;
    openedInPeriodCount: number;
    waitingDocumentsCount: number;
    waitingFinancialAnalysisCount: number;
    waitingDocumentAnalysisCount: number;
    eligibleForAuthorizationCount: number;
    deliveryAuthorizedCount: number;
    deliveredInPeriodCount: number;
    overdueTasksCount: number;
  };
  indicatorDefinitions: Record<string, string>;
  dealsByStage: Array<{
    stageCode: string;
    stageName: string;
    count: number;
  }>;
  pendingByReason: Array<{
    reasonCategory: string;
    count: number;
  }>;
  medianSaleToDeliveryHours: number | null;
  hoursByStage: Array<{
    stageCode: string;
    stageName: string;
    avgHours: number | null;
    sampleSize: number;
  }>;
  reworkByDeal: Array<{
    dealId: string;
    dealNumber: string;
    vehicleLabel: string;
    reopenAndRejectionCount: number;
    documentVersionsExtraCount: number;
    totalReworkEvents: number;
  }>;
  volumeByResponsibleAndBranch: {
    byResponsible: Array<{
      profileId: string;
      fullName: string;
      openTasks: number;
      completedTasks: number;
    }>;
    byArea: Array<{
      area: ResponsibleArea;
      areaLabel: string;
      openTasks: number;
      unassignedOpenTasks: number;
      completedTasks: number;
    }>;
    byBranch: Array<{
      branchId: string;
      branchName: string;
      activeDeals: number;
      deliveredDeals: number;
    }>;
    unassignedTasksCount: number;
  };
}

export async function getManagerialDashboardData(params: {
  ctx: AuthenticatedContext;
  periodDays?: number;
  sellerId?: string;
  vehicleModel?: string;
  statusFilter?: string;
}): Promise<ManagerialDashboardData> {
  const { ctx } = params;
  assertInternalStaff(ctx);
  assertPermission(
    ctx,
    "report:view",
    "Sua função não possui permissão para acessar o Painel Gerencial.",
  );

  const periodDays = params.periodDays ?? 30;
  const sellerId = params.sellerId ?? "ALL";
  const vehicleModel = params.vehicleModel ?? "ALL";
  const statusFilter = params.statusFilter ?? "ALL";

  const db = await loadDatabaseState();
  const nowMs = Date.now();
  const cutoffMs = nowMs - periodDays * 24 * 60 * 60 * 1000;

  const orgVehicles = db.vehicles.filter(
    (v) => v.organizationId === ctx.organization.id,
  );
  const vehMap = new Map(orgVehicles.map((v) => [v.id, v]));
  const delivMap = new Map(
    db.deliveries
      .filter((del) => del.organizationId === ctx.organization.id)
      .map((del) => [del.dealId, del]),
  );

  // Negociações da organização filtradas por vendedor, modelo e status.
  // Uma negociação entra no recorte do período se:
  // - Está atualmente ativa (em andamento/elegível/autorizada), OU
  // - Foi aberta no período (createdAt >= cutoffMs), OU
  // - Foi entregue no período (delivery.deliveredAt >= cutoffMs).
  const filteredDeals = db.deals.filter((d) => {
    if (d.organizationId !== ctx.organization.id) return false;
    if (sellerId !== "ALL" && d.sellerId !== sellerId) return false;
    if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
    if (vehicleModel !== "ALL") {
      const veh = vehMap.get(d.vehicleId);
      if (!veh || veh.model !== vehicleModel) return false;
    }
    const createdInPeriod = new Date(d.createdAt).getTime() >= cutoffMs;
    const deliv = delivMap.get(d.id);
    const deliveredInPeriod =
      d.status === "DELIVERED" &&
      deliv !== undefined &&
      new Date(deliv.deliveredAt).getTime() >= cutoffMs;
    return isDealActiveStatus(d.status) || createdInPeriod || deliveredInPeriod;
  });

  const filteredDealIds = new Set(filteredDeals.map((d) => d.id));
  const orgTasks = db.taskInstances.filter(
    (t) =>
      t.organizationId === ctx.organization.id && filteredDealIds.has(t.dealId),
  );
  const orgDocs = db.documents.filter(
    (d) =>
      d.organizationId === ctx.organization.id && filteredDealIds.has(d.dealId),
  );

  let activeDealsCount = 0;
  let openedInPeriodCount = 0;
  let waitingDocumentsCount = 0;
  let waitingFinancialAnalysisCount = 0;
  let waitingDocumentAnalysisCount = 0;
  let eligibleForAuthorizationCount = 0;
  let deliveryAuthorizedCount = 0;
  let deliveredInPeriodCount = 0;

  for (const deal of filteredDeals) {
    const dealTasks = orgTasks.filter((t) => t.dealId === deal.id);
    const dealDocs = orgDocs.filter((d) => d.dealId === deal.id);
    const hasActiveAuth = db.releaseAuthorizations.some(
      (ra) => ra.dealId === deal.id && ra.status === "ACTIVE",
    );
    const summary = computeDealEligibilityAndSummary(
      deal,
      dealTasks,
      dealDocs,
      hasActiveAuth,
    );

    if (new Date(deal.createdAt).getTime() >= cutoffMs) {
      openedInPeriodCount++;
    }

    if (isDealActiveStatus(deal.status)) {
      activeDealsCount++;
    }
    if (
      deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      (summary.deliveryEligible && deal.status === "ACTIVE")
    ) {
      eligibleForAuthorizationCount++;
    }
    if (deal.status === "DELIVERY_AUTHORIZED") {
      deliveryAuthorizedCount++;
    }
    if (deal.status === "DELIVERED") {
      const deliv = delivMap.get(deal.id);
      const deliveredTimestamp = deliv
        ? new Date(deliv.deliveredAt).getTime()
        : new Date(deal.updatedAt).getTime();
      if (deliveredTimestamp >= cutoffMs) {
        deliveredInPeriodCount++;
      }
    }

    if (isDealActiveStatus(deal.status)) {
      const hasMissingDoc = dealDocs.some(
        (d) =>
          d.status === "REQUESTED" ||
          d.status === "REJECTED" ||
          d.status === "CORRECTION_REQUESTED",
      );
      if (hasMissingDoc) waitingDocumentsCount++;

      const hasPendingFin = dealTasks.some(
        (t) =>
          t.responsibleArea === "FINANCE" &&
          t.state !== "COMPLETED" &&
          t.state !== "WAIVED_BY_RULE",
      );
      if (hasPendingFin) waitingFinancialAnalysisCount++;

      const hasPendingDocReview =
        dealDocs.some(
          (d) =>
            d.status === "UPLOADED_PENDING_REVIEW" || d.status === "OUTDATED",
        ) ||
        dealTasks.some(
          (t) =>
            t.responsibleArea === "DOCUMENTATION" && t.state === "IN_REVIEW",
        );
      if (hasPendingDocReview) waitingDocumentAnalysisCount++;
    }
  }

  // Tarefas bloqueadas por pré-requisito (WAITING_PREREQUISITE) não contam como atrasadas antes de ficarem disponíveis
  const overdueTasksCount = orgTasks.filter(
    (t) =>
      t.state !== "WAITING_PREREQUISITE" &&
      t.state !== "COMPLETED" &&
      t.state !== "WAIVED_BY_RULE" &&
      t.state !== "CANCELLED" &&
      t.dueAt !== null &&
      new Date(t.dueAt).getTime() < nowMs,
  ).length;

  const dealsByStage = WORKFLOW_STAGES.map((st) => ({
    stageCode: st.code,
    stageName: st.name,
    count: filteredDeals.filter((d) => d.currentStage === st.code).length,
  }));

  // Pendências por motivo
  const pendingReasonCounts: Record<string, number> = {
    "Documento aguardando envio pelo comercial/comprador": 0,
    "Documento enviado aguardando conferência": 0,
    "Aguardando aprovação formal do Financeiro": 0,
    "Aguardando emissão de Nota Fiscal (Faturamento)": 0,
    "Aguardando preparação física (PDI)": 0,
    "Aguardando autorização ou entrega física": 0,
  };

  for (const doc of orgDocs) {
    const parentDeal = filteredDeals.find((d) => d.id === doc.dealId);
    if (!parentDeal || !isDealActiveStatus(parentDeal.status)) continue;
    if (
      doc.status === "REQUESTED" ||
      doc.status === "REJECTED" ||
      doc.status === "CORRECTION_REQUESTED"
    ) {
      pendingReasonCounts[
        "Documento aguardando envio pelo comercial/comprador"
      ]++;
    } else if (
      doc.status === "UPLOADED_PENDING_REVIEW" ||
      doc.status === "OUTDATED"
    ) {
      pendingReasonCounts["Documento enviado aguardando conferência"]++;
    }
  }

  for (const t of orgTasks) {
    const parentDeal = filteredDeals.find((d) => d.id === t.dealId);
    if (!parentDeal || !isDealActiveStatus(parentDeal.status)) continue;
    if (t.state === "COMPLETED" || t.state === "WAIVED_BY_RULE") continue;
    if (t.responsibleArea === "FINANCE") {
      pendingReasonCounts["Aguardando aprovação formal do Financeiro"]++;
    } else if (t.code === "TASK_BILLING_INVOICE") {
      pendingReasonCounts["Aguardando emissão de Nota Fiscal (Faturamento)"]++;
    } else if (t.code === "TASK_PDI_PREPARATION") {
      pendingReasonCounts["Aguardando preparação física (PDI)"]++;
    } else if (
      t.code === "TASK_RELEASE_AUTH" ||
      t.code === "TASK_CONFIRM_DELIVERY"
    ) {
      pendingReasonCounts["Aguardando autorização ou entrega física"]++;
    }
  }

  const pendingByReason = Object.entries(pendingReasonCounts).map(
    ([reasonCategory, count]) => ({
      reasonCategory,
      count,
    }),
  );

  // Cálculo do tempo mediano real entre venda (deal.createdAt) e entrega (delivery.deliveredAt) para entregas ocorridas no período
  const saleToDeliveryDurationsHours: number[] = [];
  for (const deal of filteredDeals.filter((d) => d.status === "DELIVERED")) {
    const deliv = delivMap.get(deal.id);
    if (deliv && new Date(deliv.deliveredAt).getTime() >= cutoffMs) {
      const diffMs =
        new Date(deliv.deliveredAt).getTime() -
        new Date(deal.createdAt).getTime();
      if (diffMs > 0) {
        saleToDeliveryDurationsHours.push(
          Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10,
        );
      }
    }
  }

  saleToDeliveryDurationsHours.sort((a, b) => a - b);
  let medianSaleToDeliveryHours: number | null = null;
  if (saleToDeliveryDurationsHours.length > 0) {
    const mid = Math.floor(saleToDeliveryDurationsHours.length / 2);
    medianSaleToDeliveryHours =
      saleToDeliveryDurationsHours.length % 2 !== 0
        ? saleToDeliveryDurationsHours[mid]
        : Math.round(
            ((saleToDeliveryDurationsHours[mid - 1] +
              saleToDeliveryDurationsHours[mid]) /
              2) *
              10,
          ) / 10;
  }

  // Tempo médio de execução das tarefas concluídas em cada etapa (desde liberação/início até conclusão)
  const hoursByStage = WORKFLOW_STAGES.map((st) => {
    const completedInStage = orgTasks.filter(
      (t) =>
        t.stageCode === st.code &&
        t.state === "COMPLETED" &&
        t.completedAt !== null,
    );
    const durations: number[] = [];
    for (const ct of completedInStage) {
      const parentDeal = filteredDeals.find((d) => d.id === ct.dealId);
      const startRef = ct.startedAt ?? ct.availableAt ?? parentDeal?.createdAt;
      if (startRef && ct.completedAt) {
        const diffH =
          (new Date(ct.completedAt).getTime() - new Date(startRef).getTime()) /
          (1000 * 60 * 60);
        if (diffH >= 0) {
          durations.push(diffH);
        }
      }
    }
    const avgHours =
      durations.length > 0
        ? Math.round(
            (durations.reduce((acc, v) => acc + v, 0) / durations.length) * 10,
          ) / 10
        : null;
    return {
      stageCode: st.code,
      stageName: st.name,
      avgHours,
      sampleSize: durations.length,
    };
  });

  // Retrabalho por negociação
  const reworkByDeal = filteredDeals.map((d) => {
    const veh = vehMap.get(d.vehicleId);
    const dealTasks = orgTasks.filter((t) => t.dealId === d.id);
    const dealDocs = orgDocs.filter((doc) => doc.dealId === d.id);

    const reopenCount = dealTasks.reduce((acc, t) => acc + t.reopenCount, 0);
    const rejectedApprCount = db.approvalRecords.filter(
      (ar) =>
        ar.dealId === d.id &&
        (ar.decision === "REJECTED" ||
          ar.decision === "CORRECTION_REQUESTED" ||
          ar.status === "OUTDATED"),
    ).length;

    const extraDocVersions = dealDocs.reduce(
      (acc, doc) => acc + Math.max(0, doc.currentVersionNumber - 1),
      0,
    );

    return {
      dealId: d.id,
      dealNumber: d.dealNumber,
      vehicleLabel: veh ? `${veh.internalCode} (${veh.model})` : d.dealNumber,
      reopenAndRejectionCount: reopenCount + rejectedApprCount,
      documentVersionsExtraCount: extraDocVersions,
      totalReworkEvents: reopenCount + rejectedApprCount + extraDocVersions,
    };
  });

  // Volume por responsável, área e unidade (incluindo tarefas sem responsável nominal)
  const internalMembers = db.memberships.filter(
    (m) =>
      m.organizationId === ctx.organization.id &&
      m.isActive &&
      !m.roles.includes("CUSTOMER"),
  );
  const byResponsible = internalMembers.map((m) => {
    const p = db.profiles.find((pr) => pr.id === m.profileId)!;
    const assigned = orgTasks.filter((t) => t.assigneeId === p.id);
    return {
      profileId: p.id,
      fullName: p.fullName,
      openTasks: assigned.filter(
        (t) =>
          t.state !== "COMPLETED" &&
          t.state !== "WAIVED_BY_RULE" &&
          t.state !== "CANCELLED",
      ).length,
      completedTasks: assigned.filter((t) => t.state === "COMPLETED").length,
    };
  });

  const unassignedTasks = orgTasks.filter((t) => !t.assigneeId);
  const unassignedOpenCount = unassignedTasks.filter(
    (t) =>
      t.state !== "COMPLETED" &&
      t.state !== "WAIVED_BY_RULE" &&
      t.state !== "CANCELLED",
  ).length;
  const unassignedCompletedCount = unassignedTasks.filter(
    (t) => t.state === "COMPLETED",
  ).length;

  if (unassignedOpenCount > 0 || unassignedCompletedCount > 0) {
    byResponsible.push({
      profileId: "unassigned",
      fullName: "Fila da área (sem responsável nominal)",
      openTasks: unassignedOpenCount,
      completedTasks: unassignedCompletedCount,
    });
  }

  const allAreas: ResponsibleArea[] = [
    "COMMERCIAL",
    "DOCUMENTATION",
    "FINANCE",
    "BILLING",
    "OPERATIONS",
    "RELEASE",
    "MANAGEMENT",
  ];
  const byArea = allAreas.map((area) => {
    const areaTasks = orgTasks.filter((t) => t.responsibleArea === area);
    const openAreaTasks = areaTasks.filter(
      (t) =>
        t.state !== "COMPLETED" &&
        t.state !== "WAIVED_BY_RULE" &&
        t.state !== "CANCELLED",
    );
    return {
      area,
      areaLabel: AREA_LABELS[area],
      openTasks: openAreaTasks.length,
      unassignedOpenTasks: openAreaTasks.filter((t) => !t.assigneeId).length,
      completedTasks: areaTasks.filter((t) => t.state === "COMPLETED").length,
    };
  });

  const orgBranches = db.branches.filter(
    (b) => b.organizationId === ctx.organization.id,
  );
  const byBranch = orgBranches.map((b) => ({
    branchId: b.id,
    branchName: b.name,
    activeDeals: filteredDeals.filter(
      (d) => d.branchId === b.id && isDealActiveStatus(d.status),
    ).length,
    deliveredDeals: filteredDeals.filter((d) => {
      if (d.branchId !== b.id || d.status !== "DELIVERED") return false;
      const deliv = delivMap.get(d.id);
      const ts = deliv
        ? new Date(deliv.deliveredAt).getTime()
        : new Date(d.updatedAt).getTime();
      return ts >= cutoffMs;
    }).length,
  }));

  const sellers = internalMembers
    .filter((m) => m.roles.includes("SELLER") || m.roles.includes("MANAGER"))
    .map((m) => {
      const p = db.profiles.find((pr) => pr.id === m.profileId)!;
      return { id: p.id, fullName: p.fullName };
    });

  const models = Array.from(new Set(orgVehicles.map((v) => v.model)));

  return {
    filtersApplied: {
      periodDays,
      sellerId,
      vehicleModel,
      statusFilter,
    },
    availableFilterOptions: {
      sellers,
      models,
    },
    kpis: {
      activeDealsCount,
      openedInPeriodCount,
      waitingDocumentsCount,
      waitingFinancialAnalysisCount,
      waitingDocumentAnalysisCount,
      eligibleForAuthorizationCount,
      deliveryAuthorizedCount,
      deliveredInPeriodCount,
      overdueTasksCount,
    },
    indicatorDefinitions: {
      activeDealsCount:
        "Negociações com passaporte aberto em andamento, elegíveis para autorização ou autorizadas aguardando entrega física.",
      openedInPeriodCount:
        "Negociações abertas dentro do período selecionado (com base na data de abertura da negociação).",
      waitingDocumentsCount:
        "Negociações ativas que possuem pelo menos um documento obrigatório solicitado, rejeitado ou aguardando correção.",
      waitingFinancialAnalysisCount:
        "Negociações ativas com tarefas de conferência financeira pendentes de conclusão ou aprovação formal.",
      waitingDocumentAnalysisCount:
        "Negociações ativas com arquivos enviados aguardando revisão da área Documental.",
      eligibleForAuthorizationCount:
        "Negociações que cumpriram 100% dos pré-requisitos (financeiros, documentais, faturamento e preparação) e estão prontas para emissão da autorização.",
      deliveryAuthorizedCount:
        "Negociações com Autorização Formal de Entrega ativa, aguardando reconfirmação do chassi e entrega das chaves pela Operação.",
      deliveredInPeriodCount:
        "Veículos cuja entrega física das chaves foi confirmada dentro do período filtrado (com base na data real de entrega).",
      overdueTasksCount:
        "Tarefas já disponíveis para execução e não concluídas cujo prazo operacional (SLA) foi ultrapassado (tarefas ainda bloqueadas por pré-requisito não entram como atrasadas).",
      hoursByStage:
        "Tempo médio de execução das tarefas concluídas em cada etapa (da liberação/início da tarefa até sua conclusão).",
    },
    dealsByStage,
    pendingByReason,
    medianSaleToDeliveryHours,
    hoursByStage,
    reworkByDeal,
    volumeByResponsibleAndBranch: {
      byResponsible,
      byArea,
      byBranch,
      unassignedTasksCount: byArea.reduce(
        (acc, a) => acc + (a.unassignedOpenTasks || 0),
        0,
      ),
    },
  };
}

// ============================================================================
// FUNCIONALIDADE 13 — PROCEDIMENTOS E ADMINISTRAÇÃO
// ============================================================================

export async function listProceduresForOrg(ctx: AuthenticatedContext) {
  assertInternalStaff(ctx);
  const db = await loadDatabaseState();

  const procs = db.procedures.filter(
    (p) => p.organizationId === ctx.organization.id,
  );
  const versions = db.procedureVersions
    .filter((pv) => pv.organizationId === ctx.organization.id)
    .sort((a, b) => b.versionNumber - a.versionNumber);

  return procs.map((proc) => {
    const procVersions = versions
      .filter((v) => v.procedureId === proc.id)
      .map((v) => ({
        ...v,
        authorName:
          db.profiles.find((pr) => pr.id === v.authorId)?.fullName ?? "Autor",
      }));
    const publishedVersion =
      procVersions.find((v) => v.id === proc.activeVersionId) ?? null;

    return {
      ...proc,
      areaLabel: AREA_LABELS[proc.responsibleArea],
      publishedVersion,
      allVersions: procVersions,
    };
  });
}

export async function createOrPublishProcedureVersion(params: {
  ctx: AuthenticatedContext;
  procedureId?: string;
  code: string;
  title: string;
  responsibleArea: ResponsibleArea;
  content: string;
  sections: ProcedureSection[];
  publishImmediately: boolean;
}) {
  const { ctx } = params;
  assertInternalStaff(ctx);
  assertPermission(
    ctx,
    "procedure:manage",
    "Sua função não possui permissão para criar ou publicar procedimentos.",
  );

  return await withTransaction((db) => {
    const nowIso = new Date().toISOString();
    let proc = params.procedureId
      ? db.procedures.find(
          (p) =>
            p.id === params.procedureId &&
            p.organizationId === ctx.organization.id,
        )
      : db.procedures.find(
          (p) =>
            p.code.toUpperCase() === params.code.trim().toUpperCase() &&
            p.organizationId === ctx.organization.id,
        );

    if (!proc) {
      proc = {
        id: `proc-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: ctx.organization.id,
        code: params.code.trim().toUpperCase(),
        title: params.title.trim(),
        responsibleArea: params.responsibleArea,
        activeVersionId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.procedures.push(proc);
    } else {
      proc.title = params.title.trim();
      proc.responsibleArea = params.responsibleArea;
      proc.updatedAt = nowIso;
    }

    const existingVersions = db.procedureVersions.filter(
      (pv) => pv.procedureId === proc!.id,
    );
    const nextVersionNum =
      existingVersions.reduce((max, v) => Math.max(max, v.versionNumber), 0) +
      1;

    const newVerId = `proc-ver-${crypto.randomUUID().slice(0, 8)}`;

    if (params.publishImmediately) {
      for (const ev of existingVersions) {
        if (ev.status === "PUBLISHED") {
          ev.status = "ARCHIVED";
        }
      }
      proc.activeVersionId = newVerId;
    }

    const newVer = {
      id: newVerId,
      organizationId: ctx.organization.id,
      procedureId: proc.id,
      versionNumber: nextVersionNum,
      status: params.publishImmediately
        ? ("PUBLISHED" as const)
        : ("DRAFT" as const),
      title: params.title.trim(),
      responsibleArea: params.responsibleArea,
      content: params.content.trim(),
      sections:
        params.sections.length > 0
          ? params.sections
          : [
              {
                sectionNumber: "1.1",
                heading: "Diretrizes Operacionais",
                body: params.content.trim(),
              },
            ],
      authorId: ctx.profile.id,
      publishedAt: params.publishImmediately ? nowIso : null,
      createdAt: nowIso,
    };

    db.procedureVersions.push(newVer);

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: null,
      vehicleId: null,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: ctx.roles.join(","),
      action: params.publishImmediately
        ? "PROCEDURE_VERSION_PUBLISHED"
        : "PROCEDURE_DRAFT_SAVED",
      entityType: "PROCEDURE",
      entityId: proc.id,
      summary: params.publishImmediately
        ? `Procedimento '${proc.title}' publicado na versão v${nextVersionNum} por ${ctx.profile.fullName}.`
        : `Rascunho v${nextVersionNum} do procedimento '${proc.title}' salvo por ${ctx.profile.fullName}.`,
      metadata: {
        procedureCode: proc.code,
        versionNumber: nextVersionNum,
        status: newVer.status,
      },
      isCustomerVisible: false,
      createdAt: nowIso,
    });

    return { procedure: proc, version: newVer };
  });
}

export async function publishExistingDraftProcedureVersion(params: {
  ctx: AuthenticatedContext;
  versionId: string;
}) {
  const { ctx, versionId } = params;
  assertInternalStaff(ctx);
  assertPermission(ctx, "procedure:manage");

  return await withTransaction((db) => {
    const ver = db.procedureVersions.find(
      (pv) => pv.id === versionId && pv.organizationId === ctx.organization.id,
    );
    if (!ver) throw new Error("Versão de procedimento não encontrada.");

    const proc = db.procedures.find((p) => p.id === ver.procedureId);
    if (!proc) throw new Error("Procedimento não encontrado.");

    const nowIso = new Date().toISOString();
    for (const other of db.procedureVersions.filter(
      (pv) => pv.procedureId === proc.id && pv.status === "PUBLISHED",
    )) {
      other.status = "ARCHIVED";
    }

    ver.status = "PUBLISHED";
    ver.publishedAt = nowIso;
    proc.activeVersionId = ver.id;
    proc.title = ver.title;
    proc.updatedAt = nowIso;

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: null,
      vehicleId: null,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: ctx.roles.join(","),
      action: "PROCEDURE_VERSION_PUBLISHED",
      entityType: "PROCEDURE",
      entityId: proc.id,
      summary: `Versão v${ver.versionNumber} do procedimento '${proc.title}' promovida de Rascunho para Publicado.`,
      metadata: { versionNumber: ver.versionNumber },
      isCustomerVisible: false,
      createdAt: nowIso,
    });

    return ver;
  });
}

export async function updateTaskTemplateSlaAndDefaultAssignee(params: {
  ctx: AuthenticatedContext;
  taskTemplateId: string;
  slaHours: number;
  defaultAssigneeId: string | null;
}) {
  const { ctx, taskTemplateId, slaHours, defaultAssigneeId } = params;
  assertInternalStaff(ctx);
  assertPermission(ctx, "procedure:manage");
  if (!Number.isInteger(slaHours) || slaHours < 1 || slaHours > 720)
    throw new Error("Informe um prazo inteiro de 1 a 720 horas.");

  return await withTransaction((db) => {
    const tpl = db.taskTemplates.find(
      (t) =>
        t.id === taskTemplateId && t.organizationId === ctx.organization.id,
    );
    if (!tpl) throw new Error("Template de tarefa não encontrado.");

    if (defaultAssigneeId) {
      validateStaffAssigneeForArea({
        profileId: defaultAssigneeId,
        organizationId: ctx.organization.id,
        responsibleArea: tpl.responsibleArea,
        profiles: db.profiles,
        memberships: db.memberships,
      });
    }
    if (
      tpl.slaHours === slaHours &&
      tpl.defaultAssigneeId === (defaultAssigneeId || null)
    )
      return tpl;
    tpl.slaHours = slaHours;
    tpl.defaultAssigneeId = defaultAssigneeId || null;

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: null,
      vehicleId: null,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: ctx.roles.join(","),
      action: "WORKFLOW_SLA_UPDATED",
      entityType: "TASK_TEMPLATE",
      entityId: tpl.id,
      summary: `Prazo operacional (SLA) da tarefa '${tpl.title}' atualizado para ${tpl.slaHours}h.`,
      metadata: { slaHours: tpl.slaHours, defaultAssigneeId },
      isCustomerVisible: false,
      createdAt: new Date().toISOString(),
    });

    return tpl;
  });
}
