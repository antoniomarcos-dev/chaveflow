import crypto from "crypto";
import {
  AuthenticatedContext,
  RoleCode,
  RoleCodeSchema,
} from "@/domain/types";
import {
  assertInternalStaff,
  assertPermission,
  AuthorizationError,
  resolvePermissionsForRoles,
} from "@/domain/permissions";
import { loadDatabaseState, withTransaction } from "@/infrastructure/database";
import { DEMO_ORG_ID } from "@/infrastructure/seed-data";

export const SESSION_COOKIE_NAME = "chaveflow_session";

export function isDemoEnvironment(): boolean {
  return (process.env.CHAVEFLOW_ENV_MODE || "demo") !== "production";
}

function getSecret(): string {
  return (
    process.env.CHAVEFLOW_SESSION_SECRET ||
    "chaveflow-local-demo-hmac-secret-key-2026"
  );
}

export function createSessionToken(
  profileId: string,
  organizationId: string
): string {
  const issuedAt = Date.now();
  const payload = `${profileId}|${organizationId}|${issuedAt}`;
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}|${sig}`, "utf-8").toString("base64url");
}

export function verifySessionToken(token: string): {
  valid: boolean;
  profileId?: string;
  organizationId?: string;
} {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const parts = raw.split("|");
    if (parts.length !== 4) return { valid: false };
    const [profileId, organizationId, issuedAt, sig] = parts;
    const payload = `${profileId}|${organizationId}|${issuedAt}`;
    const expected = crypto
      .createHmac("sha256", getSecret())
      .update(payload)
      .digest("hex");
    if (sig !== expected) return { valid: false };
    return { valid: true, profileId, organizationId };
  } catch {
    return { valid: false };
  }
}

export function buildAuthenticatedContext(
  profileId: string,
  preferredOrgId?: string
): AuthenticatedContext | null {
  const db = loadDatabaseState();
  const profile = db.profiles.find(
    (p) => p.id === profileId && p.isActive
  );
  if (!profile) return null;

  const memberships = db.memberships.filter(
    (m) => m.profileId === profile.id && m.isActive
  );

  const selectedMembership =
    (preferredOrgId
      ? memberships.find((m) => m.organizationId === preferredOrgId)
      : memberships[0]) ?? memberships[0];

  if (!selectedMembership) return null;

  const organization = db.organizations.find(
    (o) => o.id === selectedMembership.organizationId
  );
  if (!organization) return null;

  const branch = selectedMembership.branchId
    ? db.branches.find((b) => b.id === selectedMembership.branchId) ?? null
    : db.branches.find((b) => b.organizationId === organization.id) ?? null;

  const roles = selectedMembership.roles;
  const permissions = resolvePermissionsForRoles(roles);

  const customerRecord = db.customers.find(
    (c) =>
      c.organizationId === organization.id && c.profileId === profile.id
  );

  return {
    profile,
    organization,
    branch,
    membership: selectedMembership,
    roles,
    permissions,
    customerRecordId: customerRecord?.id ?? null,
  };
}

export async function authenticateWithCredentials(params: {
  email: string;
  password?: string;
}): Promise<{
  context: AuthenticatedContext;
  sessionToken: string;
}> {
  const db = loadDatabaseState();
  const cleanEmail = params.email.trim().toLowerCase();
  const profile = db.profiles.find(
    (p) => p.email.toLowerCase() === cleanEmail && p.isActive
  );

  if (!profile) {
    throw new AuthorizationError(
      "Credenciais inválidas ou usuário não encontrado.",
      "INVALID_CREDENTIALS",
      401
    );
  }

  const expectedPass = profile.passwordHash.replace(/^demo:/, "");
  if (params.password && params.password !== expectedPass) {
    throw new AuthorizationError(
      "Senha incorreta.",
      "INVALID_CREDENTIALS",
      401
    );
  }

  const context = buildAuthenticatedContext(profile.id);
  if (!context) {
    throw new AuthorizationError(
      "Usuário não possui vínculo ativo com nenhuma organização.",
      "NO_ORG_MEMBERSHIP",
      403
    );
  }

  const sessionToken = createSessionToken(
    context.profile.id,
    context.organization.id
  );

  return { context, sessionToken };
}

export async function switchDemoPersona(params: {
  targetProfileId: string;
}): Promise<{
  context: AuthenticatedContext;
  sessionToken: string;
}> {
  if (!isDemoEnvironment()) {
    throw new AuthorizationError(
      "A alternância simplificada de persona é exclusiva do modo demonstrativo.",
      "DEMO_ONLY_FEATURE",
      403
    );
  }

  const context = buildAuthenticatedContext(params.targetProfileId);
  if (!context) {
    throw new AuthorizationError(
      "Persona demonstrativa não encontrada.",
      "NOT_FOUND",
      404
    );
  }

  const sessionToken = createSessionToken(
    context.profile.id,
    context.organization.id
  );

  return { context, sessionToken };
}

/**
 * Convite de colaborador interno — exige permissão user:manage no servidor.
 * Impede também que cadastros públicos atribuam funções privilegiadas.
 */
export async function inviteCollaborator(params: {
  ctx: AuthenticatedContext | null;
  isPublicSelfSignup?: boolean;
  email: string;
  fullName: string;
  phone: string;
  branchId: string;
  roles: RoleCode[];
}): Promise<{ profileId: string; membershipId: string }> {
  // Regra obrigatória: Não permitir que um cadastro público escolha funções privilegiadas
  if (params.isPublicSelfSignup || !params.ctx) {
    const requestedPrivileged = params.roles.some((r) => r !== "CUSTOMER");
    if (requestedPrivileged) {
      throw new AuthorizationError(
        "Bloqueado no servidor: um cadastro público não pode escolher funções internas ou privilegiadas.",
        "PRIVILEGED_ROLE_SIGNUP_FORBIDDEN",
        403
      );
    }
  }

  const ctx = params.ctx!;
  assertInternalStaff(ctx);
  assertPermission(
    ctx,
    "user:manage",
    "Somente Administradores podem convidar colaboradores ou atribuir funções."
  );

  for (const r of params.roles) {
    RoleCodeSchema.parse(r);
  }

  return withTransaction((db) => {
    const cleanEmail = params.email.trim().toLowerCase();
    const existing = db.profiles.find(
      (p) => p.email.toLowerCase() === cleanEmail
    );
    if (existing) {
      throw new Error(`Já existe um usuário cadastrado com o e-mail ${cleanEmail}.`);
    }

    const nowIso = new Date().toISOString();
    const profileId = `user-${crypto.randomUUID().slice(0, 8)}`;
    const membershipId = `memb-${crypto.randomUUID().slice(0, 8)}`;

    db.profiles.push({
      id: profileId,
      email: cleanEmail,
      fullName: params.fullName.trim(),
      phone: params.phone.trim(),
      passwordHash: "demo:chaveflow123",
      isCustomerOnly: params.roles.length === 1 && params.roles[0] === "CUSTOMER",
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    db.memberships.push({
      id: membershipId,
      organizationId: ctx.organization.id,
      branchId: params.branchId || ctx.branch?.id || null,
      profileId,
      roles: params.roles,
      isActive: true,
      invitedBy: ctx.profile.id,
      createdAt: nowIso,
    });

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: null,
      vehicleId: null,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: ctx.roles.join(","),
      action: "COLLABORATOR_INVITED",
      entityType: "PROFILE",
      entityId: profileId,
      summary: `Colaborador '${params.fullName}' (${cleanEmail}) convidado com as funções: ${params.roles.join(", ")}.`,
      metadata: { roles: params.roles, branchId: params.branchId },
      isCustomerVisible: false,
      createdAt: nowIso,
    });

    return { profileId, membershipId };
  });
}

export function listDemoPersonas() {
  const db = loadDatabaseState();
  return db.memberships
    .filter((m) => m.organizationId === DEMO_ORG_ID && m.isActive)
    .map((m) => {
      const profile = db.profiles.find((p) => p.id === m.profileId)!;
      return {
        profileId: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        roles: m.roles,
        isCustomerOnly: profile.isCustomerOnly,
      };
    });
}
