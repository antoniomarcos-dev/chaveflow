import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadDatabaseState,
  savePrivateFileBlob,
  withTransaction,
} from "@/infrastructure/database";
import { createEmptyState } from "@/infrastructure/initial-state";
import { supabaseRpc } from "@/infrastructure/supabase";
import { enforceRateLimit } from "@/lib/request-security";

describe("Persistência Supabase por HTTPS", () => {
  beforeEach(() => {
    vi.stubEnv("CHAVEFLOW_TEST_IN_MEMORY", "false");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test_only");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("envia a chave moderna somente no cabeçalho apikey", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ state: createEmptyState(), revision: "1" }),
      );
    vi.stubGlobal("fetch", fetch);
    await loadDatabaseState();
    const [url, options] = fetch.mock.calls[0];
    expect(String(url)).toBe(
      "https://project.supabase.co/rest/v1/rpc/chaveflow_read_state",
    );
    expect(options.headers.apikey).toBe("sb_secret_test_only");
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.cache).toBe("no-store");
    expect(options.body).not.toContain("sb_secret");
  });

  it("grava arquivos e metadados em uma única confirmação", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ state: createEmptyState(), revision: "3" }),
      )
      .mockResolvedValueOnce(Response.json(true));
    vi.stubGlobal("fetch", fetch);
    await withTransaction(async (db) => {
      db.idempotencyKeys.push("saved");
      await savePrivateFileBlob({
        organizationId: "org",
        contentBuffer: Buffer.from("private file"),
        mimeType: "text/plain",
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    const [url, options] = fetch.mock.calls[1];
    const payload = JSON.parse(options.body);
    expect(String(url)).toContain("chaveflow_commit_state");
    expect(payload.p_expected_revision).toBe("3");
    expect(payload.p_state.idempotencyKeys).toEqual(["saved"]);
    expect(
      Buffer.from(payload.p_files[0].content_base64, "base64").toString(),
    ).toBe("private file");
  });

  it("não persiste alterações nem arquivos quando a operação falha", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ state: createEmptyState(), revision: "1" }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      withTransaction(async (db) => {
        db.idempotencyKeys.push("must rollback");
        await savePrivateFileBlob({
          organizationId: "org",
          contentBuffer: Buffer.from("not saved"),
          mimeType: "text/plain",
        });
        throw new Error("failure");
      }),
    ).rejects.toThrow("failure");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejeita uma gravação baseada em uma revisão antiga", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ state: createEmptyState(), revision: "1" }),
      )
      .mockResolvedValueOnce(Response.json(false));
    vi.stubGlobal("fetch", fetch);
    await expect(
      withTransaction((db) => {
        db.idempotencyKeys.push("conflict");
      }),
    ).rejects.toThrow(/outro usuário/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("mantém o limite de tentativas de autenticação", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(31)));
    await expect(enforceRateLimit("test-user", 30)).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it("não expõe a chave em mensagens de falha de rede", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("sb_secret_test_only")),
    );
    await expect(supabaseRpc("chaveflow_read_state")).rejects.toThrow(/HTTPS/);
    await expect(supabaseRpc("chaveflow_read_state")).rejects.not.toThrow(
      /sb_secret/,
    );
  });
});
