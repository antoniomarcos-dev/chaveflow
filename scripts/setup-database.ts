import { loadEnvConfig } from "@next/env";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  createEmptyState,
  createOrganizationWorkflow,
} from "../src/infrastructure/initial-state";
import { getSetupSql } from "../src/infrastructure/postgres";
import { hashPassword } from "../src/lib/passwords";

async function main() {
  loadEnvConfig(process.cwd());
  const required = [
    "DATABASE_URL",
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
  const sql = getSetupSql();
  try {
    await sql.unsafe(
      await readFile(
        new URL("../database/migrations/0001_runtime.sql", import.meta.url),
        "utf8",
      ),
    );
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
    const inserted =
      await sql`INSERT INTO chaveflow_state(id, data) VALUES (1, ${sql.json(JSON.parse(JSON.stringify(state)))}) ON CONFLICT (id) DO NOTHING RETURNING id`;
    console.log(
      inserted.length
        ? "Banco inicializado com a organização e o administrador. Estoque e negociações estão vazios."
        : "Banco já inicializado. Nenhum dado foi alterado.",
    );
  } finally {
    await sql.end();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Falha na inicialização.",
  );
  process.exitCode = 1;
});
