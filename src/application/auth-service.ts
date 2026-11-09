import {
  assertInternalStaff,
  assertPermission,
  AuthorizationError,
  resolvePermissionsForRoles,
} from "@/domain/permissions";
import { AuthenticatedContext, RoleCode, RoleCodeSchema } from "@/domain/types";
import { loadDatabaseState, withTransaction } from "@/infrastructure/database";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { getSigningSecret } from "@/lib/secrets";
import crypto from "crypto";

export const SESSION_COOKIE_NAME = "chaveflow_session";

export function createSessionToken(
  profileId: string,
  organizationId: string,
): string {
  const issuedAt = Date.now();
  const payload = `${profileId}|${organizationId}|${issuedAt}`;
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}|${sig}`, "utf-8").toString("base64url");
}

export function verifySessionToken(token: string): {
  valid: boolean;
  profileId?: string;
  organizationId?: string;
  issuedAt?: number;
} {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const parts = raw.split("|");
    if (parts.length !== 4) return { valid: false };
    const [profileId, organizationId, issuedAt, sig] = parts;
    const payload = `${profileId}|${organizationId}|${issuedAt}`;
    const expected = crypto
      .createHmac("sha256", getSigningSecret())
      .update(payload)
      .digest("hex");
    if (
      !/^[a-f0-9]{64}$/.test(sig) ||
      !crypto.timingSafeEqual(
        Buffer.from(sig, "hex"),
        Buffer.from(expected, "hex"),
      )
    )
      return { valid: false };
    const timestamp = Number(issuedAt);
    if (
      !Number.isFinite(timestamp) ||
      timestamp > Date.now() ||
      Date.now() - timestamp > 7 * 86400000
    )
      return { valid: false };
    return { valid: true, profileId, organizationId, issuedAt: timestamp };
  } catch {
    return { valid: false };
  }
}

export async function buildAuthenticatedContext(
  profileId: string,
  preferredOrgId?: string,
): Promise<AuthenticatedContext | null> {
  const db = await loadDatabaseState();
  const profile = db.profiles.find((p) => p.id === profileId && p.isActive);
  if (!profile) return null;

  const memberships = db.memberships.filter(
    (m) => m.profileId === profile.id && m.isActive,
  );

  const selectedMembership = preferredOrgId
    ? memberships.find((m) => m.organizationId === preferredOrgId)
    : memberships[0];

  if (!selectedMembership) return null;

  const organization = db.organizations.find(
    (o) => o.id === selectedMembership.organizationId,
  );
  if (!organization) return null;

  const branch = selectedMembership.branchId
    ? (db.branches.find((b) => b.id === selectedMembership.branchId) ?? null)
    : (db.branches.find((b) => b.organizationId === organization.id) ?? null);

  const roles = selectedMembership.roles;
  const permissions = resolvePermissionsForRoles(roles);

  const customerRecord = db.customers.find(
    (c) => c.organizationId === organization.id && c.profileId === profile.id,
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
  const db = await loadDatabaseState();
  const cleanEmail = params.email.trim().toLowerCase();
  const profile = db.profiles.find(
    (p) => p.email.toLowerCase() === cleanEmail && p.isActive,
  );

  if (!profile) {
    throw new AuthorizationError(
      "E-mail ou senha inválidos.",
      "INVALID_CREDENTIALS",
      401,
    );
  }

  if (!verifyPassword(params.password || "", profile.passwordHash)) {
    throw new AuthorizationError(
      "E-mail ou senha inválidos.",
      "INVALID_CREDENTIALS",
      401,
    );
  }

  const context = await buildAuthenticatedContext(profile.id);
  if (!context) {
    throw new AuthorizationError(
      "Usuário não possui vínculo ativo com nenhuma organização.",
      "NO_ORG_MEMBERSHIP",
      403,
    );
  }

  const sessionToken = createSessionToken(
    context.profile.id,
    context.organization.id,
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
        403,
      );
    }
  }

  const ctx = params.ctx!;
  assertInternalStaff(ctx);
  assertPermission(
    ctx,
    "user:manage",
    "Somente Administradores podem convidar colaboradores ou atribuir funções.",
  );

  if (
    !params.roles.length ||
    !params.email.includes("@") ||
    params.fullName.trim().length < 3
  )
    throw new Error("Informe nome, e-mail e ao menos uma função.");
  if (
    params.branchId &&
    !(await loadDatabaseState()).branches.some(
      (b) =>
        b.id === params.branchId && b.organizationId === ctx.organization.id,
    )
  )
    throw new Error("Unidade inválida.");
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.CHAVEFLOW_EMAIL_FROM ||
    !process.env.CHAVEFLOW_APP_URL
  )
    throw new Error(
      "Configure o envio de e-mail antes de convidar colaboradores.",
    );
  for (const r of params.roles) {
    RoleCodeSchema.parse(r);
  }

  const result = await withTransaction((db) => {
    const cleanEmail = params.email.trim().toLowerCase();
    const existing = db.profiles.find(
      (p) => p.email.toLowerCase() === cleanEmail,
    );
    if (existing) {
      throw new Error(
        `Já existe um usuário cadastrado com o e-mail ${cleanEmail}.`,
      );
    }

    const nowIso = new Date().toISOString();
    const profileId = `user-${crypto.randomUUID().slice(0, 8)}`;
    const membershipId = `memb-${crypto.randomUUID().slice(0, 8)}`;

    db.profiles.push({
      id: profileId,
      email: cleanEmail,
      fullName: params.fullName.trim(),
      phone: params.phone.trim(),
      passwordHash: hashPassword(crypto.randomBytes(32).toString("hex")),
      isCustomerOnly:
        params.roles.length === 1 && params.roles[0] === "CUSTOMER",
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
  const { sendPasswordReset } =
    await import("@/application/password-reset-service");
  await sendPasswordReset(params.email);
  return result;
}
