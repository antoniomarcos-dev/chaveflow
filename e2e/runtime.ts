// Explicit test-process preload. This module is never imported by the application.
import { createInitialSeedState } from "../src/tests/fixtures/seed-data";
import { hashPassword } from "../src/lib/passwords";

if (
  process.env.CHAVEFLOW_BROWSER_TEST_RUNTIME !== "true" ||
  process.env.SUPABASE_URL !== "https://chaveflow-e2e.invalid"
) {
  throw new Error(
    "O runtime de testes exige um endereço isolado e não pode acessar um banco real.",
  );
}
let state = createInitialSeedState();
for (const profile of state.profiles)
  profile.passwordHash = hashPassword("E2e-chaveflow-password!");
for (const vehicle of state.vehicles) vehicle.photos = [];
let revision = 1;
const files = new Map<string, string>();
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL
      ? input.toString()
      : input.url,
  );
  if (url.origin !== "https://chaveflow-e2e.invalid") {
    if (url.pathname.startsWith("/rest/v1/rpc/"))
      throw new Error("Testes não podem acessar outro banco.");
    return originalFetch(input, options);
  }
  const body = JSON.parse(String(options?.body || "{}"));
  switch (url.pathname.split("/").pop()) {
    case "chaveflow_read_state":
      return Response.json({ state, revision: String(revision) });
    case "chaveflow_commit_state": {
      if (body.p_expected_revision !== String(revision))
        return Response.json(false);
      state = structuredClone(body.p_state);
      revision++;
      for (const file of body.p_files || [])
        files.set(file.storage_key, file.content_base64);
      return Response.json(true);
    }
    case "chaveflow_read_file":
      return Response.json(files.get(body.p_storage_key) ?? null);
    case "chaveflow_rate_limit":
      return Response.json(1);
    default:
      return Response.json(
        { error: "RPC não prevista no teste" },
        { status: 400 },
      );
  }
};
