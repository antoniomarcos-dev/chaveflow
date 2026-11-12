import {
  assertDealRecordAccess,
  AuthorizationError,
} from "@/domain/permissions";
import {
  AuthenticatedContext,
  DEAL_STATUS_LABELS,
  DOCUMENT_STATUS_LABELS,
  WORKFLOW_STAGES,
  WorkflowStageCode,
} from "@/domain/types";
import { loadDatabaseState, withTransaction } from "@/infrastructure/database";

export interface CustomerSafeDealView {
  dealId: string;
  dealNumber: string;
  status: string;
  statusLabel: string;
  currentStage: WorkflowStageCode;
  customerName: string;
  vehicle: {
    brand: string;
    model: string;
    trim: string;
    modelYear: number;
    color: string;
    condition: "NEW" | "USED";
    photos: string[];
  };
  sellerContact: {
    fullName: string;
    email: string;
    phone: string;
  };
  deliveryForecast: {
    isConfirmedByAuthorizedStaff: boolean;
    confirmedDateIso: string | null;
    publicMessage: string;
  };
  shareableStages: Array<{
    code: WorkflowStageCode;
    name: string;
    description: string;
    state: "COMPLETED" | "CURRENT" | "UPCOMING";
  }>;
  documentRequests: Array<{
    id: string;
    title: string;
    category: string;
    whyRequired: string;
    status: string;
    statusLabel: string;
    currentVersionNumber: number;
    customerActionNeeded: boolean;
    customerSafeFeedback: string | null;
  }>;
  customerUpdates: Array<{
    id: string;
    summary: string;
    createdAt: string;
  }>;
}

export async function listDealsForAuthenticatedCustomer(
  ctx: AuthenticatedContext,
): Promise<
  Array<{
    dealId: string;
    dealNumber: string;
    vehicleLabel: string;
    statusLabel: string;
    updatedAt: string;
  }>
> {
  const db = await loadDatabaseState();

  const matchingCustomerIds = db.customers
    .filter(
      (c) =>
        c.organizationId === ctx.organization.id &&
        c.profileId === ctx.profile.id,
    )
    .map((c) => c.id);

  if (matchingCustomerIds.length === 0) {
    return [];
  }

  return db.deals
    .filter(
      (d) =>
        d.organizationId === ctx.organization.id &&
        matchingCustomerIds.includes(d.customerId) &&
        d.status !== "DRAFT",
    )
    .map((d) => {
      const veh = db.vehicles.find((v) => v.id === d.vehicleId)!;
      return {
        dealId: d.id,
        dealNumber: d.dealNumber,
        vehicleLabel: `${veh.brand} ${veh.model} ${veh.trim} (${veh.color})`,
        statusLabel: DEAL_STATUS_LABELS[d.status],
        updatedAt: d.updatedAt,
      };
    });
}

export async function getCustomerSafeDealView(params: {
  ctx: AuthenticatedContext | null;
  dealId?: string;
  accessToken?: string;
}): Promise<CustomerSafeDealView> {
  const { ctx, dealId, accessToken } = params;
  const db = await loadDatabaseState();

  let targetDealId = dealId;
  let authorizedCustomerId: string | null = null;
  let targetOrgId: string | null = null;

  // Caso 1: Acesso via token individual de convite (com verificação de validade e revogação, e bloqueio explícito de QR Code de veículo!)
  if (accessToken) {
    const cleanToken = accessToken.trim();
    const isVehicleQr = db.vehicles.some(
      (v) =>
        v.qrToken.toLowerCase() === cleanToken.toLowerCase() ||
        v.internalCode.toLowerCase() === cleanToken.toLowerCase(),
    );
    if (isVehicleQr) {
      throw new AuthorizationError(
        "Acesso negado: o QR Code do veículo é de uso interno da concessionária e não concede acesso à área do comprador.",
        "VEHICLE_QR_FORBIDDEN_FOR_CUSTOMER_PORTAL",
        403,
      );
    }

    const grant = db.customerAccessGrants.find(
      (g) => g.accessToken === cleanToken,
    );
    if (!grant) {
      throw new AuthorizationError(
        "Link de convite inválido ou não encontrado.",
        "INVALID_ACCESS_GRANT",
        403,
      );
    }
    if (grant.revokedAt) {
      throw new AuthorizationError(
        "Este convite de acesso foi revogado pela concessionária.",
        "REVOKED_ACCESS_GRANT",
        403,
      );
    }
    if (new Date(grant.expiresAt).getTime() < Date.now()) {
      throw new AuthorizationError(
        "Este convite de acesso expirou. Solicite um novo link ao seu vendedor.",
        "EXPIRED_ACCESS_GRANT",
        403,
      );
    }
    if (targetDealId && grant.dealId !== targetDealId) {
      throw new AuthorizationError(
        "Este convite não permite acessar outra negociação.",
        "GRANT_DEAL_MISMATCH",
        403,
      );
    }

    targetDealId = grant.dealId;
    authorizedCustomerId = grant.customerId;
    targetOrgId = grant.organizationId;
  } else if (ctx) {
    // Caso 2: Acesso via conta autenticada
    targetOrgId = ctx.organization.id;
    const customerRecords = db.customers.filter(
      (c) =>
        c.organizationId === ctx.organization.id &&
        c.profileId === ctx.profile.id,
    );
    if (customerRecords.length > 0) {
      authorizedCustomerId = customerRecords[0].id;
    } else if (!ctx.profile.isCustomerOnly && ctx.roles.includes("ADMIN")) {
      // Administrador pode pré-visualizar a visão segura do cliente da própria organização
      const d = db.deals.find(
        (deal) =>
          deal.id === targetDealId &&
          deal.organizationId === ctx.organization.id,
      );
      authorizedCustomerId = d?.customerId ?? null;
    }
  }

  if (!targetDealId || !authorizedCustomerId || !targetOrgId) {
    throw new AuthorizationError(
      "Acesso não autorizado à área do cliente.",
      "CUSTOMER_UNAUTHORIZED",
      403,
    );
  }

  const deal = db.deals.find((d) => d.id === targetDealId);
  if (!deal) {
    throw new Error("Negociação não encontrada.");
  }

  if (
    deal.organizationId !== targetOrgId ||
    deal.customerId !== authorizedCustomerId
  ) {
    throw new AuthorizationError(
      "Acesso negado: o cliente só pode acessar suas próprias negociações.",
      "CUSTOMER_ISOLATION_VIOLATION",
      403,
    );
  }

  const vehicle = db.vehicles.find((v) => v.id === deal.vehicleId)!;
  const customer = db.customers.find((c) => c.id === deal.customerId)!;
  const seller = db.profiles.find((p) => p.id === deal.sellerId)!;

  const currentStageOrder =
    WORKFLOW_STAGES.find((s) => s.code === deal.currentStage)?.order ?? 1;

  const shareableStages = WORKFLOW_STAGES.map((stage) => {
    let state: "COMPLETED" | "CURRENT" | "UPCOMING" = "UPCOMING";
    if (deal.status === "DELIVERED" || stage.order < currentStageOrder) {
      state = "COMPLETED";
    } else if (stage.order === currentStageOrder) {
      state = "CURRENT";
    }
    return {
      code: stage.code,
      name: stage.name,
      description: stage.description,
      state,
    };
  });

  // Filtra somente documentos visíveis ao cliente e remove justificativas sensíveis internas
  const documentRequests = db.documents
    .filter((d) => d.dealId === deal.id && d.isCustomerVisible)
    .map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      whyRequired: d.whyRequired,
      status: d.status,
      statusLabel: DOCUMENT_STATUS_LABELS[d.status],
      currentVersionNumber: d.currentVersionNumber,
      customerActionNeeded:
        d.status === "REQUESTED" ||
        d.status === "REJECTED" ||
        d.status === "CORRECTION_REQUESTED",
      customerSafeFeedback:
        d.status === "REJECTED" || d.status === "CORRECTION_REQUESTED"
          ? d.customerRejectionGuidance?.trim() ||
            "Por favor, envie uma nova versão legível deste documento ou contate seu vendedor."
          : null,
    }));

  // Filtra somente atualizações explicitamente compartilháveis (isCustomerVisible === true) e limpa códigos técnicos
  const customerUpdates = db.auditEvents
    .filter((ev) => ev.dealId === deal.id && ev.isCustomerVisible)
    .slice(0, 15)
    .map((ev) => ({
      id: ev.id,
      summary: ev.summary
        .replace(/\b(TASK|DOC)_[A-Z0-9_]+\b/g, "")
        .replace(/\(\s*\)/g, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
      createdAt: ev.createdAt,
    }));

  // Regra: Previsão de entrega somente quando confirmada por pessoa autorizada!
  const isConfirmed = Boolean(
    deal.confirmedDeliveryDate && deal.confirmedDeliveryBy,
  );

  return {
    dealId: deal.id,
    dealNumber: deal.dealNumber,
    status: deal.status,
    statusLabel: DEAL_STATUS_LABELS[deal.status],
    currentStage: deal.currentStage,
    customerName: customer.fullName,
    vehicle: {
      brand: vehicle.brand,
      model: vehicle.model,
      trim: vehicle.trim,
      modelYear: vehicle.modelYear,
      color: vehicle.color,
      condition: vehicle.condition,
      photos: vehicle.photos,
    },
    sellerContact: {
      fullName: seller.fullName,
      email: seller.email,
      phone: seller.phone,
    },
    deliveryForecast: {
      isConfirmedByAuthorizedStaff: isConfirmed,
      confirmedDateIso: isConfirmed ? deal.confirmedDeliveryDate : null,
      publicMessage: isConfirmed
        ? `Entrega confirmada pela concessionária para ${new Date(
            deal.confirmedDeliveryDate!,
          ).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`
        : "Em preparação e conferência. A data de entrega será exibida aqui assim que confirmada oficialmente pela liberação.",
    },
    shareableStages,
    documentRequests,
    customerUpdates,
  };
}

export async function revokeCustomerAccessGrant(params: {
  ctx: AuthenticatedContext;
  dealId: string;
}): Promise<void> {
  const { ctx, dealId } = params;
  if (ctx.profile.isCustomerOnly || !ctx.permissions.includes("deal:view"))
    throw new AuthorizationError(
      "Somente a equipe interna pode revogar convites.",
      "FORBIDDEN",
      403,
    );
  return await withTransaction((db) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (deal) {
      assertDealRecordAccess(ctx, deal);
    }
    const nowIso = new Date().toISOString();
    for (const g of db.customerAccessGrants.filter(
      (gr) =>
        gr.organizationId === ctx.organization.id &&
        gr.dealId === dealId &&
        !gr.revokedAt,
    )) {
      g.revokedAt = nowIso;
    }
  });
}
