import { loadEnvConfig } from "@next/env";
import { createHash, randomBytes } from "node:crypto";
import { supabaseRpc } from "../src/infrastructure/supabase";
import { demoCredentials } from "../src/lib/demo-credentials";
import { hashPassword } from "../src/lib/passwords";
import { createInitialSeedState } from "../src/tests/fixtures/seed-data";

async function main() {
  const state = createInitialSeedState();
  for (const profile of state.profiles) {
    const account = demoCredentials.find((demo) => demo.email === profile.email);
    profile.passwordHash = account ? hashPassword(account.password) : "";
  }
  for (const grant of state.customerAccessGrants) {
    grant.accessToken = randomBytes(24).toString("hex");
  }
  const files = state.documentVersions.map((version) => {
    const file = Buffer.from(
      `Documento fictício para demonstração do AUTOFLOW.\n\n${version.originalFilename}\n${version.extractedTextPreview ?? ""}\n`,
      "utf8",
    );
    version.sizeBytes = file.length;
    version.checksumSha256 = createHash("sha256").update(file).digest("hex");
    return {
      storage_key: version.storageKey,
      content_base64: file.toString("base64"),
    };
  });

  if (process.argv.includes("--sql")) {
    const sqlJson = (value: unknown) =>
      `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
    console.log(
      `select public.chaveflow_demo_initialize(${sqlJson(state)}, ${sqlJson(files)}) as initialized;`,
    );
    return;
  }

  loadEnvConfig(process.cwd());
  const initialized = await supabaseRpc<boolean>("chaveflow_demo_initialize", {
    p_state: state,
    p_files: files,
  });
  console.log(initialized ? "Demonstração inicializada." : "Demonstração já inicializada.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha na inicialização da demonstração.");
  process.exitCode = 1;
});
