import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createInitialSeedState, DatabaseState } from "./seed-data";

let memoryState: DatabaseState | null = null;
let transactionLock: Promise<void> = Promise.resolve();

function getDataDir(): string {
  const customDir = process.env.CHAVEFLOW_LOCAL_DATA_DIR || ".data";
  return path.resolve(process.cwd(), customDir);
}

function getDbFilePath(): string {
  return path.join(getDataDir(), "chaveflow-db.json");
}

function getStorageDir(): string {
  return path.join(getDataDir(), "private-storage");
}

function isTestMemoryMode(): boolean {
  return process.env.CHAVEFLOW_TEST_IN_MEMORY === "true";
}

function ensureDirectories(): void {
  if (isTestMemoryMode()) return;
  const dataDir = getDataDir();
  const storageDir = getStorageDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
}

export function loadDatabaseState(): DatabaseState {
  if (isTestMemoryMode()) {
    if (!memoryState) {
      memoryState = createInitialSeedState();
    }
    return memoryState;
  }

  ensureDirectories();
  const dbPath = getDbFilePath();
  if (!fs.existsSync(dbPath)) {
    const initial = createInitialSeedState();
    fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2), "utf-8");
    memoryState = initial;
    return initial;
  }

  try {
    const raw = fs.readFileSync(dbPath, "utf-8");
    const parsed = JSON.parse(raw) as DatabaseState;
    memoryState = parsed;
    return parsed;
  } catch {
    const fallback = createInitialSeedState();
    fs.writeFileSync(dbPath, JSON.stringify(fallback, null, 2), "utf-8");
    memoryState = fallback;
    return fallback;
  }
}

export function saveDatabaseState(state: DatabaseState): void {
  memoryState = state;
  if (isTestMemoryMode()) {
    return;
  }
  ensureDirectories();
  const dbPath = getDbFilePath();
  const tempPath = `${dbPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf-8");
  fs.renameSync(tempPath, dbPath);
}

export function resetDemoDatabase(): DatabaseState {
  const fresh = createInitialSeedState();
  saveDatabaseState(fresh);
  return fresh;
}

/**
 * Executa uma operação transacional serializada com isolamento e rollback automático em caso de erro.
 */
export async function withTransaction<T>(
  operation: (db: DatabaseState) => Promise<T> | T
): Promise<T> {
  const previousLock = transactionLock;
  let releaseLock!: () => void;
  transactionLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;

  try {
    const current = loadDatabaseState();
    // Snapshot profundo para rollback atômico se a transação falhar
    const snapshot = JSON.parse(JSON.stringify(current)) as DatabaseState;
    try {
      const result = await operation(snapshot);
      saveDatabaseState(snapshot);
      return result;
    } catch (err) {
      throw err;
    }
  } finally {
    releaseLock();
  }
}

// ============================================================================
// ARMAZENAMENTO PRIVADO DE DOCUMENTOS COM LINKS TEMPORÁRIOS ASSINADOS
// ============================================================================

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

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

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
        `Arquivo bloqueado por segurança no servidor: extensão executável ou proibida (${ext}).`
      );
    }
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Tipo de arquivo '${mimeType}' não permitido. Envie PDF, PNG, JPEG, WEBP ou TXT.`
    );
  }

  if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(
      `Tamanho do arquivo inválido (${sizeBytes} bytes). Limite máximo: 10 MB.`
    );
  }
}

const memoryBlobStore = new Map<string, Buffer>();

export function savePrivateFileBlob(params: {
  organizationId: string;
  contentBuffer: Buffer;
  mimeType: string;
}): { storageKey: string; checksumSha256: string } {
  // Nunca usa o nome enviado pelo usuário como caminho de armazenamento
  const randomUuid = crypto.randomUUID();
  const safeOrgPrefix = params.organizationId.replace(/[^a-zA-Z0-9_-]/g, "");
  const storageKey = `${safeOrgPrefix}/${randomUuid}.bin`;
  const checksumSha256 = crypto
    .createHash("sha256")
    .update(params.contentBuffer)
    .digest("hex");

  if (isTestMemoryMode()) {
    memoryBlobStore.set(storageKey, params.contentBuffer);
    return { storageKey, checksumSha256 };
  }

  ensureDirectories();
  const fullPath = path.join(getStorageDir(), safeOrgPrefix);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  const fileDest = path.join(fullPath, `${randomUuid}.bin`);
  fs.writeFileSync(fileDest, params.contentBuffer);

  return { storageKey, checksumSha256 };
}

export function readPrivateFileBlob(
  storageKey: string,
  fallbackText?: string
): Buffer {
  if (memoryBlobStore.has(storageKey)) {
    return memoryBlobStore.get(storageKey)!;
  }

  if (storageKey.startsWith("demo-seed/")) {
    return Buffer.from(
      fallbackText ??
        `[CHAVEFLOW — ARQUIVO DEMONSTRATIVO FICTÍCIO]\nChave privada: ${storageKey}\nEste documento faz parte dos dados demonstrativos da Pinauto BYD Ceres/GO.`,
      "utf-8"
    );
  }

  if (!isTestMemoryMode()) {
    const fileDest = path.join(getStorageDir(), storageKey);
    if (fs.existsSync(fileDest)) {
      return fs.readFileSync(fileDest);
    }
  }

  return Buffer.from(
    fallbackText ?? `[Documento Privado ChaveFlow: ${storageKey}]`,
    "utf-8"
  );
}

function getSigningSecret(): string {
  return (
    process.env.CHAVEFLOW_SESSION_SECRET ||
    "chaveflow-local-demo-hmac-secret-key-2026"
  );
}

export function createTemporaryDocumentToken(params: {
  documentId: string;
  versionNumber: number;
  organizationId: string;
  viewerProfileId: string;
  ttlSeconds?: number;
}): { token: string; expiresAt: number } {
  const expiresAt =
    Date.now() + (params.ttlSeconds ?? 300) * 1000; // 5 minutos padrão
  const payload = `${params.documentId}:${params.versionNumber}:${params.organizationId}:${params.viewerProfileId}:${expiresAt}`;
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");
  const rawToken = Buffer.from(`${payload}:${sig}`, "utf-8").toString(
    "base64url"
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
    if (sig !== expectedSig) {
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
