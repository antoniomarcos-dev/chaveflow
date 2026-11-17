import { loadDatabaseState } from "@/infrastructure/database";
import { CUSTOMER_ACCESS_COOKIE } from "@/lib/customer-access";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const db = await loadDatabaseState();
  const grant = db.customerAccessGrants.find(
    (candidate) =>
      candidate.accessToken === token &&
      !candidate.revokedAt &&
      Date.parse(candidate.expiresAt) > Date.now(),
  );
  if (!grant) {
    const response = NextResponse.redirect(new URL("/cliente", request.url), 307);
    response.cookies.delete(CUSTOMER_ACCESS_COOKIE);
    return response;
  }

  const target = new URL(`/cliente/negociacoes/${grant.dealId}`, request.url);
  const response = NextResponse.redirect(target, 307);
  response.cookies.set(CUSTOMER_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 24 * 60 * 60,
  });
  return response;
}
