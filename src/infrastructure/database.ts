import { getSigningSecret } from "@/lib/secrets";
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import type { TransactionSql } from "postgres";
import type { DatabaseState } from "./database-state";
import { createEmptyState } from "./initial-state";
import { getSql } from "./postgres";

let memoryState: DatabaseState | null = null;
let transactionLock: Promise<void> = Promise.resolve();
const transactionContext = new AsyncLocalStorage<{
  sql: TransactionSql;
  state: DatabaseState;
}>();
function isTestMemoryMode() {
  return (
    process.env.NODE_ENV === "test" &&
    process.env.CHAVEFLOW_TEST_IN_MEMORY === "true"
  );
}

export async function loadDatabaseState(): Promise<DatabaseState> {
  const context = transactionContext.getStore();
  if (context) return context.state;
  if (isTestMemoryMode()) return (memoryState ??= createEmptyState());
  const rows = await getSql()`SELECT data FROM chaveflow_state WHERE id = 1`;
  if (!rows.length)
    throw new Error("Banco não inicializado. Execute npm run db:setup.");
  return rows[0].data as DatabaseState;
}

export function saveDatabaseState(state: DatabaseState): void {
  if (!isTestMemoryMode()) throw new Error("Gravações exigem uma transação.");
  memoryState = structuredClone(state);
}

export async function withTransaction<T>(
  operation: (db: DatabaseState) => Promise<T> | T,
): Promise<T> {
  if (transactionContext.getStore())
    throw new Error("Transações aninhadas não são suportadas.");
  if (!isTestMemoryMode()) {
    return (await getSql().begin(async (sql) => {
      const rows =
        await sql`SELECT data FROM chaveflow_state WHERE id = 1 FOR UPDATE`;
      if (!rows.length)
        throw new Error("Banco não inicializado. Execute npm run db:setup.");
      const state = rows[0].data as DatabaseState;
      return transactionContext.run({ sql, state }, async () => {
        const result = await operation(state);
        await sql`UPDATE chaveflow_state SET data = ${sql.json(JSON.parse(JSON.stringify(state)))} WHERE id = 1`;
        return result;
      });
    })) as T;
  }
  const previous = transactionLock;
  let release!: () => void;
  transactionLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const snapshot = structuredClone(await loadDatabaseState());
    const result = await operation(snapshot);
    saveDatabaseState(snapshot);
    return result;
  } finally {
    release();
  }
}

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
]);

const FORBIDDEN_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".msi",
  ".dll",
  ".ps1",
  ".vbs",
  ".js",
  ".jar",
  ".scr",
  ".com",
]);

const MAX_UPLOAD_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB

export function validateServerUploadFile(params: {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}): void {
  const { originalFilename, mimeType, sizeBytes } = params;
  const trimmedName = (originalFilename || "").trim();
  if (!trimmedName) {
    throw new Error("Nome do arquivo inválido.");
  }

  const lower = trimmedName.toLowerCase();
  for (const ext of FORBIDDEN_EXTENSIONS) {
    if (lower.endsWith(ext) || lower.includes(`${ext}.`)) {
      throw new Error(
        `Arquivo bloqueado por segurança no servidor: extensão executável ou proibida (${ext}).`,
      );
    }
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Tipo de arquivo '${mimeType}' não permitido. Envie PDF, PNG, JPEG, WEBP ou TXT.`,
    );
  }

  if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(
      `Tamanho do arquivo inválido (${sizeBytes} bytes). Limite máximo: 4 MB.`,
    );
  }
}

const memoryBlobStore = new Map<string, Buffer>();
export async function savePrivateFileBlob(params: {
  organizationId: string;
  contentBuffer: Buffer;
  mimeType: string;
}): Promise<{ storageKey: string; checksumSha256: string }> {
  const storageKey =
    params.organizationId.replace(/[^a-zA-Z0-9_-]/g, "") +
    "/" +
    crypto.randomUUID();
  const checksumSha256 = crypto
    .createHash("sha256")
    .update(params.contentBuffer)
    .digest("hex");
  if (isTestMemoryMode()) memoryBlobStore.set(storageKey, params.contentBuffer);
  else {
    const sql = transactionContext.getStore()?.sql ?? getSql();
    await sql`INSERT INTO chaveflow_files (storage_key, content) VALUES (${storageKey}, ${params.contentBuffer})`;
  }
  return { storageKey, checksumSha256 };
}
export async function readPrivateFileBlob(storageKey: string): Promise<Buffer> {
  if (isTestMemoryMode()) {
    if (memoryBlobStore.has(storageKey))
      return memoryBlobStore.get(storageKey)!;
  }
  const rows =
    await getSql()`SELECT content FROM chaveflow_files WHERE storage_key = ${storageKey}`;
  if (!rows.length)
    throw new Error("Arquivo não encontrado no armazenamento privado.");
  return Buffer.from(rows[0].content);
}
export function createTemporaryDocumentToken(params: {
  documentId: string;
  versionNumber: number;
  organizationId: string;
  viewerProfileId: string;
  ttlSeconds?: number;
}): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + (params.ttlSeconds ?? 300) * 1000; // 5 minutos padrão
  const payload = `${params.documentId}:${params.versionNumber}:${params.organizationId}:${params.viewerProfileId}:${expiresAt}`;
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");
  const rawToken = Buffer.from(`${payload}:${sig}`, "utf-8").toString(
    "base64url",
  );
  return { token: rawToken, expiresAt };
}

export function verifyTemporaryDocumentToken(token: string): {
  valid: boolean;
  documentId?: string;
  versionNumber?: number;
  organizationId?: string;
  viewerProfileId?: string;
} {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 6) return { valid: false };
    const [
      documentId,
      versionStr,
      organizationId,
      viewerProfileId,
      expiresAtStr,
      sig,
    ] = parts;
    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      return { valid: false };
    }
    const payload = `${documentId}:${versionStr}:${organizationId}:${viewerProfileId}:${expiresAtStr}`;
    const expectedSig = crypto
      .createHmac("sha256", getSigningSecret())
      .update(payload)
      .digest("hex");
    if (
      !/^[a-f0-9]{64}$/.test(sig) ||
      !crypto.timingSafeEqual(
        Buffer.from(sig, "hex"),
        Buffer.from(expectedSig, "hex"),
      )
    ) {
      return { valid: false };
    }
    return {
      valid: true,
      documentId,
      versionNumber: Number(versionStr),
      organizationId,
      viewerProfileId,
    };
  } catch {
    return { valid: false };
  }
}
