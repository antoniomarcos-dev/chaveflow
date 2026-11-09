import { AuthorizationError } from "@/domain/permissions";
import { getSql } from "@/infrastructure/postgres";
import { NextRequest } from "next/server";
import crypto from "node:crypto";

export function assertSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set([new URL(request.url).origin]);
  if (process.env.CHAVEFLOW_APP_URL)
    allowedOrigins.add(new URL(process.env.CHAVEFLOW_APP_URL).origin);
  if (origin && !allowedOrigins.has(origin))
    throw new AuthorizationError(
      "Origem da solicitação não permitida.",
      "INVALID_ORIGIN",
      403,
    );
}

export async function enforceRateLimit(key: string, limit: number) {
  const window = Math.floor(Date.now() / 900000);
  const hash = crypto
    .createHash("sha256")
    .update(`${window}:${key}`)
    .digest("hex");
  const sql = getSql();
  await sql`DELETE FROM chaveflow_rate_limits WHERE expires_at < now()`;
  const rows =
    await sql`INSERT INTO chaveflow_rate_limits(key_hash, attempts, expires_at)
    VALUES (${hash}, 1, now() + interval '15 minutes')
    ON CONFLICT (key_hash) DO UPDATE SET attempts = chaveflow_rate_limits.attempts + 1
    RETURNING attempts`;
  if (rows[0].attempts > limit)
    throw new AuthorizationError(
      "Muitas tentativas. Aguarde 15 minutos e tente novamente.",
      "RATE_LIMITED",
      429,
    );
}
