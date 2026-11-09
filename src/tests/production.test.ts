import {
  authenticateWithCredentials,
  createSessionToken,
  verifySessionToken,
} from "@/application/auth-service";
import { resetPassword } from "@/application/password-reset-service";
import {
  loadDatabaseState,
  saveDatabaseState,
  validateServerUploadFile,
  withTransaction,
} from "@/infrastructure/database";
import {
  createEmptyState,
  createOrganizationWorkflow,
} from "@/infrastructure/initial-state";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.CHAVEFLOW_TEST_IN_MEMORY = "true";

describe("Inicialização e segurança de produção", () => {
  beforeEach(() => saveDatabaseState(createEmptyState()));

  it("inicia vazio e prepara apenas o fluxo da organização real", () => {
    const state = createEmptyState();
    expect(Object.values(state).every((value) => value.length === 0)).toBe(
      true,
    );
    const workflow = createOrganizationWorkflow(
      "organization-real",
      "admin-real",
    );
    expect(workflow.taskTemplates.length).toBeGreaterThan(0);
    expect(
      workflow.taskTemplates.every(
        (t) =>
          t.organizationId === "organization-real" &&
          t.defaultAssigneeId === null,
      ),
    ).toBe(true);
    expect(workflow.workflowVersions[0].publishedBy).toBe("admin-real");
  });

  it("não aceita login sem senha nem senha incorreta", async () => {
    const now = new Date().toISOString();
    await withTransaction((db) => {
      db.profiles.push({
        id: "user-real",
        email: "user@example.com",
        fullName: "Usuário",
        phone: "",
        passwordHash: hashPassword("a-long-valid-password"),
        isCustomerOnly: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    });
    await expect(
      authenticateWithCredentials({ email: "user@example.com" }),
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(
      authenticateWithCredentials({
        email: "user@example.com",
        password: "wrong",
      }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(
      verifyPassword(
        "a-long-valid-password",
        (await loadDatabaseState()).profiles[0].passwordHash,
      ),
    ).toBe(true);
  });

  it("detecta alteração de sessão", () => {
    const token = createSessionToken("user-real", "org-real");
    expect(verifySessionToken(token).valid).toBe(true);
    expect(verifySessionToken(token.slice(0, -10) + "tampered").valid).toBe(
      false,
    );
  });

  it("exige um segredo forte fora do ambiente de testes", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CHAVEFLOW_SESSION_SECRET", "");
    try {
      expect(() => createSessionToken("user", "org")).toThrow(
        /CHAVEFLOW_SESSION_SECRET/,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("redefinição exige token válido, expira e só pode ser usada uma vez", async () => {
    const now = new Date().toISOString(),
      token = "a-real-random-token",
      hash = crypto.createHash("sha256").update(token).digest("hex");
    await withTransaction((db) => {
      db.profiles.push({
        id: "user-real",
        email: "user@example.com",
        fullName: "Usuário",
        phone: "",
        passwordHash: hashPassword("original-password"),
        isCustomerOnly: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      db.passwordResetTokens = [
        { hash, profileId: "user-real", expiresAt: Date.now() + 60000 },
      ];
    });
    await expect(
      resetPassword("invalid", "new-secure-password"),
    ).rejects.toThrow(/inválido/);
    await resetPassword(token, "new-secure-password");
    expect(
      verifyPassword(
        "new-secure-password",
        (await loadDatabaseState()).profiles[0].passwordHash,
      ),
    ).toBe(true);
    expect(
      (await loadDatabaseState()).profiles[0].passwordChangedAt,
    ).toBeTruthy();
    await expect(resetPassword(token, "another-new-password")).rejects.toThrow(
      /inválido/,
    );
    await withTransaction((db) => {
      db.passwordResetTokens = [
        { hash, profileId: "user-real", expiresAt: Date.now() - 1 },
      ];
    });
    await expect(resetPassword(token, "another-new-password")).rejects.toThrow(
      /inválido/,
    );
  });

  it("preserva o estado anterior quando uma transação falha", async () => {
    await expect(
      withTransaction((db) => {
        db.idempotencyKeys.push("must-not-persist");
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect((await loadDatabaseState()).idempotencyKeys).toEqual([]);
  });

  it("limita uploads ao tamanho compatível com a Vercel", () => {
    expect(() =>
      validateServerUploadFile({
        originalFilename: "document.pdf",
        mimeType: "application/pdf",
        sizeBytes: 4 * 1024 * 1024,
      }),
    ).not.toThrow();
    expect(() =>
      validateServerUploadFile({
        originalFilename: "document.pdf",
        mimeType: "application/pdf",
        sizeBytes: 4 * 1024 * 1024 + 1,
      }),
    ).toThrow(/4 MB/);
    expect(() =>
      validateServerUploadFile({
        originalFilename: "document.exe.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      }),
    ).toThrow(/bloqueado/);
  });
});
