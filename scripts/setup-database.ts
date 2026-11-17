import { loadEnvConfig } from "@next/env";
import { buildBootstrapState } from "../src/infrastructure/bootstrap";
import { supabaseRpc } from "../src/infrastructure/supabase";
import { getDemoOrigin } from "../src/lib/demo-config";

async function main() {
  loadEnvConfig(process.cwd());
  if (getDemoOrigin())
    throw new Error("Para esta publicação, use npm run db:demo:setup.");
  const state = buildBootstrapState();
  const inserted = await supabaseRpc<boolean>("chaveflow_initialize", {
    p_state: state,
  });
  console.log(
    inserted
      ? "Banco inicializado com a organização e o administrador. Estoque e negociações estão vazios."
      : "Banco já inicializado. Nenhum dado foi alterado.",
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Falha na inicialização.",
  );
  process.exitCode = 1;
});
