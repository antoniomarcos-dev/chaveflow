import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;
export function getSql() {
  if (!process.env.DATABASE_URL)
    throw new Error("Configure DATABASE_URL para conectar o PostgreSQL.");
  return (client ??= postgres(process.env.DATABASE_URL, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  }));
}
