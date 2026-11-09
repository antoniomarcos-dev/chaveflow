import { loadEnvConfig } from "@next/env";
import { buildBootstrapState } from "../src/infrastructure/bootstrap";
import { supabaseRpc } from "../src/infrastructure/supabase";

async function main() {
  loadEnvConfig(process.cwd());
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
