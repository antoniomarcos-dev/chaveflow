import crypto from "node:crypto";
import { createEmptyState, createOrganizationWorkflow } from "./initial-state";
import { hashPassword } from "@/lib/passwords";

export function buildBootstrapState() {
  const required = [
    "CHAVEFLOW_ORGANIZATION_NAME",
    "CHAVEFLOW_ORGANIZATION_CNPJ",
    "CHAVEFLOW_BRANCH_NAME",
    "CHAVEFLOW_ADMIN_NAME",
    "CHAVEFLOW_ADMIN_EMAIL",
    "CHAVEFLOW_ADMIN_PASSWORD",
  ];
  for (const key of required)
    if (!process.env[key]?.trim())
      throw new Error(`Configure ${key} no ambiente antes de inicializar.`);
  const passwordHash = hashPassword(process.env.CHAVEFLOW_ADMIN_PASSWORD!);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.CHAVEFLOW_ADMIN_EMAIL!))
    throw new Error("E-mail do administrador inválido.");
  const state = createEmptyState();
  const now = new Date().toISOString(),
    organizationId = crypto.randomUUID(),
    branchId = crypto.randomUUID(),
    profileId = crypto.randomUUID();
  state.organizations.push({
    id: organizationId,
    name: process.env.CHAVEFLOW_ORGANIZATION_NAME!,
    cnpj: process.env.CHAVEFLOW_ORGANIZATION_CNPJ!,
    slug: `org-${organizationId}`,
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  });
  state.branches.push({
    id: branchId,
    organizationId,
    name: process.env.CHAVEFLOW_BRANCH_NAME!,
    code: "MATRIZ",
    city: process.env.CHAVEFLOW_BRANCH_CITY || "",
    state: process.env.CHAVEFLOW_BRANCH_STATE || "",
    address: process.env.CHAVEFLOW_BRANCH_ADDRESS || "",
    phone: process.env.CHAVEFLOW_BRANCH_PHONE || "",
    isActive: true,
    createdAt: now,
  });
  state.profiles.push({
    id: profileId,
    email: process.env.CHAVEFLOW_ADMIN_EMAIL!.trim().toLowerCase(),
    fullName: process.env.CHAVEFLOW_ADMIN_NAME!,
    phone: "",
    passwordHash,
    isCustomerOnly: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  state.memberships.push({
    id: crypto.randomUUID(),
    organizationId,
    branchId,
    profileId,
    roles: ["ADMIN"],
    isActive: true,
    invitedBy: null,
    createdAt: now,
  });
  Object.assign(state, createOrganizationWorkflow(organizationId, profileId));

  return state;
}
