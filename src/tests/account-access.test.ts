import {
  createCustomerAccountAccess,
  manageCollaboratorAccess,
} from "@/application/account-access-service";
import {
  authenticateWithCredentials,
  buildAuthenticatedContext,
  inviteCollaborator,
} from "@/application/auth-service";
import {
  getCustomerSafeDealView,
  listDealsForAuthenticatedCustomer,
} from "@/application/customer-portal-service";
import {
  createOrSaveGuidedDeal,
  getDealPassportView,
  listDealsForOrg,
} from "@/application/deal-service";
import { resetPassword } from "@/application/password-reset-service";
import {
  loadDatabaseState,
  saveDatabaseState,
  withTransaction,
} from "@/infrastructure/database";
import { beforeEach, describe, expect, it } from "vitest";
import { createInitialSeedState, DEMO_BRANCH_ID } from "./fixtures/seed-data";

process.env.CHAVEFLOW_TEST_IN_MEMORY = "true";
const password = "Access-test-password-2026";
function token(path: string) {
  return new URL(path, "http://localhost").searchParams.get("token")!;
}
async function newSeller() {
  const ctx = (await buildAuthenticatedContext("user-admin"))!;
  return inviteCollaborator({
    ctx,
    email: "new-seller@example.com",
    fullName: "Novo vendedor",
    phone: "",
    branchId: DEMO_BRANCH_ID,
    roles: ["SELLER"],
  });
}

describe("Administração, vendedor e acesso individual do cliente", () => {
  beforeEach(() => saveDatabaseState(createInitialSeedState()));
  it("vendedor não pode atribuir uma nova negociação a outro colaborador", async () => {
    const ctx = (await buildAuthenticatedContext("user-vendedor"))!;
    await expect(
      createOrSaveGuidedDeal({
        ctx,
        input: {
          vehicleId: "veh-005",
          branchId: DEMO_BRANCH_ID,
          sellerId: "user-admin",
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
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("administrador cria vendedor sem SMTP e o vendedor define a própria senha", async () => {
    const created = await newSeller();
    const profile = (await loadDatabaseState()).profiles.find(
      (p) => p.id === created.profileId,
    )!;
    expect(profile.passwordHash).toMatch(/^scrypt:/);
    expect(profile.passwordHash).not.toContain(password);
    await resetPassword(token(created.activationPath), password);
    const result = await authenticateWithCredentials({
      email: created.email,
      password,
    });
    expect(result.context.roles).toEqual(["SELLER"]);
    await expect(
      resetPassword(token(created.activationPath), password),
    ).rejects.toThrow(/inválido/);
  });
  it("vendedor não cria equipe nem atribui funções privilegiadas", async () => {
    const ctx = (await buildAuthenticatedContext("user-vendedor"))!;
    await expect(
      inviteCollaborator({
        ctx,
        email: "admin-new@example.com",
        fullName: "Sem permissão",
        phone: "",
        branchId: DEMO_BRANCH_ID,
        roles: ["ADMIN"],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("vendedor cria acesso de comprador da própria negociação, sem conceder acesso interno", async () => {
    const ctx = (await buildAuthenticatedContext("user-vendedor"))!;
    await withTransaction((db) => {
      db.customers.find((c) => c.id === "cust-helena")!.profileId = null;
      db.profiles = db.profiles.filter((p) => p.id !== "user-cliente-helena");
      db.memberships = db.memberships.filter(
        (m) => m.profileId !== "user-cliente-helena",
      );
    });
    const created = await createCustomerAccountAccess({
      ctx,
      dealId: "deal-001",
    });
    await resetPassword(token(created.activationPath), password);
    const { context } = await authenticateWithCredentials({
      email: created.email,
      password,
    });
    expect(context.roles).toEqual(["CUSTOMER"]);
    expect(context.profile.isCustomerOnly).toBe(true);
    expect(
      (await listDealsForAuthenticatedCustomer(context)).map((d) => d.dealId),
    ).toEqual(["deal-001"]);
    await expect(
      getDealPassportView({ ctx: context, dealId: "deal-001" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      getCustomerSafeDealView({ ctx: context, dealId: "deal-002" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("outro vendedor não cria acesso nem visualiza a negociação alheia", async () => {
    const seller = await newSeller();
    const ctx = (await buildAuthenticatedContext(seller.profileId))!;
    await expect(
      createCustomerAccountAccess({ ctx, dealId: "deal-001" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      getDealPassportView({ ctx, dealId: "deal-001" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(await listDealsForOrg({ ctx })).toEqual([]);
  });
  it("não vincula a conta interna de administrador a um comprador", async () => {
    const ctx = (await buildAuthenticatedContext("user-vendedor"))!;
    await withTransaction((db) => {
      const customer = db.customers.find((c) => c.id === "cust-helena")!;
      customer.profileId = null;
      customer.email = "admin@pinauto.demo";
    });
    await expect(
      createCustomerAccountAccess({ ctx, dealId: "deal-001" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(
      (await loadDatabaseState()).profiles.find((p) => p.id === "user-admin")!
        .isCustomerOnly,
    ).toBe(false);
  });
  it("reemitir um link invalida o anterior e desativar bloqueia a sessão", async () => {
    const seller = await newSeller(),
      ctx = (await buildAuthenticatedContext("user-admin"))!;
    const reissued = await manageCollaboratorAccess({
      ctx,
      profileId: seller.profileId,
      action: "REISSUE",
    });
    await expect(
      resetPassword(token(seller.activationPath), password),
    ).rejects.toThrow(/inválido/);
    await resetPassword(token(reissued.activationPath!), password);
    await manageCollaboratorAccess({
      ctx,
      profileId: seller.profileId,
      action: "DISABLE",
    });
    expect(await buildAuthenticatedContext(seller.profileId)).toBeNull();
    await manageCollaboratorAccess({
      ctx,
      profileId: seller.profileId,
      action: "ENABLE",
    });
    expect((await buildAuthenticatedContext(seller.profileId))!.roles).toEqual([
      "SELLER",
    ]);
  });
  it("cliente não cria acessos e administrador não desativa a própria conta", async () => {
    const ctx = (await buildAuthenticatedContext("user-cliente-helena"))!;
    await expect(
      createCustomerAccountAccess({ ctx, dealId: "deal-001" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    const admin = (await buildAuthenticatedContext("user-admin"))!;
    await expect(
      manageCollaboratorAccess({
        ctx: admin,
        profileId: admin.profile.id,
        action: "DISABLE",
      }),
    ).rejects.toThrow(/própria conta/);
  });
});
