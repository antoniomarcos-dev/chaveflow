import { headers } from "next/headers";

export function getDemoUrl() {
  return process.env.CHAVEFLOW_DEMO_URL || null;
}

export async function getDemoOrigin() {
  const demoUrl = getDemoUrl();
  if (!demoUrl) return null;
  const { host, origin } = new URL(demoUrl);
  return (await headers()).get("host") === host ? origin : null;
}
