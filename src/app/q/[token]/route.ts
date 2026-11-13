import { getServerSessionContext } from "@/lib/server-session";
import { NextResponse } from "next/server";

// This entry point sits outside the internal layout so login keeps the QR target.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const destination = `/app/escanear?code=${encodeURIComponent(token)}`;
  const ctx = await getServerSessionContext();
  const path = !ctx
    ? `/login?redirect=${encodeURIComponent(destination)}`
    : ctx.profile.isCustomerOnly
      ? "/cliente"
      : destination;
  // A relative Location preserves the public host behind proxies and in local previews.
  return new NextResponse(null, {
    status: 307,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}
