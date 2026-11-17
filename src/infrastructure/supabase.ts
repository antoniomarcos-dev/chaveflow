import { getDemoOrigin } from "@/lib/demo-config";
import type { DatabaseState } from "./database-state";

export class SupabaseInfrastructureError extends Error {
  readonly statusCode = 503;

  constructor(message: string) {
    super(message);
    this.name = "SupabaseInfrastructureError";
  }
}

export interface PendingPrivateFile {
  storage_key: string;
  content_base64: string;
}

export async function supabaseRpc<T>(
  name: string,
  parameters: Record<string, unknown> = {},
): Promise<T> {
  if (typeof window !== "undefined")
    throw new SupabaseInfrastructureError(
      "A conexão administrativa deve ser usada somente no servidor.",
    );
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new SupabaseInfrastructureError(
      "Configure SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente do servidor.",
    );
  const endpoint = new URL(url);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== "/" ||
    endpoint.search ||
    endpoint.hash
  )
    throw new SupabaseInfrastructureError(
      "SUPABASE_URL deve ser a URL HTTPS do projeto.",
    );
  // Bootstrap commands run outside an HTTP request and name their RPC explicitly.
  const useDemo = !name.endsWith("_initialize") && Boolean(getDemoOrigin());
  const rpcName = useDemo ? name.replace(/^chaveflow_/, "chaveflow_demo_") : name;
  endpoint.pathname = `/rest/v1/rpc/${rpcName}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: key,
  };
  // Legacy service_role keys are JWTs; modern sb_secret keys use apikey only.
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(parameters),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new SupabaseInfrastructureError(
      "Não foi possível conectar ao Supabase por HTTPS. Verifique a conexão e o estado do projeto.",
    );
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new SupabaseInfrastructureError(
        "Acesso ao Supabase recusado. Verifique a chave secreta do servidor e as permissões da migração.",
      );
    if (response.status === 404)
      throw new SupabaseInfrastructureError(
        "Estrutura do banco ausente. Aplique a migração do ChaveFlow no Supabase.",
      );
    throw new SupabaseInfrastructureError(
      `O Supabase não conseguiu concluir a operação (HTTP ${response.status}).`,
    );
  }
  return response.json() as Promise<T>;
}

export async function readSupabaseState(): Promise<{
  state: DatabaseState;
  revision: string;
}> {
  const snapshot = await supabaseRpc<{
    state: DatabaseState;
    revision: string;
  } | null>("chaveflow_read_state");
  if (!snapshot)
    throw new SupabaseInfrastructureError(
      "Banco não inicializado. Execute npm run db:setup.",
    );
  return snapshot;
}

export async function commitSupabaseState(
  snapshot: { state: DatabaseState; revision: string },
  files: PendingPrivateFile[],
  deletedFileKeys: string[] = [],
) {
  const saved = await supabaseRpc<boolean>("chaveflow_commit_state_v2", {
    p_expected_revision: snapshot.revision,
    p_state: snapshot.state,
    p_files: files,
    p_deleted_storage_keys: deletedFileKeys,
  });
  if (!saved)
    throw new SupabaseInfrastructureError(
      "Os dados foram alterados por outro usuário. Atualize a página e tente novamente.",
    );
}
