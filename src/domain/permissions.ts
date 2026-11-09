import {
  AuthenticatedContext,
  PermissionCode,
  ResponsibleArea,
  RoleCode,
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
