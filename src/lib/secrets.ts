export function getSigningSecret(): string {
  const secret = process.env.CHAVEFLOW_SESSION_SECRET;
  if (secret && secret.length >= 32 && !secret.startsWith("substitua"))
    return secret;
  if (process.env.NODE_ENV === "test")
    return "test-only-session-secret-with-at-least-32-characters";
  throw new Error(
    "Configure CHAVEFLOW_SESSION_SECRET com pelo menos 32 caracteres aleatórios.",
  );
}
