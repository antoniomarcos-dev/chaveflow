import crypto from "crypto";
import {
  AREA_LABELS,
  ApprovalRecord,
  AuditEvent,
  AuthenticatedContext,
  Branch,
  Customer,
  Deal,
  DealDocument,
  DeliveryRecord,
  DocumentVersion,
  GuidedDealInputSchema,
  ProcedureVersion,
  ReleaseAuthorization,
  ResponsibleArea,
  RoleCode,
  TaskInstance,
  TradeInVehicle,
  UserProfile,
  Vehicle,
  WorkflowVersion,
} from "@/domain/types";
import {
  assertInternalStaff,
  assertOrganizationAccess,
  assertPermission,
  AuthorizationError,
  canActOnArea,
  canApproveTaskRole,
  hasPermission,
} from "@/domain/permissions";
import {
  computeDealEligibilityAndSummary,
  computeUserNextAction,
  DealBlocker,
  DealEligibilitySummary,
  instantiateDealWorkflow,
  isTaskSatisfiedAsDependency,
  recalculateTaskStates,
  UserNextActionRecommendation,
} from "@/domain/workflow-engine";
import {
  createTemporaryDocumentToken,
  loadDatabaseState,
  savePrivateFileBlob,
  validateServerUploadFile,
  withTransaction,
} from "@/infrastructure/database";
import { isDealActiveStatus } from "./vehicle-service";

export class PreconditionBlockedError extends Error {
  public readonly statusCode = 422;
  public readonly code = "PRECONDITION_BLOCKED";
  public readonly blockers: DealBlocker[];

  constructor(message: string, blockers: DealBlocker[]) {
    super(message);
    this.name = "PreconditionBlockedError";
    this.blockers = blockers;
  }
}

export class ConcurrencyConflictError extends Error {
  public readonly statusCode = 409;
  public readonly code = "CONCURRENCY_CONFLICT";

  constructor(message: string) {
    super(message);
    this.name = "ConcurrencyConflictError";
  }
}

function pushNotificationIfNew(
  db: ReturnType<typeof loadDatabaseState>,
  params: {
    organizationId: string;
    recipientProfileId: string;
    dealId: string;
    eventType:
      | "TASK_ASSIGNED"
      | "DOCUMENT_REQUESTED"
      | "DOCUMENT_RECEIVED"
      | "CORRECTION_REQUESTED"
      | "APPROVAL_RECORDED"
      | "NEXT_TASK_AVAILABLE"
      | "DEADLINE_EXCEEDED"
      | "DELIVERY_AUTHORIZED";
    title: string;
    message: string;
    dedupKey: string;
  }
) {
  if (db.notifications.some((n) => n.dedupKey === params.dedupKey)) {
    return;
  }
  db.notifications.unshift({
    id: `notif-${crypto.randomUUID().slice(0, 8)}`,
    organizationId: params.organizationId,
    recipientProfileId: params.recipientProfileId,
    dealId: params.dealId,
    eventType: params.eventType,
    title: params.title,
    message: params.message,
    dedupKey: params.dedupKey,
    isRead: false,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
}

function syncDealStatusFromSummary(
  deal: Deal,
  summary: DealEligibilitySummary,
  hasActiveReleaseAuth: boolean
): void {
  if (deal.status === "DRAFT" || deal.status === "CANCELLED" || deal.status === "DELIVERED") {
    return;
  }
  deal.currentStage = summary.currentStage;
  if (hasActiveReleaseAuth && summary.deliveryEligible) {
    deal.status = "DELIVERY_AUTHORIZED";
  } else if (summary.deliveryEligible) {
    deal.status = "ELIGIBLE_FOR_AUTHORIZATION";
  } else {
    deal.status = "ACTIVE";
  }
}

// ============================================================================
// LISTAGEM DE NEGOCIAÇÕES DA ORGANIZAÇÃO
// ============================================================================

export function listDealsForOrg(params: {
  ctx: AuthenticatedContext;
  statusFilter?: string;
  stageFilter?: string;
  sellerId?: string;
  search?: string;
}) {
  const { ctx, statusFilter, stageFilter, sellerId, search } = params;
  assertInternalStaff(ctx);
  assertPermission(ctx, "deal:view");

  const db = loadDatabaseState();
  const q = (search || "").trim().toLowerCase();

  return db.deals
    .filter((d) => d.organizationId === ctx.organization.id)
    .filter((d) => {
      if (statusFilter && statusFilter !== "ALL" && d.status !== statusFilter) {
        return false;
      }
      if (stageFilter && stageFilter !== "ALL" && d.currentStage !== stageFilter) {
        return false;
      }
      if (sellerId && sellerId !== "ALL" && d.sellerId !== sellerId) {
        return false;
      }
      if (q) {
        const veh = db.vehicles.find((v) => v.id === d.vehicleId);
        const cust = db.customers.find((c) => c.id === d.customerId);
        const hay = [
          d.dealNumber,
          veh?.internalCode || "",
          veh?.vin || "",
          veh?.brand || "",
          veh?.model || "",
          cust?.fullName || "",
          cust?.documentNumber || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((d) => {
      const vehicle = db.vehicles.find((v) => v.id === d.vehicleId)!;
      const customer = db.customers.find((c) => c.id === d.customerId)!;
      const seller = db.profiles.find((p) => p.id === d.sellerId)!;
      const tasks = db.taskInstances.filter((t) => t.dealId === d.id);
      const docs = db.documents.filter((doc) => doc.dealId === d.id);
      const hasActiveAuth = db.releaseAuthorizations.some(
        (ra) => ra.dealId === d.id && ra.status === "ACTIVE"
      );
      const summary = computeDealEligibilityAndSummary(
        d,
        tasks,
        docs,
        hasActiveAuth
      );

      return {
        deal: d,
        vehicle,
        customer,
        sellerName: seller?.fullName ?? "Vendedor",
        summary,
      };
    });
}

// ============================================================================
// FUNCIONALIDADE 4 — ABERTURA GUIADA DA NEGOCIAÇÃO (COM RASCUNHO E VALIDAÇÃO)
// ============================================================================

export async function createOrSaveGuidedDeal(params: {
  ctx: AuthenticatedContext;
  input: unknown;
  idempotencyKey?: string;
}): Promise<{ deal: Deal; isDraft: boolean }> {
  const { ctx, input, idempotencyKey } = params;
  assertInternalStaff(ctx);
  assertPermission(
    ctx,
    "deal:create",
    "Sua função não possui permissão para abrir negociações."
  );

  const parsed = GuidedDealInputSchema.parse(input);

  return withTransaction((db) => {
    if (idempotencyKey) {
      if (db.idempotencyKeys.includes(idempotencyKey)) {
        const latest = db.deals.find(
          (d) =>
            d.organizationId === ctx.organization.id &&
            d.vehicleId === parsed.vehicleId
        );
        if (latest) {
          return { deal: latest, isDraft: latest.status === "DRAFT" };
        }
      }
      db.idempotencyKeys.push(idempotencyKey);
    }

    const vehicle = db.vehicles.find((v) => v.id === parsed.vehicleId);
    if (!vehicle) {
      throw new Error("Veículo selecionado não encontrado.");
    }
    assertOrganizationAccess(ctx, vehicle.organizationId);

    // Regra crítica: impedir mais de uma negociação ativa para o mesmo veículo
    const conflictingActiveDeal = db.deals.find(
      (d) =>
        d.vehicleId === vehicle.id &&
        d.id !== parsed.draftDealId &&
        isDealActiveStatus(d.status)
    );
    if (conflictingActiveDeal && !parsed.saveAsDraft) {
      throw new Error(
        `Bloqueado no banco: o veículo ${vehicle.internalCode} (${vehicle.vin}) já possui uma negociação ativa (${conflictingActiveDeal.dealNumber}). Não é permitido manter duas negociações ativas para o mesmo veículo.`
      );
    }

    const nowIso = new Date().toISOString();

    // Resolver ou criar comprador
    let customerId = parsed.customerId || "";
    if (parsed.customerMode === "NEW" && parsed.newCustomer) {
      const existingCust = db.customers.find(
        (c) =>
          c.organizationId === ctx.organization.id &&
          c.documentNumber === parsed.newCustomer!.documentNumber.trim()
      );
      if (existingCust) {
        customerId = existingCust.id;
      } else {
        const newCust: Customer = {
          id: `cust-${crypto.randomUUID().slice(0, 8)}`,
          organizationId: ctx.organization.id,
          profileId: null,
          personType: parsed.newCustomer.personType,
          documentNumber: parsed.newCustomer.documentNumber.trim(),
          fullName: parsed.newCustomer.fullName.trim(),
          email: parsed.newCustomer.email.trim(),
          phone: parsed.newCustomer.phone.trim(),
          address: parsed.newCustomer.address?.trim() || null,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.customers.push(newCust);
        customerId = newCust.id;
      }
    } else if (!customerId) {
      customerId = db.customers.find((c) => c.organizationId === ctx.organization.id)?.id || "";
    }

    const wfTemplate = db.workflowTemplates.find(
      (wt) => wt.organizationId === ctx.organization.id
    );
    if (!wfTemplate) {
      throw new Error("Modelo de processo ativo não encontrado para a organização.");
    }
    const activeWfVersionId = wfTemplate.activeVersionId;

    let deal = parsed.draftDealId
      ? db.deals.find((d) => d.id === parsed.draftDealId)
      : undefined;

    if (deal) {
      assertOrganizationAccess(ctx, deal.organizationId);
      deal.vehicleId = vehicle.id;
      deal.branchId = parsed.branchId;
      deal.sellerId = parsed.sellerId;
      deal.customerId = customerId;
      deal.buyerType = parsed.buyerType;
      deal.paymentMethod = parsed.paymentMethod;
      deal.hasFinancing = parsed.hasFinancing;
      deal.financingInstitution = parsed.hasFinancing
        ? parsed.financingInstitution || null
        : null;
      deal.hasTradeIn = parsed.hasTradeIn;
      deal.hasPowerOfAttorney = parsed.hasPowerOfAttorney;
      deal.attorneyName = parsed.hasPowerOfAttorney
        ? parsed.attorneyName || null
        : null;
      deal.attorneyDocument = parsed.hasPowerOfAttorney
        ? parsed.attorneyDocument || null
        : null;
      deal.expectedDeliveryDate = parsed.expectedDeliveryDate || null;
      deal.notes = parsed.notes || null;
      deal.status = parsed.saveAsDraft ? "DRAFT" : "ACTIVE";
      deal.currentStage = parsed.saveAsDraft ? "IDENTIFICATION" : "REGISTRATION_DOCS";
      deal.updatedAt = nowIso;
    } else {
      const nextNum = db.deals.filter((d) => d.organizationId === ctx.organization.id).length + 1;
      const dealNumber = `NEG-2026-${String(nextNum).padStart(4, "0")}`;

      deal = {
        id: `deal-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: ctx.organization.id,
        branchId: parsed.branchId,
        dealNumber,
        vehicleId: vehicle.id,
        customerId,
        sellerId: parsed.sellerId,
        workflowVersionId: activeWfVersionId,
        status: parsed.saveAsDraft ? "DRAFT" : "ACTIVE",
        currentStage: parsed.saveAsDraft ? "IDENTIFICATION" : "REGISTRATION_DOCS",
        buyerType: parsed.buyerType,
        paymentMethod: parsed.paymentMethod,
        hasFinancing: parsed.hasFinancing,
        financingInstitution: parsed.hasFinancing
          ? parsed.financingInstitution || null
          : null,
        hasTradeIn: parsed.hasTradeIn,
        hasPowerOfAttorney: parsed.hasPowerOfAttorney,
        attorneyName: parsed.hasPowerOfAttorney
          ? parsed.attorneyName || null
          : null,
        attorneyDocument: parsed.hasPowerOfAttorney
          ? parsed.attorneyDocument || null
          : null,
        expectedDeliveryDate: parsed.expectedDeliveryDate || null,
        confirmedDeliveryDate: null,
        confirmedDeliveryBy: null,
        billingRegisteredAt: null,
        billingRegisteredBy: null,
        invoiceNumber: null,
        notes: parsed.notes || null,
        concurrencyVersion: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.deals.unshift(deal);
    }

    // Registrar veículo usado na troca separadamente (sem confundir com o veículo vendido)
    db.tradeInVehicles = db.tradeInVehicles.filter((t) => t.dealId !== deal!.id);
    if (parsed.hasTradeIn && parsed.tradeIn) {
      const tradeInRecord: TradeInVehicle = {
        id: `tradein-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: ctx.organization.id,
        dealId: deal.id,
        brand: parsed.tradeIn.brand,
        model: parsed.tradeIn.model,
        modelYear: parsed.tradeIn.modelYear,
        color: parsed.tradeIn.color,
        plate: parsed.tradeIn.plate.toUpperCase(),
        vin: parsed.tradeIn.vin.toUpperCase(),
        appraisedValue: parsed.tradeIn.appraisedValue,
        inspectionStatus: "PENDING",
        notes: parsed.tradeIn.notes || null,
        createdAt: nowIso,
      };
      db.tradeInVehicles.push(tradeInRecord);
    }

    if (parsed.saveAsDraft) {
      db.auditEvents.unshift({
        id: `aud-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: ctx.organization.id,
        dealId: deal.id,
        vehicleId: vehicle.id,
        actorId: ctx.profile.id,
        actorName: ctx.profile.fullName,
        actorRole: ctx.roles.join(","),
        action: "DEAL_DRAFT_SAVED",
        entityType: "DEAL",
        entityId: deal.id,
        summary: `Rascunho da negociação ${deal.dealNumber} salvo para continuação posterior.`,
        metadata: {},
        isCustomerVisible: false,
        createdAt: nowIso,
      });

      return { deal, isDraft: true };
    }

    // Reserva o veículo no estoque e instancia tarefas e documentos conforme a versão ativa do processo
    vehicle.stockStatus = "RESERVED";
    vehicle.updatedAt = nowIso;

    const versionTaskTemplates = db.taskTemplates.filter(
      (tt) => tt.workflowVersionId === deal!.workflowVersionId
    );
    const versionDocReqs = db.documentRequirements.filter(
      (dr) => dr.workflowVersionId === deal!.workflowVersionId
    );

    // Remove instâncias anteriores se estava em rascunho
    db.taskInstances = db.taskInstances.filter((t) => t.dealId !== deal!.id);
    db.documents = db.documents.filter((d) => d.dealId !== deal!.id);

    const instantiated = instantiateDealWorkflow({
      deal,
      vehicleCondition: vehicle.condition,
      taskTemplates: versionTaskTemplates,
      documentRequirements: versionDocReqs,
      nowIso,
      generateId: () => `inst-${crypto.randomUUID().slice(0, 8)}`,
    });

    db.taskInstances.push(...instantiated.tasks);
    db.documents.push(...instantiated.documents);

    // Gera convite seguro de acesso para o comprador
    db.customerAccessGrants.push({
      id: `grant-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      customerId: deal.customerId,
      accessToken: `tok-${deal.dealNumber.toLowerCase()}-${crypto
        .randomUUID()
        .slice(0, 6)}`,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      revokedAt: null,
      createdBy: ctx.profile.id,
      createdAt: nowIso,
    });

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      vehicleId: vehicle.id,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: ctx.roles.join(","),
      action: "DEAL_CREATED",
      entityType: "DEAL",
      entityId: deal.id,
      summary: `Passaporte Digital ${deal.dealNumber} criado para o veículo ${vehicle.internalCode} (${vehicle.brand} ${vehicle.model}). Tarefas aplicáveis geradas pela versão do processo.`,
      metadata: {
        buyerType: deal.buyerType,
        paymentMethod: deal.paymentMethod,
        hasFinancing: deal.hasFinancing,
        hasTradeIn: deal.hasTradeIn,
        hasPowerOfAttorney: deal.hasPowerOfAttorney,
        applicableTasks: instantiated.tasks.filter(
          (t) => t.state !== "WAIVED_BY_RULE"
        ).length,
        waivedTasks: instantiated.tasks.filter(
          (t) => t.state === "WAIVED_BY_RULE"
        ).length,
      },
      isCustomerVisible: true,
      createdAt: nowIso,
    });

    return { deal, isDraft: false };
  });
}

// ============================================================================
// FUNCIONALIDADE 6 — CONSULTA COMPLETA DO PASSAPORTE DIGITAL
// ============================================================================

export interface EnrichedDocumentView extends DealDocument {
  versions: Array<
    DocumentVersion & {
      uploadedByName: string;
      downloadUrl: string;
    }
  >;
}

export interface DealPassportView {
  deal: Deal;
  vehicle: Vehicle;
  tradeInVehicle: TradeInVehicle | null;
  customer: Customer;
  seller: Pick<UserProfile, "id" | "fullName" | "email" | "phone">;
  branch: Branch;
  workflowVersion: WorkflowVersion;
  tasks: Array<
    TaskInstance & {
      assigneeName: string | null;
      publishedProcedure: Pick<
        ProcedureVersion,
        "id" | "title" | "versionNumber" | "sections"
      > | null;
    }
  >;
  documents: EnrichedDocumentView[];
  approvals: Array<
    ApprovalRecord & {
      authorName: string;
    }
  >;
  activeReleaseAuthorization:
    | (ReleaseAuthorization & { authorizedByName: string })
    | null;
  allReleaseAuthorizations: Array<
    ReleaseAuthorization & { authorizedByName: string }
  >;
  deliveryRecord: (DeliveryRecord & { confirmedByName: string }) | null;
  customerAccessToken: string | null;
  summary: DealEligibilitySummary;
  userNextAction: UserNextActionRecommendation;
  auditEvents: AuditEvent[];
}

export function getDealPassportView(params: {
  ctx: AuthenticatedContext;
  dealId: string;
}): DealPassportView {
  const { ctx, dealId } = params;
  assertInternalStaff(ctx);
  assertPermission(ctx, "deal:view");

  const db = loadDatabaseState();
  const deal = db.deals.find((d) => d.id === dealId);
  if (!deal) {
    throw new Error("Negociação não encontrada.");
  }

  // Isolamento estrito por organização no servidor
  assertOrganizationAccess(ctx, deal.organizationId);

  const vehicle = db.vehicles.find((v) => v.id === deal.vehicleId)!;
  const tradeInVehicle =
    db.tradeInVehicles.find((t) => t.dealId === deal.id) ?? null;
  const customer = db.customers.find((c) => c.id === deal.customerId)!;
  const sellerProfile = db.profiles.find((p) => p.id === deal.sellerId)!;
  const branch = db.branches.find((b) => b.id === deal.branchId)!;
  const workflowVersion = db.workflowVersions.find(
    (wv) => wv.id === deal.workflowVersionId
  )!;

  const rawTasks = db.taskInstances
    .filter((t) => t.dealId === deal.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const rawDocs = db.documents.filter((d) => d.dealId === deal.id);
  const recalculatedTasks = recalculateTaskStates(rawTasks, rawDocs);

  // Somente versões PUBLICADAS de procedimentos alimentam orientações oficiais
  const publishedProcVersions = db.procedureVersions.filter(
    (pv) =>
      pv.organizationId === ctx.organization.id && pv.status === "PUBLISHED"
  );
  const proceduresByCode = new Map<string, ProcedureVersion>();
  for (const proc of db.procedures.filter(
    (p) => p.organizationId === ctx.organization.id
  )) {
    const activeVer = publishedProcVersions.find(
      (pv) => pv.id === proc.activeVersionId
    );
    if (activeVer) {
      proceduresByCode.set(proc.code, activeVer);
    }
  }

  const tasks = recalculatedTasks.map((t) => {
    const assignee = t.assigneeId
      ? db.profiles.find((p) => p.id === t.assigneeId)
      : null;
    const procVer = t.procedureCode
      ? proceduresByCode.get(t.procedureCode) ?? null
      : null;

    return {
      ...t,
      assigneeName: assignee?.fullName ?? null,
      publishedProcedure: procVer
        ? {
            id: procVer.id,
            title: procVer.title,
            versionNumber: procVer.versionNumber,
            sections: procVer.sections,
          }
        : null,
    };
  });

  const documents: EnrichedDocumentView[] = rawDocs.map((doc) => {
    const versions = db.documentVersions
      .filter((dv) => dv.documentId === doc.id)
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .map((dv) => {
        const uploader = db.profiles.find((p) => p.id === dv.uploadedBy);
        const signed = createTemporaryDocumentToken({
          documentId: doc.id,
          versionNumber: dv.versionNumber,
          organizationId: ctx.organization.id,
          viewerProfileId: ctx.profile.id,
        });
        return {
          ...dv,
          uploadedByName: uploader?.fullName ?? "Usuário",
          downloadUrl: `/api/documents/${doc.id}/download?version=${dv.versionNumber}&token=${encodeURIComponent(
            signed.token
          )}`,
        };
      });

    return {
      ...doc,
      versions,
    };
  });

  const approvals = db.approvalRecords
    .filter((ar) => ar.dealId === deal.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((ar) => {
      const author = db.profiles.find((p) => p.id === ar.authorId);
      return {
        ...ar,
        authorName: author?.fullName ?? "Responsável",
      };
    });

  const allReleaseAuthorizations = db.releaseAuthorizations
    .filter((ra) => ra.dealId === deal.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((ra) => {
      const author = db.profiles.find((p) => p.id === ra.authorizedBy);
      return {
        ...ra,
        authorizedByName: author?.fullName ?? "Responsável pela Liberação",
      };
    });

  const activeReleaseAuthorization =
    allReleaseAuthorizations.find((ra) => ra.status === "ACTIVE") ?? null;

  const rawDelivery = db.deliveries.find((del) => del.dealId === deal.id);
  const deliveryRecord = rawDelivery
    ? {
        ...rawDelivery,
        confirmedByName:
          db.profiles.find((p) => p.id === rawDelivery.confirmedBy)?.fullName ??
          "Operação",
      }
    : null;

  const activeGrant = db.customerAccessGrants.find(
    (g) => g.dealId === deal.id && !g.revokedAt
  );

  const summary = computeDealEligibilityAndSummary(
    deal,
    recalculatedTasks,
    rawDocs,
    Boolean(activeReleaseAuthorization)
  );

  const userNextAction = computeUserNextAction(
    ctx,
    deal,
    recalculatedTasks,
    rawDocs,
    summary
  );

  const auditEvents = db.auditEvents
    .filter((ae) => ae.dealId === deal.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    deal,
    vehicle,
    tradeInVehicle,
    customer,
    seller: {
      id: sellerProfile.id,
      fullName: sellerProfile.fullName,
      email: sellerProfile.email,
      phone: sellerProfile.phone,
    },
    branch,
    workflowVersion,
    tasks,
    documents,
    approvals,
    activeReleaseAuthorization,
    allReleaseAuthorizations,
    deliveryRecord,
    customerAccessToken: activeGrant?.accessToken ?? null,
    summary,
    userNextAction,
    auditEvents,
  };
}

// ============================================================================
// FUNCIONALIDADE 5 & 8 — EXECUÇÃO DE TAREFAS, ATRIBUIÇÃO E DEPENDÊNCIAS
// ============================================================================

export async function updateTaskOperationalState(params: {
  ctx: AuthenticatedContext;
  dealId: string;
  taskCode: string;
  action: "CLAIM" | "START" | "COMPLETE_OPERATIONAL" | "ASSIGN";
  targetAssigneeId?: string;
  notes?: string;
}): Promise<TaskInstance> {
  const { ctx, dealId, taskCode, action, targetAssigneeId, notes } = params;
  assertInternalStaff(ctx);

  return withTransaction((db) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("Negociação não encontrada.");
    assertOrganizationAccess(ctx, deal.organizationId);

    if (deal.status === "DELIVERED") {
      throw new Error(
        "A negociação já foi entregue e encerrada. Tarefas operacionais não podem ser alteradas."
      );
    }

    const dealTasks = db.taskInstances.filter((t) => t.dealId === deal.id);
    const dealDocs = db.documents.filter((d) => d.dealId === deal.id);
    const recalculated = recalculateTaskStates(dealTasks, dealDocs);
    for (const rt of recalculated) {
      const orig = db.taskInstances.find((o) => o.id === rt.id);
      if (orig) {
        orig.state = rt.state;
        orig.pendingReason = rt.pendingReason;
      }
    }

    const task = db.taskInstances.find(
      (t) => t.dealId === deal.id && t.code === taskCode
    );
    if (!task) throw new Error("Tarefa não encontrada nesta negociação.");

    if (task.state === "WAIVED_BY_RULE") {
      throw new Error(
        `A tarefa '${task.title}' está dispensada por regra do modelo de processo e não é aplicável.`
      );
    }

    const nowIso = new Date().toISOString();

    if (action === "ASSIGN") {
      assertPermission(
        ctx,
        "task:assign",
        "Sua função não possui permissão para atribuir responsáveis."
      );
      task.assigneeId = targetAssigneeId || ctx.profile.id;
      task.updatedAt = nowIso;

      pushNotificationIfNew(db, {
        organizationId: ctx.organization.id,
        recipientProfileId: task.assigneeId,
        dealId: deal.id,
        eventType: "TASK_ASSIGNED",
        title: `Nova tarefa atribuída em ${deal.dealNumber}`,
        message: `Você foi definido como responsável pela tarefa '${task.title}'.`,
        dedupKey: `assign-${task.id}-${task.assigneeId}-${Date.now()}`,
      });

      db.auditEvents.unshift({
        id: `aud-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: ctx.organization.id,
        dealId: deal.id,
        vehicleId: deal.vehicleId,
        actorId: ctx.profile.id,
        actorName: ctx.profile.fullName,
        actorRole: ctx.roles.join(","),
        action: "TASK_ASSIGNED",
        entityType: "TASK",
        entityId: task.code,
        summary: `Responsável atribuído para a tarefa '${task.title}'.`,
        metadata: { assigneeId: task.assigneeId },
        isCustomerVisible: false,
        createdAt: nowIso,
      });

      return task;
    }

    if (!canActOnArea(ctx, task.responsibleArea)) {
      throw new AuthorizationError(
        `Sua função (${ctx.roles.join(
          ", "
        )}) não está autorizada a executar tarefas da área ${
          AREA_LABELS[task.responsibleArea]
        }.`,
        "AREA_UNAUTHORIZED",
        403
      );
    }

    // Impede conclusão fora de ordem (quando há pré-requisitos não satisfeitos)
    const unmetDeps: string[] = [];
    for (const depCode of task.dependsOnTaskCodes) {
      const depTask = db.taskInstances.find(
        (t) => t.dealId === deal.id && t.code === depCode
      );
      if (depTask && !isTaskSatisfiedAsDependency(depTask)) {
        unmetDeps.push(depTask.title);
      }
    }

    if (unmetDeps.length > 0) {
      throw new Error(
        `Ordem de dependência bloqueada: a tarefa '${
          task.title
        }' depende da conclusão prévia de: ${unmetDeps.join(", ")}.`
      );
    }

    if (action === "CLAIM" || action === "START") {
      task.assigneeId = ctx.profile.id;
      if (task.state === "AVAILABLE") {
        task.state = "IN_PROGRESS";
      }
      task.startedAt = task.startedAt ?? nowIso;
      task.updatedAt = nowIso;
      return task;
    }

    if (action === "COMPLETE_OPERATIONAL") {
      if (task.requiresFormalApproval) {
        task.state = "IN_REVIEW";
      } else {
        task.state = "COMPLETED";
        task.completedAt = nowIso;
        task.completedBy = ctx.profile.id;
      }
      task.updatedAt = nowIso;
      deal.concurrencyVersion += 1;
      deal.updatedAt = nowIso;

      // Recalcula todas as tarefas dependentes
      const updatedList = recalculateTaskStates(
        db.taskInstances.filter((t) => t.dealId === deal.id),
        dealDocs
      );
      for (const ut of updatedList) {
        const ref = db.taskInstances.find((o) => o.id === ut.id);
        if (ref) {
          ref.state = ut.state;
          ref.pendingReason = ut.pendingReason;
        }
      }

      const hasActiveAuth = db.releaseAuthorizations.some(
        (ra) => ra.dealId === deal.id && ra.status === "ACTIVE"
      );
      const summary = computeDealEligibilityAndSummary(
        deal,
        updatedList,
        dealDocs,
        hasActiveAuth
      );
      syncDealStatusFromSummary(deal, summary, hasActiveAuth);

      db.auditEvents.unshift({
        id: `aud-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: ctx.organization.id,
        dealId: deal.id,
        vehicleId: deal.vehicleId,
        actorId: ctx.profile.id,
        actorName: ctx.profile.fullName,
        actorRole: ctx.roles.join(","),
        action: "TASK_COMPLETED",
        entityType: "TASK",
        entityId: task.code,
        summary: `Tarefa operacional '${task.title}' concluída por ${ctx.profile.fullName}.${
          notes ? ` Observação: ${notes}` : ""
        }`,
        metadata: { notes },
        isCustomerVisible: true,
        createdAt: nowIso,
      });
    }

    return task;
  });
}

// ============================================================================
// FUNCIONALIDADE 7 — DOCUMENTOS (SOLICITAÇÃO, UPLOAD, REVISÃO E SUBSTITUIÇÃO)
// ============================================================================

export async function requestAdditionalDocument(params: {
  ctx: AuthenticatedContext;
  dealId: string;
  title: string;
  category: string;
  whyRequired: string;
  responsibleArea: ResponsibleArea;
  taskCode?: string | null;
  blocksBilling: boolean;
  blocksDelivery: boolean;
  isCustomerVisible: boolean;
}): Promise<DealDocument> {
  const { ctx, dealId } = params;
  assertInternalStaff(ctx);
  assertPermission(
    ctx,
    "document:request",
    "Sua função não possui permissão para solicitar novos documentos."
  );

  return withTransaction((db) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("Negociação não encontrada.");
    assertOrganizationAccess(ctx, deal.organizationId);

    const nowIso = new Date().toISOString();
    const newDoc: DealDocument = {
      id: `doc-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      taskCode: params.taskCode || null,
      requirementCode: null,
      title: params.title.trim(),
      category: params.category.trim(),
      whyRequired: params.whyRequired.trim(),
      responsibleArea: params.responsibleArea,
      status: "REQUESTED",
      currentVersionNumber: 0,
      rejectionReason: null,
      blocksBilling: params.blocksBilling,
      blocksDelivery: params.blocksDelivery,
      isCustomerVisible: params.isCustomerVisible,
      requestedBy: ctx.profile.id,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.documents.push(newDoc);
    deal.concurrencyVersion += 1;
    deal.updatedAt = nowIso;

    // Se havia autorização ativa e o novo documento bloqueia entrega, invalida a autorização
    if (newDoc.blocksDelivery) {
      for (const ra of db.releaseAuthorizations.filter(
        (r) => r.dealId === deal.id && r.status === "ACTIVE"
      )) {
        ra.status = "INVALIDATED";
        ra.invalidatedAt = nowIso;
        ra.invalidationReason = `Novo documento obrigatório solicitado: '${newDoc.title}'.`;
      }
      if (deal.status === "DELIVERY_AUTHORIZED" || deal.status === "ELIGIBLE_FOR_AUTHORIZATION") {
        deal.status = "ACTIVE";
      }
    }

    pushNotificationIfNew(db, {
      organizationId: ctx.organization.id,
      recipientProfileId: deal.sellerId,
      dealId: deal.id,
      eventType: "DOCUMENT_REQUESTED",
      title: `Novo documento solicitado em ${deal.dealNumber}`,
      message: `Foi solicitado o documento '${newDoc.title}': ${newDoc.whyRequired}`,
      dedupKey: `doc-req-${newDoc.id}`,
    });

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      vehicleId: deal.vehicleId,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: ctx.roles.join(","),
      action: "DOCUMENT_REQUESTED",
      entityType: "DOCUMENT",
      entityId: newDoc.id,
      summary: `Documento adicional solicitado: '${newDoc.title}' (Motivo: ${newDoc.whyRequired}).`,
      metadata: { blocksBilling: newDoc.blocksBilling, blocksDelivery: newDoc.blocksDelivery },
      isCustomerVisible: newDoc.isCustomerVisible,
      createdAt: nowIso,
    });

    return newDoc;
  });
}

export async function uploadDocumentVersion(params: {
  ctx: AuthenticatedContext;
  dealId: string;
  documentId: string;
  originalFilename: string;
  mimeType: string;
  contentBuffer: Buffer;
  uploadNotes?: string;
  replacementReason?: string;
}): Promise<{
  document: DealDocument;
  version: DocumentVersion;
  invalidatedApprovalsCount: number;
  reopenedTasksCount: number;
}> {
  const {
    ctx,
    dealId,
    documentId,
    originalFilename,
    mimeType,
    contentBuffer,
    uploadNotes,
    replacementReason,
  } = params;

  // Validação no servidor (tamanho, MIME type e bloqueio de executáveis)
  validateServerUploadFile({
    originalFilename,
    mimeType,
    sizeBytes: contentBuffer.byteLength,
  });

  return withTransaction((db) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("Negociação não encontrada.");
    assertOrganizationAccess(ctx, deal.organizationId);

    if (deal.status === "DELIVERED") {
      throw new Error(
        "A negociação já foi concluída e entregue. Não é permitido substituir documentos operacionais."
      );
    }

    const doc = db.documents.find(
      (d) => d.id === documentId && d.dealId === deal.id
    );
    if (!doc) throw new Error("Registro de documento não encontrado.");

    // Se for cliente, verificar se é a própria negociação e se o documento é visível ao cliente
    if (ctx.profile.isCustomerOnly) {
      if (deal.customerId !== ctx.customerRecordId || !doc.isCustomerVisible) {
        throw new AuthorizationError(
          "Você não tem permissão para enviar arquivos neste documento.",
          "CUSTOMER_DOC_FORBIDDEN",
          403
        );
      }
    } else {
      assertPermission(ctx, "document:upload");
    }

    const wasApproved = doc.status === "APPROVED";
    if (wasApproved && (!replacementReason || replacementReason.trim().length < 3)) {
      throw new Error(
        "Este documento já estava aprovado. Informe o motivo da substituição para registro de auditoria e reabertura das verificações."
      );
    }

    const savedBlob = savePrivateFileBlob({
      organizationId: ctx.organization.id,
      contentBuffer,
      mimeType,
    });

    const nowIso = new Date().toISOString();
    const nextVer = doc.currentVersionNumber + 1;

    const newVersion: DocumentVersion = {
      id: `docver-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      documentId: doc.id,
      versionNumber: nextVer,
      storageKey: savedBlob.storageKey,
      originalFilename: originalFilename.trim(),
      mimeType,
      sizeBytes: contentBuffer.byteLength,
      checksumSha256: savedBlob.checksumSha256,
      uploadedBy: ctx.profile.id,
      uploadNotes: uploadNotes?.trim() || replacementReason?.trim() || null,
      extractedTextPreview: `[Extração Opcional Preparada — Sujeita à revisão humana] Arquivo: ${originalFilename.trim()} (v${nextVer})`,
      ocrReviewStatus: "PENDING_HUMAN_REVIEW",
      createdAt: nowIso,
    };

    db.documentVersions.push(newVersion);
    doc.currentVersionNumber = nextVer;
    doc.rejectionReason = null;
    doc.updatedAt = nowIso;

    let invalidatedApprovalsCount = 0;
    let reopenedTasksCount = 0;

    // REGRA CRÍTICA (FUNCIONALIDADE 7):
    // Quando um documento aprovado for substituído:
    // - Preservar a versão anterior (mantida em db.documentVersions)
    // - Marcar aprovações dependentes como desatualizadas (OUTDATED)
    // - Reabrir as verificações afetadas
    // - Registrar o motivo
    // - Recalcular a elegibilidade (e invalidar autorização de entrega ativa se houver)
    if (wasApproved) {
      doc.status = "OUTDATED";
      doc.reviewedBy = null;
      doc.reviewedAt = null;

      const reasonText =
        replacementReason?.trim() ||
        "Documento aprovado foi substituído por uma nova versão.";

      // Invalidar aprovações que referenciam o documento ou tarefas dependentes
      for (const appr of db.approvalRecords.filter(
        (ar) => ar.dealId === deal.id && ar.status === "ACTIVE"
      )) {
        const citesDoc = appr.evidenceRefs.some(
          (ref) => ref.documentId === doc.id
        );
        const sameTaskOrDossier =
          appr.taskCode === doc.taskCode ||
          appr.taskCode === "TASK_DOSSIER_REVIEW";

        if (citesDoc || sameTaskOrDossier) {
          appr.status = "OUTDATED";
          appr.invalidatedAt = nowIso;
          appr.invalidationReason = `Documento '${doc.title}' substituído pela versão v${nextVer}: ${reasonText}`;
          invalidatedApprovalsCount++;
        }
      }

      // Reabrir tarefas vinculadas e tarefas que dependem delas (ex: TASK_DOSSIER_REVIEW, TASK_RELEASE_AUTH)
      for (const task of db.taskInstances.filter((t) => t.dealId === deal.id)) {
        if (
          task.code === doc.taskCode ||
          (doc.taskCode && task.dependsOnTaskCodes.includes(doc.taskCode)) ||
          task.code === "TASK_DOSSIER_REVIEW"
        ) {
          if (task.state === "COMPLETED" || task.approvalStatus === "APPROVED") {
            task.state = "IN_REVIEW";
            if (task.requiresFormalApproval) {
              task.approvalStatus = "OUTDATED";
            }
            task.completedAt = null;
            task.completedBy = null;
            task.reopenCount += 1;
            task.updatedAt = nowIso;
            reopenedTasksCount++;
          }
        }
      }

      // Invalidar autorizações de liberação ativas
      for (const ra of db.releaseAuthorizations.filter(
        (r) => r.dealId === deal.id && r.status === "ACTIVE"
      )) {
        ra.status = "INVALIDATED";
        ra.invalidatedAt = nowIso;
        ra.invalidationReason = `Invalidação automática: o documento aprovado '${doc.title}' foi substituído pela versão v${nextVer} (${reasonText}).`;
      }
    } else {
      doc.status = "UPLOADED_PENDING_REVIEW";
      // Se a tarefa de coleta pura (sem aprovação formal, ex: TASK_BUYER_DOCS) estava aguardando, avança
      if (doc.taskCode) {
        const linkedTask = db.taskInstances.find(
          (t) => t.dealId === deal.id && t.code === doc.taskCode
        );
        if (linkedTask && linkedTask.state !== "WAIVED_BY_RULE") {
          if (linkedTask.requiresFormalApproval) {
            linkedTask.state = "IN_REVIEW";
          } else {
            linkedTask.state = "IN_PROGRESS";
          }
          linkedTask.updatedAt = nowIso;
        }
      }
    }

    deal.concurrencyVersion += 1;
    deal.updatedAt = nowIso;

    // Recalcular estados das tarefas e elegibilidade da negociação
    const dealTasks = db.taskInstances.filter((t) => t.dealId === deal.id);
    const dealDocs = db.documents.filter((d) => d.dealId === deal.id);
    const recalculated = recalculateTaskStates(dealTasks, dealDocs);
    for (const rt of recalculated) {
      const orig = db.taskInstances.find((o) => o.id === rt.id);
      if (orig) {
        orig.state = rt.state;
        orig.pendingReason = rt.pendingReason;
      }
    }

    const hasActiveAuth = db.releaseAuthorizations.some(
      (ra) => ra.dealId === deal.id && ra.status === "ACTIVE"
    );
    const summary = computeDealEligibilityAndSummary(
      deal,
      recalculated,
      dealDocs,
      hasActiveAuth
    );
    syncDealStatusFromSummary(deal, summary, hasActiveAuth);

    // Notificar analista responsável pela conferência
    const targetReviewerId =
      doc.responsibleArea === "FINANCE" ? "user-financeiro" : "user-documental";
    pushNotificationIfNew(db, {
      organizationId: ctx.organization.id,
      recipientProfileId: targetReviewerId,
      dealId: deal.id,
      eventType: "DOCUMENT_RECEIVED",
      title: `Documento recebido (v${nextVer}) em ${deal.dealNumber}`,
      message: `O arquivo '${originalFilename}' foi anexado para '${doc.title}' e aguarda conferência.`,
      dedupKey: `doc-recv-${doc.id}-v${nextVer}`,
    });

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      vehicleId: deal.vehicleId,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: ctx.roles.join(","),
      action: wasApproved ? "APPROVED_DOCUMENT_REPLACED" : "DOCUMENT_UPLOADED",
      entityType: "DOCUMENT",
      entityId: doc.id,
      summary: wasApproved
        ? `Substituição de documento já aprovado '${doc.title}' (nova versão v${nextVer}). Motivo: ${replacementReason}. ${invalidatedApprovalsCount} aprovação(ões) marcada(s) como desatualizada(s) e ${reopenedTasksCount} tarefa(s) reaberta(s).`
        : `Versão v${nextVer} enviada para o documento '${doc.title}' (${originalFilename}).`,
      metadata: {
        versionNumber: nextVer,
        wasApproved,
        replacementReason: replacementReason || null,
        invalidatedApprovalsCount,
        reopenedTasksCount,
      },
      isCustomerVisible: doc.isCustomerVisible,
      createdAt: nowIso,
    });

    return {
      document: doc,
      version: newVersion,
      invalidatedApprovalsCount,
      reopenedTasksCount,
    };
  });
}

export async function reviewDocumentVersion(params: {
  ctx: AuthenticatedContext;
  dealId: string;
  documentId: string;
  decision: "APPROVED" | "REJECTED" | "CORRECTION_REQUESTED";
  justification?: string;
}): Promise<DealDocument> {
  const { ctx, dealId, documentId, decision, justification } = params;
  assertInternalStaff(ctx);

  return withTransaction((db) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("Negociação não encontrada.");
    assertOrganizationAccess(ctx, deal.organizationId);

    const doc = db.documents.find(
      (d) => d.id === documentId && d.dealId === deal.id
    );
    if (!doc) throw new Error("Documento não encontrado.");

    // Verifica permissão de acordo com a área do documento
    if (doc.responsibleArea === "FINANCE") {
      if (!hasPermission(ctx, "approval:finance") && !hasPermission(ctx, "document:review")) {
        throw new AuthorizationError(
          "Sua função não possui permissão para conferir documentos financeiros.",
          "INSUFFICIENT_PERMISSION",
          403
        );
      }
    } else {
      assertPermission(
        ctx,
        "document:review",
        "Sua função não possui permissão para conferir documentos."
      );
    }

    if (doc.currentVersionNumber === 0) {
      throw new Error(
        "Não é possível aprovar ou rejeitar um documento que ainda não teve nenhum arquivo enviado."
      );
    }

    if (
      (decision === "REJECTED" || decision === "CORRECTION_REQUESTED") &&
      (!justification || justification.trim().length < 3)
    ) {
      throw new Error(
        "Informe o motivo da rejeição ou os detalhes da correção solicitada."
      );
    }

    const nowIso = new Date().toISOString();
    doc.status = decision;
    doc.reviewedBy = ctx.profile.id;
    doc.reviewedAt = nowIso;
    doc.rejectionReason =
      decision === "APPROVED" ? null : justification?.trim() || null;
    doc.updatedAt = nowIso;

    // Atualizar última versão como revisada
    const latestVer = db.documentVersions.find(
      (dv) =>
        dv.documentId === doc.id && dv.versionNumber === doc.currentVersionNumber
    );
    if (latestVer) {
      latestVer.ocrReviewStatus = "REVIEWED";
    }

    // Se a tarefa vinculada a este documento for de coleta simples (ex: TASK_BUYER_DOCS) ou se for aprovada pelo próprio analista da área, sincroniza a tarefa!
    if (doc.taskCode) {
      const linkedTask = db.taskInstances.find(
        (t) => t.dealId === deal.id && t.code === doc.taskCode
      );
      if (linkedTask && linkedTask.state !== "WAIVED_BY_RULE") {
        const allTaskDocs = db.documents.filter(
          (d) => d.dealId === deal.id && d.taskCode === linkedTask.code
        );
        const allApproved = allTaskDocs.every((d) => d.status === "APPROVED");

        if (decision === "APPROVED" && allApproved) {
          if (
            linkedTask.requiresFormalApproval &&
            canApproveTaskRole(ctx, linkedTask.approvalRole)
          ) {
            linkedTask.state = "COMPLETED";
            linkedTask.approvalStatus = "APPROVED";
            linkedTask.completedAt = nowIso;
            linkedTask.completedBy = ctx.profile.id;

            db.approvalRecords.push({
              id: `appr-${crypto.randomUUID().slice(0, 8)}`,
              organizationId: ctx.organization.id,
              dealId: deal.id,
              taskId: linkedTask.id,
              taskCode: linkedTask.code,
              area: linkedTask.responsibleArea,
              authorId: ctx.profile.id,
              roleUsed: linkedTask.approvalRole ?? ctx.roles[0],
              decision: "APPROVED",
              status: "ACTIVE",
              justification:
                justification?.trim() ||
                `Documento '${doc.title}' (v${doc.currentVersionNumber}) conferido e aprovado.`,
              evidenceRefs: [
                {
                  documentId: doc.id,
                  documentTitle: doc.title,
                  versionNumber: doc.currentVersionNumber,
                },
              ],
              analyzedDataVersion: deal.concurrencyVersion,
              invalidatedAt: null,
              invalidationReason: null,
              createdAt: nowIso,
            });
          } else if (!linkedTask.requiresFormalApproval) {
            linkedTask.state = "COMPLETED";
            linkedTask.completedAt = nowIso;
            linkedTask.completedBy = ctx.profile.id;
          }
        } else if (
          decision === "REJECTED" ||
          decision === "CORRECTION_REQUESTED"
        ) {
          linkedTask.state = "WAITING_INFO";
          if (linkedTask.requiresFormalApproval) {
            linkedTask.approvalStatus = "REJECTED";
          }
        }
        linkedTask.updatedAt = nowIso;
      }
    }

    // Se todas as tarefas de documentos de entrada (TASK_BUYER_DOCS, TASK_POA_DOCS, TASK_TRADE_IN_EVAL) estão concluídas e o revisor é DOCUMENTAL, verificar se pode aprovar também o dossiê quando todos os docs documentais estão aprovados
    const allDocAreaDocs = db.documents.filter(
      (d) => d.dealId === deal.id && d.responsibleArea === "DOCUMENTATION"
    );
    if (
      decision === "APPROVED" &&
      hasPermission(ctx, "approval:documentation") &&
      allDocAreaDocs.every((d) => d.status === "APPROVED")
    ) {
      const dossierTask = db.taskInstances.find(
        (t) => t.dealId === deal.id && t.code === "TASK_DOSSIER_REVIEW"
      );
      if (dossierTask && dossierTask.state !== "COMPLETED") {
        dossierTask.state = "COMPLETED";
        dossierTask.approvalStatus = "APPROVED";
        dossierTask.completedAt = nowIso;
        dossierTask.completedBy = ctx.profile.id;
        dossierTask.updatedAt = nowIso;

        db.approvalRecords.push({
          id: `appr-${crypto.randomUUID().slice(0, 8)}`,
          organizationId: ctx.organization.id,
          dealId: deal.id,
          taskId: dossierTask.id,
          taskCode: dossierTask.code,
          area: "DOCUMENTATION",
          authorId: ctx.profile.id,
          roleUsed: "DOCUMENTATION",
          decision: "APPROVED",
          status: "ACTIVE",
          justification:
            "Todos os documentos exigidos pelas condições da negociação foram conferidos e aprovados.",
          evidenceRefs: allDocAreaDocs.map((d) => ({
            documentId: d.id,
            documentTitle: d.title,
            versionNumber: d.currentVersionNumber,
          })),
          analyzedDataVersion: deal.concurrencyVersion,
          invalidatedAt: null,
          invalidationReason: null,
          createdAt: nowIso,
        });
      }
    }

    deal.concurrencyVersion += 1;
    deal.updatedAt = nowIso;

    const dealTasks = db.taskInstances.filter((t) => t.dealId === deal.id);
    const dealDocs = db.documents.filter((d) => d.dealId === deal.id);
    const recalculated = recalculateTaskStates(dealTasks, dealDocs);
    for (const rt of recalculated) {
      const orig = db.taskInstances.find((o) => o.id === rt.id);
      if (orig) {
        orig.state = rt.state;
        orig.pendingReason = rt.pendingReason;
      }
    }

    const hasActiveAuth = db.releaseAuthorizations.some(
      (ra) => ra.dealId === deal.id && ra.status === "ACTIVE"
    );
    const summary = computeDealEligibilityAndSummary(
      deal,
      recalculated,
      dealDocs,
      hasActiveAuth
    );
    syncDealStatusFromSummary(deal, summary, hasActiveAuth);

    if (decision !== "APPROVED") {
      pushNotificationIfNew(db, {
        organizationId: ctx.organization.id,
        recipientProfileId: deal.sellerId,
        dealId: deal.id,
        eventType: "CORRECTION_REQUESTED",
        title: `Correção solicitada em ${deal.dealNumber}`,
        message: `O documento '${doc.title}' precisa de correção: ${justification}`,
        dedupKey: `doc-corr-${doc.id}-v${doc.currentVersionNumber}-${Date.now()}`,
      });
    }

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      vehicleId: deal.vehicleId,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: ctx.roles.join(","),
      action: `DOCUMENT_${decision}`,
      entityType: "DOCUMENT",
      entityId: doc.id,
      summary:
        decision === "APPROVED"
          ? `Documento '${doc.title}' (v${doc.currentVersionNumber}) conferido e APROVADO por ${ctx.profile.fullName}.`
          : `Documento '${doc.title}' (v${doc.currentVersionNumber}) marcado como '${decision}' por ${ctx.profile.fullName}. Justificativa: ${justification}`,
      metadata: {
        versionNumber: doc.currentVersionNumber,
        decision,
        justification: justification || null,
      },
      isCustomerVisible: doc.isCustomerVisible,
      createdAt: nowIso,
    });

    return doc;
  });
}

// ============================================================================
// FUNCIONALIDADE 8 — APROVAÇÕES FORMAIS DE ETAPAS, FATURAMENTO, AUTORIZAÇÃO E ENTREGA
// ============================================================================

export async function recordTaskFormalApproval(params: {
  ctx: AuthenticatedContext;
  dealId: string;
  taskCode: string;
  decision: "APPROVED" | "REJECTED" | "CORRECTION_REQUESTED";
  justification: string;
  evidenceDocumentIds?: string[];
}): Promise<ApprovalRecord> {
  const {
    ctx,
    dealId,
    taskCode,
    decision,
    justification,
    evidenceDocumentIds,
  } = params;
  assertInternalStaff(ctx);

  if (!justification || justification.trim().length < 3) {
    throw new Error(
      "Informe uma justificativa ou parecer formal para registrar a decisão de aprovação/rejeição."
    );
  }

  return withTransaction((db) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("Negociação não encontrada.");
    assertOrganizationAccess(ctx, deal.organizationId);

    const task = db.taskInstances.find(
      (t) => t.dealId === deal.id && t.code === taskCode
    );
    if (!task) throw new Error("Tarefa não encontrada.");

    // Verifica função/permissão exigida no servidor
    if (task.approvalRole === "FINANCE" || task.responsibleArea === "FINANCE") {
      assertPermission(
        ctx,
        "approval:finance",
        "Somente a função Financeiro (ou Gestor/Admin autorizado) pode aprovar etapas financeiras."
      );
    } else if (
      task.approvalRole === "DOCUMENTATION" ||
      task.responsibleArea === "DOCUMENTATION"
    ) {
      assertPermission(
        ctx,
        "approval:documentation",
        "Somente a função Documental (ou Gestor/Admin autorizado) pode aprovar etapas documentais."
      );
    } else if (!canApproveTaskRole(ctx, task.approvalRole)) {
      throw new AuthorizationError(
        `Sua função não está autorizada a registrar aprovação para '${task.title}'.`,
        "APPROVAL_ROLE_MISMATCH",
        403
      );
    }

    // Verifica se pré-requisitos da tarefa foram cumpridos antes de aprovar
    if (decision === "APPROVED") {
      for (const depCode of task.dependsOnTaskCodes) {
        const depTask = db.taskInstances.find(
          (t) => t.dealId === deal.id && t.code === depCode
        );
        if (depTask && !isTaskSatisfiedAsDependency(depTask)) {
          throw new Error(
            `Não é possível aprovar '${task.title}' antes da conclusão do pré-requisito '${depTask.title}'.`
          );
        }
      }
    }

    const nowIso = new Date().toISOString();

    // Coletar evidências vinculadas
    const dealDocs = db.documents.filter((d) => d.dealId === deal.id);
    const linkedDocs =
      evidenceDocumentIds && evidenceDocumentIds.length > 0
        ? dealDocs.filter((d) => evidenceDocumentIds.includes(d.id))
        : dealDocs.filter((d) => d.taskCode === task.code);

    const evidenceRefs = linkedDocs.map((d) => ({
      documentId: d.id,
      documentTitle: d.title,
      versionNumber: d.currentVersionNumber,
    }));

    const roleUsed: RoleCode =
      task.approvalRole && ctx.roles.includes(task.approvalRole)
        ? task.approvalRole
        : ctx.roles[0];

    const record: ApprovalRecord = {
      id: `appr-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      taskId: task.id,
      taskCode: task.code,
      area: task.responsibleArea,
      authorId: ctx.profile.id,
      roleUsed,
      decision,
      status: "ACTIVE",
      justification: justification.trim(),
      evidenceRefs,
      analyzedDataVersion: deal.concurrencyVersion,
      invalidatedAt: null,
      invalidationReason: null,
      createdAt: nowIso,
    };

    db.approvalRecords.push(record);

    if (decision === "APPROVED") {
      task.state = "COMPLETED";
      task.approvalStatus = "APPROVED";
      task.completedAt = nowIso;
      task.completedBy = ctx.profile.id;
    } else {
      task.state = "WAITING_INFO";
      task.approvalStatus = "REJECTED";
      task.completedAt = null;
      task.completedBy = null;
    }
    task.updatedAt = nowIso;
    deal.concurrencyVersion += 1;
    deal.updatedAt = nowIso;

    const dealTasks = db.taskInstances.filter((t) => t.dealId === deal.id);
    const recalculated = recalculateTaskStates(dealTasks, dealDocs);
    for (const rt of recalculated) {
      const orig = db.taskInstances.find((o) => o.id === rt.id);
      if (orig) {
        orig.state = rt.state;
        orig.pendingReason = rt.pendingReason;
      }
    }

    const hasActiveAuth = db.releaseAuthorizations.some(
      (ra) => ra.dealId === deal.id && ra.status === "ACTIVE"
    );
    const summary = computeDealEligibilityAndSummary(
      deal,
      recalculated,
      dealDocs,
      hasActiveAuth
    );
    syncDealStatusFromSummary(deal, summary, hasActiveAuth);

    pushNotificationIfNew(db, {
      organizationId: ctx.organization.id,
      recipientProfileId: deal.sellerId,
      dealId: deal.id,
      eventType:
        decision === "APPROVED" ? "APPROVAL_RECORDED" : "CORRECTION_REQUESTED",
      title:
        decision === "APPROVED"
          ? `Aprovação registrada em ${deal.dealNumber}`
          : `Rejeição / Correção em ${deal.dealNumber}`,
      message: `${task.title}: ${justification.trim()}`,
      dedupKey: `appr-notif-${record.id}`,
    });

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      vehicleId: deal.vehicleId,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: roleUsed,
      action: `TASK_APPROVAL_${decision}`,
      entityType: "APPROVAL",
      entityId: record.id,
      summary: `Decisão '${decision}' registrada por ${ctx.profile.fullName} (${roleUsed}) na etapa '${task.title}'. Justificativa: ${justification.trim()}`,
      metadata: {
        taskCode: task.code,
        decision,
        evidenceRefs,
        analyzedDataVersion: record.analyzedDataVersion,
      },
      isCustomerVisible: decision === "APPROVED",
      createdAt: nowIso,
    });

    return record;
  });
}

export async function registerDealBilling(params: {
  ctx: AuthenticatedContext;
  dealId: string;
  invoiceNumber: string;
  notes?: string;
}): Promise<Deal> {
  const { ctx, dealId, invoiceNumber, notes } = params;
  assertInternalStaff(ctx);
  assertPermission(
    ctx,
    "billing:register",
    "Sua função não possui permissão para registrar faturamento / Nota Fiscal."
  );

  if (!invoiceNumber || invoiceNumber.trim().length < 3) {
    throw new Error("Informe o número da Nota Fiscal emitida.");
  }

  return withTransaction((db) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("Negociação não encontrada.");
    assertOrganizationAccess(ctx, deal.organizationId);

    const dealTasks = db.taskInstances.filter((t) => t.dealId === deal.id);
    const dealDocs = db.documents.filter((d) => d.dealId === deal.id);
    const recalculated = recalculateTaskStates(dealTasks, dealDocs);
    const summary = computeDealEligibilityAndSummary(
      deal,
      recalculated,
      dealDocs,
      false
    );

    // Verificação transacional no servidor: todos os requisitos para faturar devem estar cumpridos!
    if (!summary.billingEligible) {
      db.auditEvents.unshift({
        id: `aud-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: ctx.organization.id,
        dealId: deal.id,
        vehicleId: deal.vehicleId,
        actorId: ctx.profile.id,
        actorName: ctx.profile.fullName,
        actorRole: ctx.roles.join(","),
        action: "BILLING_ATTEMPT_BLOCKED",
        entityType: "DEAL",
        entityId: deal.id,
        summary: `Tentativa de registrar faturamento bloqueada no servidor devido a ${summary.billingBlockers.length} requisito(s) pendente(s).`,
        metadata: { blockers: summary.billingBlockers },
        isCustomerVisible: false,
        createdAt: new Date().toISOString(),
      });

      throw new PreconditionBlockedError(
        `Faturamento bloqueado: existem ${summary.billingBlockers.length} requisito(s) obrigatório(s) pendente(s) antes da emissão da Nota Fiscal.`,
        summary.billingBlockers
      );
    }

    const nowIso = new Date().toISOString();
    deal.invoiceNumber = invoiceNumber.trim();
    deal.billingRegisteredAt = nowIso;
    deal.billingRegisteredBy = ctx.profile.id;
    deal.concurrencyVersion += 1;
    deal.updatedAt = nowIso;

    const billingTask = db.taskInstances.find(
      (t) => t.dealId === deal.id && t.code === "TASK_BILLING_INVOICE"
    );
    if (billingTask) {
      billingTask.state = "COMPLETED";
      billingTask.completedAt = nowIso;
      billingTask.completedBy = ctx.profile.id;
      billingTask.updatedAt = nowIso;
    }

    const afterTasks = recalculateTaskStates(
      db.taskInstances.filter((t) => t.dealId === deal.id),
      dealDocs
    );
    for (const ut of afterTasks) {
      const orig = db.taskInstances.find((o) => o.id === ut.id);
      if (orig) {
        orig.state = ut.state;
        orig.pendingReason = ut.pendingReason;
      }
    }

    const afterSummary = computeDealEligibilityAndSummary(
      deal,
      afterTasks,
      dealDocs,
      false
    );
    syncDealStatusFromSummary(deal, afterSummary, false);

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      vehicleId: deal.vehicleId,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: ctx.roles.join(","),
      action: "BILLING_REGISTERED",
      entityType: "DEAL",
      entityId: deal.id,
      summary: `Faturamento registrado com sucesso: Nota Fiscal '${deal.invoiceNumber}'.${
        notes ? ` Obs: ${notes}` : ""
      }`,
      metadata: { invoiceNumber: deal.invoiceNumber, notes },
      isCustomerVisible: true,
      createdAt: nowIso,
    });

    return deal;
  });
}

export async function authorizeDealRelease(params: {
  ctx: AuthenticatedContext;
  dealId: string;
  notes?: string;
  confirmedDeliveryWindow?: string;
  expectedConcurrencyVersion?: number;
}): Promise<ReleaseAuthorization> {
  const {
    ctx,
    dealId,
    notes,
    confirmedDeliveryWindow,
    expectedConcurrencyVersion,
  } = params;
  assertInternalStaff(ctx);
  assertPermission(
    ctx,
    "release:authorize",
    "Sua função não possui permissão para autorizar a entrega de veículos."
  );

  return withTransaction((db) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("Negociação não encontrada.");
    assertOrganizationAccess(ctx, deal.organizationId);

    if (deal.status === "DELIVERED") {
      throw new ConcurrencyConflictError(
        "O veículo desta negociação já foi entregue."
      );
    }

    if (
      expectedConcurrencyVersion !== undefined &&
      deal.concurrencyVersion !== expectedConcurrencyVersion
    ) {
      throw new ConcurrencyConflictError(
        `Conflito de concorrência detectado: os dados da negociação foram alterados por outro usuário (versão atual: v${deal.concurrencyVersion}, versão esperada: v${expectedConcurrencyVersion}). Atualize a página e revise os dados.`
      );
    }

    const existingActiveAuth = db.releaseAuthorizations.find(
      (ra) => ra.dealId === deal.id && ra.status === "ACTIVE"
    );
    if (existingActiveAuth) {
      throw new ConcurrencyConflictError(
        "Já existe uma autorização de entrega ativa para esta negociação."
      );
    }

    const dealTasks = db.taskInstances.filter((t) => t.dealId === deal.id);
    const dealDocs = db.documents.filter((d) => d.dealId === deal.id);
    const recalculated = recalculateTaskStates(dealTasks, dealDocs);
    const summary = computeDealEligibilityAndSummary(
      deal,
      recalculated,
      dealDocs,
      false
    );

    const nowIso = new Date().toISOString();

    // REGRA CRÍTICA: Ao tentar liberar com pendências:
    // - Bloquear a ação no servidor
    // - Listar todos os requisitos impeditivos, responsáveis e próximos passos
    if (!summary.deliveryEligible || summary.deliveryBlockers.length > 0) {
      db.auditEvents.unshift({
        id: `aud-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: ctx.organization.id,
        dealId: deal.id,
        vehicleId: deal.vehicleId,
        actorId: ctx.profile.id,
        actorName: ctx.profile.fullName,
        actorRole: ctx.roles.join(","),
        action: "RELEASE_AUTHORIZATION_BLOCKED",
        entityType: "DEAL",
        entityId: deal.id,
        summary: `Tentativa prematura de autorização de entrega bloqueada no servidor: ${summary.deliveryBlockers.length} requisito(s) impeditivo(s) pendente(s).`,
        metadata: {
          blockers: summary.deliveryBlockers.map((b) => ({
            code: b.code,
            title: b.title,
            responsibleArea: b.responsibleAreaLabel,
            reason: b.reason,
          })),
        },
        isCustomerVisible: false,
        createdAt: nowIso,
      });

      throw new PreconditionBlockedError(
        `Autorização de entrega bloqueada: existem ${summary.deliveryBlockers.length} requisito(s) obrigatório(s) impeditivo(s).`,
        summary.deliveryBlockers
      );
    }

    const roleUsed: RoleCode = ctx.roles.includes("RELEASE_OFFICER")
      ? "RELEASE_OFFICER"
      : ctx.roles[0];

    const releaseAuth: ReleaseAuthorization = {
      id: `rel-auth-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      authorizedBy: ctx.profile.id,
      roleUsed,
      status: "ACTIVE",
      notes: notes?.trim() || "Todos os requisitos conferidos e autorizados.",
      analyzedDealVersion: deal.concurrencyVersion,
      requirementsSnapshot: {
        completedTaskCodes: recalculated
          .filter((t) => t.state === "COMPLETED")
          .map((t) => t.code),
        approvedDocumentIds: dealDocs.map((d) => ({
          id: d.id,
          version: d.currentVersionNumber,
        })),
        invoiceNumber: deal.invoiceNumber,
      },
      invalidatedAt: null,
      invalidationReason: null,
      createdAt: nowIso,
    };

    db.releaseAuthorizations.push(releaseAuth);

    const authTask = db.taskInstances.find(
      (t) => t.dealId === deal.id && t.code === "TASK_RELEASE_AUTH"
    );
    if (authTask) {
      authTask.state = "COMPLETED";
      authTask.approvalStatus = "APPROVED";
      authTask.completedAt = nowIso;
      authTask.completedBy = ctx.profile.id;
      authTask.updatedAt = nowIso;
    }

    const deliveryTask = db.taskInstances.find(
      (t) => t.dealId === deal.id && t.code === "TASK_CONFIRM_DELIVERY"
    );
    if (deliveryTask) {
      deliveryTask.state = "AVAILABLE";
      deliveryTask.pendingReason =
        "Entrega autorizada! Aguardando reconfirmação do chassi/QR Code pela Operação no ato de entrega das chaves.";
      deliveryTask.updatedAt = nowIso;
    }

    // Regra: A conclusão dos requisitos e a autorização NÃO registram automaticamente que o carro foi entregue!
    deal.status = "DELIVERY_AUTHORIZED";
    deal.currentStage = "DELIVERY";
    if (confirmedDeliveryWindow) {
      deal.confirmedDeliveryDate = confirmedDeliveryWindow;
      deal.confirmedDeliveryBy = ctx.profile.id;
    } else if (!deal.confirmedDeliveryDate) {
      deal.confirmedDeliveryDate = nowIso;
      deal.confirmedDeliveryBy = ctx.profile.id;
    }
    deal.concurrencyVersion += 1;
    deal.updatedAt = nowIso;

    pushNotificationIfNew(db, {
      organizationId: ctx.organization.id,
      recipientProfileId: "user-operacao",
      dealId: deal.id,
      eventType: "DELIVERY_AUTHORIZED",
      title: `Entrega autorizada em ${deal.dealNumber}`,
      message: `A autorização formal de liberação foi emitida por ${ctx.profile.fullName}. O veículo está liberado para entrega física mediante reconfirmação do chassi.`,
      dedupKey: `deliv-auth-${releaseAuth.id}`,
    });

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      vehicleId: deal.vehicleId,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: roleUsed,
      action: "RELEASE_AUTHORIZED",
      entityType: "RELEASE_AUTHORIZATION",
      entityId: releaseAuth.id,
      summary: `Autorização Formal de Entrega emitida por ${ctx.profile.fullName} (${roleUsed}). Veículo pronto para entrega física.`,
      metadata: {
        authorizationId: releaseAuth.id,
        analyzedDealVersion: releaseAuth.analyzedDealVersion,
      },
      isCustomerVisible: true,
      createdAt: nowIso,
    });

    return releaseAuth;
  });
}

export async function confirmPhysicalDelivery(params: {
  ctx: AuthenticatedContext;
  dealId: string;
  confirmedVehicleIdentifier: string;
  recipientName: string;
  recipientDocument: string;
  deliveryNotes?: string;
}): Promise<DeliveryRecord> {
  const {
    ctx,
    dealId,
    confirmedVehicleIdentifier,
    recipientName,
    recipientDocument,
    deliveryNotes,
  } = params;
  assertInternalStaff(ctx);
  assertPermission(
    ctx,
    "delivery:confirm",
    "Sua função não possui permissão para registrar a entrega física do veículo."
  );

  return withTransaction((db) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("Negociação não encontrada.");
    assertOrganizationAccess(ctx, deal.organizationId);

    if (deal.status === "DELIVERED") {
      throw new ConcurrencyConflictError(
        "A entrega física deste veículo já foi registrada anteriormente."
      );
    }

    // 1. Exigir autorização válida
    const activeAuth = db.releaseAuthorizations.find(
      (ra) => ra.dealId === deal.id && ra.status === "ACTIVE"
    );
    if (!activeAuth || deal.status !== "DELIVERY_AUTHORIZED") {
      throw new Error(
        "Entrega bloqueada: não há Autorização Formal de Liberação válida e ativa para esta negociação."
      );
    }

    // 2. Reconfirmar a identificação do veículo (Chassi, Código Interno ou QR Token)
    const vehicle = db.vehicles.find((v) => v.id === deal.vehicleId);
    if (!vehicle) throw new Error("Veículo não encontrado.");

    const cleanIdent = (confirmedVehicleIdentifier || "").trim().toUpperCase();
    const matchesVin = vehicle.vin.toUpperCase() === cleanIdent;
    const matchesCode = vehicle.internalCode.toUpperCase() === cleanIdent;
    const matchesQr = vehicle.qrToken.toUpperCase() === cleanIdent;

    if (!matchesVin && !matchesCode && !matchesQr) {
      throw new Error(
        `Falha na reconfirmação física do veículo: o identificador informado ('${confirmedVehicleIdentifier}') não corresponde ao chassi (${vehicle.vin}) nem ao código interno (${vehicle.internalCode}) do veículo autorizado.`
      );
    }

    // 3. Revalidar os requisitos no momento da entrega
    const dealTasks = db.taskInstances.filter((t) => t.dealId === deal.id);
    const dealDocs = db.documents.filter((d) => d.dealId === deal.id);
    const recalculated = recalculateTaskStates(dealTasks, dealDocs);
    const summary = computeDealEligibilityAndSummary(
      deal,
      recalculated,
      dealDocs,
      true
    );

    if (!summary.deliveryEligible) {
      activeAuth.status = "INVALIDATED";
      activeAuth.invalidatedAt = new Date().toISOString();
      activeAuth.invalidationReason =
        "Requisitos deixaram de ser atendidos na revalidação pré-entrega.";
      deal.status = "ACTIVE";
      throw new PreconditionBlockedError(
        "A autorização foi invalidada porque um ou mais requisitos deixaram de estar válidos na revalidação final.",
        summary.deliveryBlockers
      );
    }

    if (!recipientName.trim() || !recipientDocument.trim()) {
      throw new Error(
        "Informe o nome completo e o documento de quem está recebendo as chaves."
      );
    }

    const nowIso = new Date().toISOString();
    activeAuth.status = "CONSUMED_BY_DELIVERY";

    const deliveryTask = db.taskInstances.find(
      (t) => t.dealId === deal.id && t.code === "TASK_CONFIRM_DELIVERY"
    );
    if (deliveryTask) {
      deliveryTask.state = "COMPLETED";
      deliveryTask.completedAt = nowIso;
      deliveryTask.completedBy = ctx.profile.id;
      deliveryTask.pendingReason = null;
      deliveryTask.updatedAt = nowIso;
    }

    deal.status = "DELIVERED";
    deal.currentStage = "DELIVERY";
    deal.concurrencyVersion += 1;
    deal.updatedAt = nowIso;

    vehicle.stockStatus = "SOLD_DELIVERED";
    vehicle.updatedAt = nowIso;

    const delivery: DeliveryRecord = {
      id: `deliv-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      vehicleId: vehicle.id,
      releaseAuthorizationId: activeAuth.id,
      confirmedBy: ctx.profile.id,
      roleUsed: ctx.roles.includes("OPERATIONS") ? "OPERATIONS" : ctx.roles[0],
      confirmedVin: vehicle.vin,
      confirmedInternalCode: vehicle.internalCode,
      recipientName: recipientName.trim(),
      recipientDocument: recipientDocument.trim(),
      deliveryNotes: deliveryNotes?.trim() || null,
      deliveredAt: nowIso,
      addendums: [],
    };

    db.deliveries.push(delivery);

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      vehicleId: vehicle.id,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: delivery.roleUsed,
      action: "DELIVERY_CONFIRMED",
      entityType: "DELIVERY",
      entityId: delivery.id,
      summary: `Entrega física das chaves realizada e confirmada por ${ctx.profile.fullName}. Veículo ${vehicle.internalCode} (Chassi ${vehicle.vin}) entregue a ${delivery.recipientName} (${delivery.recipientDocument}).`,
      metadata: {
        releaseAuthorizationId: activeAuth.id,
        confirmedVin: vehicle.vin,
        recipientName: delivery.recipientName,
      },
      isCustomerVisible: true,
      createdAt: nowIso,
    });

    return delivery;
  });
}

export async function registerPostDeliveryAddendum(params: {
  ctx: AuthenticatedContext;
  dealId: string;
  note: string;
}): Promise<DeliveryRecord> {
  const { ctx, dealId, note } = params;
  assertInternalStaff(ctx);

  if (!note || note.trim().length < 5) {
    throw new Error("Descreva a retificação ou observação pós-entrega.");
  }

  return withTransaction((db) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("Negociação não encontrada.");
    assertOrganizationAccess(ctx, deal.organizationId);

    const delivery = db.deliveries.find((d) => d.dealId === deal.id);
    if (!delivery) {
      throw new Error(
        "Adendos pós-entrega só podem ser registrados em negociações já entregues."
      );
    }

    const nowIso = new Date().toISOString();
    const addendum = {
      id: `add-${crypto.randomUUID().slice(0, 8)}`,
      authorId: ctx.profile.id,
      authorName: ctx.profile.fullName,
      note: note.trim(),
      createdAt: nowIso,
    };

    // Preserva todo o histórico anterior e acrescenta novo evento imutável
    delivery.addendums.push(addendum);

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: deal.id,
      vehicleId: deal.vehicleId,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: ctx.roles.join(","),
      action: "POST_DELIVERY_ADDENDUM",
      entityType: "DELIVERY",
      entityId: delivery.id,
      summary: `Registro complementar pós-entrega adicionado (histórico original preservado): ${note.trim()}`,
      metadata: { addendumId: addendum.id },
      isCustomerVisible: false,
      createdAt: nowIso,
    });

    return delivery;
  });
}
