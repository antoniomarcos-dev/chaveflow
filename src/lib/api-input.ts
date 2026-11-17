import { NextRequest } from "next/server";

export class RequestPayloadError extends Error {
  readonly statusCode = 413;

  constructor(message = "A solicitação excede o limite permitido.") {
    super(message);
    this.name = "RequestPayloadError";
  }
}

export async function readJsonBody(
  request: NextRequest,
  maxBytes = 256 * 1024,
): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > maxBytes) {
    throw new RequestPayloadError();
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new RequestPayloadError();
    }
    body = JSON.parse(text);
  } catch (error) {
    if (error instanceof RequestPayloadError) throw error;
    throw new Error("JSON inválido.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Envie um objeto JSON válido.");
  return body as Record<string, unknown>;
}

export function strictBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function parseLiteral<T extends string>(
  value: unknown,
  allowed: readonly T[],
  message = "Valor inválido.",
): T {
  if (typeof value === "string" && allowed.includes(value as T)) {
    return value as T;
  }
  throw new Error(message);
}
