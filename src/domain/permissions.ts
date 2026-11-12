import {
  AuthenticatedContext,
  Deal,
  DealDocument,
  Membership,
  PermissionCode,
  ResponsibleArea,
  RoleCode,
  UserProfile,
  Vehicle,
} from "./types";

export const ROLE_PERMISSION_MAP: Record<RoleCode, PermissionCode[]> = {
  ADMIN: [
    "deal:create",
    "deal:view",
    "task:assign",
    "task:execute",
    "document:request",
    "document:upload",
    "document:review",
    "approval:finance",
    "approval:documentation",
    "billing:register",
    "release:authorize",
    "delivery:confirm",
    "procedure:manage",
    "vehicle:manage",
    "user:manage",
    "report:view",
  ],
  MANAGER: [
    "deal:create",
    "deal:view",
    "task:assign",
    "task:execute",
    "document:request",
    "document:upload",
    "document:review",
    "approval:finance",
    "approval:documentation",
    "release:authorize",
    "procedure:manage",
    "vehicle:manage",
    "report:view",
  ],
  SELLER: [
    "deal:create",
    "deal:view",
    "task:execute",
    "document:upload",
  ],
  FINANCE: [
    "deal:view",
    "task:assign",
    "task:execute",
    "document:request",
    "document:upload",
    "approval:finance",
  ],
  DOCUMENTATION: [
    "deal:view",
    "task:assign",
    "task:execute",
    "document:request",
    "document:upload",
    "document:review",
    "approval:documentation",
  ],
  BILLING: [
    "deal:view",
    "task:execute",
    "document:upload",
    "billing:register",
  ],
  OPERATIONS: [
    "deal:view",
    "task:execute",
    "document:upload",
    "delivery:confirm",
  ],
  RELEASE_OFFICER: [
    "deal:view",
    "task:assign",
    "task:execute",
    "release:authorize",
    "report:view",
  ],
  CUSTOMER: [
    "customer_portal:access",
  ],
};

export const AREA_TO_ROLES: Record<ResponsibleArea, RoleCode[]> = {
  COMMERCIAL: ["SELLER", "MANAGER", "ADMIN"],
  FINANCE: ["FINANCE", "MANAGER", "ADMIN"],
  DOCUMENTATION: ["DOCUMENTATION", "MANAGER", "ADMIN"],
  BILLING: ["BILLING", "MANAGER", "ADMIN"],
  OPERATIONS: ["OPERATIONS", "MANAGER", "ADMIN"],
  RELEASE: ["RELEASE_OFFICER", "MANAGER", "ADMIN"],
  MANAGEMENT: ["MANAGER", "ADMIN"],
};
export const AREA_COMPATIBLE_ROLES = AREA_TO_ROLES;

export function resolvePermissionsForRoles(roles: RoleCode[]): PermissionCode[] {
  const set = new Set<PermissionCode>();
  for (const role of roles) {
    const perms = ROLE_PERMISSION_MAP[role] ?? [];
    for (const p of perms) {
      set.add(p);
    }
  }
  return Array.from(set);
}

export function hasPermission(
  ctx: Pick<AuthenticatedContext, "permissions" | "roles">,
  permission: PermissionCode
): boolean {
  if (ctx.roles.includes("ADMIN")) return true;
  return ctx.permissions.includes(permission);
}

export function canActOnArea(
  ctx: Pick<AuthenticatedContext, "roles">,
  area: ResponsibleArea
): boolean {
  if (ctx.roles.includes("ADMIN") || ctx.roles.includes("MANAGER")) return true;
  const allowedRoles = AREA_TO_ROLES[area] ?? [];
  return ctx.roles.some((r) => allowedRoles.includes(r));
}

export function canApproveTaskRole(
  ctx: Pick<AuthenticatedContext, "roles" | "permissions">,
  requiredRole: RoleCode | null
): boolean {
  if (!requiredRole) return true;
  if (ctx.roles.includes("ADMIN") || ctx.roles.includes("MANAGER")) {
    // Mesmo gestor/admin deve ter a permissão da aprovação correspondente
    if (requiredRole === "FINANCE") return hasPermission(ctx, "approval:finance");
    if (requiredRole === "DOCUMENTATION") return hasPermission(ctx, "approval:documentation");
    if (requiredRole === "BILLING") return hasPermission(ctx, "billing:register");
    if (requiredRole === "RELEASE_OFFICER") return hasPermission(ctx, "release:authorize");
    return true;
  }
  return ctx.roles.includes(requiredRole);
}

export class AuthorizationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, code = "FORBIDDEN", statusCode = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function assertOrganizationAccess(
  ctx: Pick<AuthenticatedContext, "organization">,
  recordOrganizationId: string
): void {
  if (ctx.organization.id !== recordOrganizationId) {
    throw new AuthorizationError(
      "Acesso negado: registro pertence a outra organização.",
      "ORG_ISOLATION_VIOLATION",
      403
    );
  }
}

export function assertPermission(
  ctx: Pick<AuthenticatedContext, "permissions" | "roles">,
  permission: PermissionCode,
  customMessage?: string
): void {
  if (!hasPermission(ctx, permission)) {
    throw new AuthorizationError(
      customMessage ??
        `Permissão insuficiente no servidor: a ação requer '${permission}'.`,
      "INSUFFICIENT_PERMISSION",
      403
    );
  }
}

export function assertInternalStaff(
  ctx: Pick<AuthenticatedContext, "roles" | "profile">
): void {
  if (
    ctx.profile.isCustomerOnly ||
    (ctx.roles.length === 1 && ctx.roles[0] === "CUSTOMER")
  ) {
    throw new AuthorizationError(
      "Acesso restrito à equipe interna da concessionária.",
      "CUSTOMER_CANNOT_ACCESS_INTERNAL",
      403
    );
  }
}

export function isSellerOnlyContext(
  ctx: Pick<AuthenticatedContext, "roles">
): boolean {
  return ctx.roles.length > 0 && ctx.roles.every((r) => r === "SELLER");
}

export function canAccessDealRecord(
  ctx: Pick<AuthenticatedContext, "organization" | "profile" | "roles">,
  deal: Pick<Deal, "organizationId" | "sellerId">
): boolean {
  if (ctx.organization.id !== deal.organizationId) return false;
  if (
    ctx.profile.isCustomerOnly ||
    (ctx.roles.length === 1 && ctx.roles[0] === "CUSTOMER")
  ) {
    return false;
  }
  if (isSellerOnlyContext(ctx) && deal.sellerId !== ctx.profile.id) {
    return false;
  }
  return true;
}

export function assertDealRecordAccess(
  ctx: Pick<AuthenticatedContext, "organization" | "profile" | "roles">,
  deal: Pick<Deal, "organizationId" | "sellerId">
): void {
  assertOrganizationAccess(ctx, deal.organizationId);
  assertInternalStaff(ctx);
  if (isSellerOnlyContext(ctx) && deal.sellerId !== ctx.profile.id) {
    throw new AuthorizationError(
      "Acesso restrito: o perfil Vendedor só pode acessar ou alterar negociações sob sua própria responsabilidade.",
      "SELLER_OWN_DEALS_ONLY",
      403
    );
  }
}

export function canReviewDocument(
  ctx: Pick<AuthenticatedContext, "roles" | "permissions">,
  doc: Pick<DealDocument, "responsibleArea">
): boolean {
  if (doc.responsibleArea === "FINANCE") {
    return hasPermission(ctx, "approval:finance");
  }
  return (
    hasPermission(ctx, "document:review") ||
    hasPermission(ctx, "approval:documentation")
  );
}

export function assertDocumentReviewPermission(
  ctx: Pick<AuthenticatedContext, "roles" | "permissions">,
  doc: Pick<DealDocument, "responsibleArea">
): void {
  if (doc.responsibleArea === "FINANCE") {
    if (!hasPermission(ctx, "approval:finance")) {
      throw new AuthorizationError(
        "Sua função não possui autoridade financeira para conferir documentos da área Financeira.",
        "FINANCE_REVIEW_FORBIDDEN",
        403
      );
    }
    return;
  }
  if (!canReviewDocument(ctx, doc)) {
    throw new AuthorizationError(
      "Sua função não possui permissão para conferir documentos.",
      "INSUFFICIENT_PERMISSION",
      403
    );
  }
}

export function isVehicleSellable(
  vehicle: Pick<Vehicle, "stockStatus">,
  hasConflictingActiveDeal: boolean
): boolean {
  if (hasConflictingActiveDeal) return false;
  return vehicle.stockStatus === "AVAILABLE";
}

export function validateStaffAssigneeForArea(params: {
  profiles: UserProfile[];
  memberships: Membership[];
  organizationId: string;
  profileId: string;
  responsibleArea: ResponsibleArea;
}): { profile: UserProfile; membership: Membership } {
  const {
    profiles,
    memberships,
    organizationId,
    profileId,
    responsibleArea,
  } = params;
  const profile = profiles.find(
    (p) => p.id === profileId && p.isActive && !p.isCustomerOnly
  );
  const membership = memberships.find(
    (m) =>
      m.organizationId === organizationId &&
      m.profileId === profileId &&
      m.isActive &&
      !m.roles.every((r) => r === "CUSTOMER")
  );
  if (
    !profile ||
    !membership ||
    !canActOnArea({ roles: membership.roles }, responsibleArea)
  ) {
    throw new Error(
      "Selecione um responsável ativo da organização com acesso à área da tarefa."
    );
  }
  return { profile, membership };
}
