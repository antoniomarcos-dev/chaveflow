export function getDemoOrigin() {
  const url = process.env.CHAVEFLOW_DEMO_URL;
  return url ? new URL(url).origin : null;
}
