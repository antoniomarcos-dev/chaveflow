import { AuthorizationError } from "@/domain/permissions";
import { supabaseRpc } from "@/infrastructure/supabase";
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
  const attempts = await supabaseRpc<number>("chaveflow_rate_limit", {
    p_key_hash: hash,
  });
  if (attempts > limit)
    throw new AuthorizationError(
      "Muitas tentativas. Aguarde 15 minutos e tente novamente.",
      "RATE_LIMITED",
      429,
    );
}
