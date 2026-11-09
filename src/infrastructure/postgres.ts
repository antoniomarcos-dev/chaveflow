import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;
function createClient(connectionString: string | undefined) {
  if (!connectionString)
    throw new Error("Configure DATABASE_URL para conectar o PostgreSQL.");
  return postgres(connectionString, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });
}

export function getSql() {
  return (client ??= createClient(process.env.DATABASE_URL));
}

// Migrations use a separate direct connection; runtime keeps using the pooler.
export function getSetupSql() {
  return createClient(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
}
