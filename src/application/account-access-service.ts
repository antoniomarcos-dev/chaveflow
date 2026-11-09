import {
  assertInternalStaff,
  assertPermission,
  AuthorizationError,
} from "@/domain/permissions";
import type { AuthenticatedContext } from "@/domain/types";
import { withTransaction } from "@/infrastructure/database";
import type { DatabaseState } from "@/infrastructure/database-state";
import { hashPassword } from "@/lib/passwords";
import crypto from "node:crypto";

export function issueAccountActivation(
  db: DatabaseState,
  profileId: string,
): string {
  const token = crypto.randomBytes(32).toString("hex");
  db.passwordResetTokens = (db.passwordResetTokens ?? []).filter(
    (t) => t.profileId !== profileId && t.expiresAt > Date.now(),
  );
  db.passwordResetTokens.push({
    hash: crypto.createHash("sha256").update(token).digest("hex"),
    profileId,
    expiresAt: Date.now() + 24 * 3600000,
  });
  return `/redefinir-senha?token=${token}`;
}

export async function createCustomerAccountAccess({
  ctx,
  dealId,
}: {
  ctx: AuthenticatedContext;
  dealId: string;
}) {
  assertInternalStaff(ctx);
  assertPermission(ctx, "deal:create");
  return withTransaction((db) => {
    const deal = db.deals.find(
      (d) =>
        d.id === dealId &&
        d.organizationId === ctx.organization.id &&
        d.status !== "DRAFT",
    );
    if (!deal)
      throw new AuthorizationError(
        "Negociação não encontrada.",
        "NOT_FOUND",
        404,
      );
    if (
      !ctx.roles.some((r) => r === "ADMIN" || r === "MANAGER") &&
      deal.sellerId !== ctx.profile.id
    )
      throw new AuthorizationError(
        "Você pode criar acessos apenas para clientes das suas negociações.",
      );
    const customer = db.customers.find(
      (c) =>
        c.id === deal.customerId && c.organizationId === ctx.organization.id,
    );
    if (!customer || !/^\S+@\S+\.\S+$/.test(customer.email))
      throw new Error(
        "Cadastre um e-mail válido para o comprador antes de criar o acesso.",
      );
    const email = customer.email.trim().toLowerCase();
    let profile = customer.profileId
      ? db.profiles.find((p) => p.id === customer.profileId)
      : db.profiles.find((p) => p.email.toLowerCase() === email);
    const now = new Date().toISOString();
    if (profile) {
      const member = db.memberships.find(
        (m) =>
          m.profileId === profile!.id &&
          m.organizationId === ctx.organization.id &&
          m.isActive,
      );
      if (
        !profile.isCustomerOnly ||
        !profile.isActive ||
        profile.email.toLowerCase() !== email ||
        !member ||
        member.roles.some((r) => r !== "CUSTOMER") ||
        db.customers.some(
          (c) => c.profileId === profile!.id && c.id !== customer.id,
        )
      )
        throw new AuthorizationError(
          "Este e-mail já está associado a outra conta. Contate o administrador.",
        );
    } else {
      profile = {
        id: crypto.randomUUID(),
        email,
        fullName: customer.fullName,
        phone: customer.phone,
        passwordHash: hashPassword(crypto.randomBytes(32).toString("hex")),
        isCustomerOnly: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      db.profiles.push(profile);
      db.memberships.push({
        id: crypto.randomUUID(),
        organizationId: ctx.organization.id,
        branchId: deal.branchId,
        profileId: profile.id,
        roles: ["CUSTOMER"],
        isActive: true,
        invitedBy: ctx.profile.id,
        createdAt: now,
      });
    }
    customer.profileId = profile.id;
    customer.updatedAt = now;
    const activationPath = issueAccountActivation(db, profile.id);
    db.auditEvents.unshift({
      id: crypto.randomUUID(),
      organizationId: ctx.organization.id,
      dealId: deal.id,
      vehicleId: deal.vehicleId,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: ctx.roles.join(","),
      action: "CUSTOMER_ACCOUNT_ACCESS_CREATED",
      entityType: "PROFILE",
      entityId: profile.id,
      summary: `Acesso do comprador ${customer.fullName} preparado pelo responsável da negociação.`,
      metadata: {},
      isCustomerVisible: false,
      createdAt: now,
    });
    return { activationPath, email, fullName: profile.fullName };
  });
}

export async function manageCollaboratorAccess({
  ctx,
  profileId,
  action,
}: {
  ctx: AuthenticatedContext;
  profileId: string;
  action: "REISSUE" | "DISABLE" | "ENABLE";
}) {
  assertInternalStaff(ctx);
  assertPermission(ctx, "user:manage");
  if (profileId === ctx.profile.id)
    throw new Error("Use a recuperação de senha para sua própria conta.");
  return withTransaction((db) => {
    const member = db.memberships.find(
      (m) =>
        m.organizationId === ctx.organization.id &&
        m.profileId === profileId &&
        !m.roles.includes("CUSTOMER"),
    );
    const profile = db.profiles.find((p) => p.id === profileId);
    if (!member || !profile || profile.isCustomerOnly)
      throw new AuthorizationError(
        "Colaborador não encontrado.",
        "NOT_FOUND",
        404,
      );
    if (action === "DISABLE") member.isActive = false;
    if (action === "ENABLE") member.isActive = true;
    if (action === "REISSUE" && !member.isActive)
      throw new Error("Reative o colaborador antes de gerar um novo acesso.");
    const activationPath =
      action === "REISSUE" ? issueAccountActivation(db, profile.id) : null;
    db.auditEvents.unshift({
      id: crypto.randomUUID(),
      organizationId: ctx.organization.id,
      dealId: null,
      vehicleId: null,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: ctx.roles.join(","),
      action: `COLLABORATOR_${action}`,
      entityType: "PROFILE",
      entityId: profile.id,
      summary: `Acesso de ${profile.fullName}: ${action === "DISABLE" ? "desativado" : action === "ENABLE" ? "reativado" : "novo link gerado"}.`,
      metadata: {},
      isCustomerVisible: false,
      createdAt: new Date().toISOString(),
    });
    return { activationPath, email: profile.email, fullName: profile.fullName };
  });
}
