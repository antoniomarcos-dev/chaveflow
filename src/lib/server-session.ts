import {
  buildAuthenticatedContext,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/application/auth-service";
import { AuthenticatedContext } from "@/domain/types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireInternalSession(): Promise<AuthenticatedContext> {
  const ctx = await getServerSessionContext();
  if (!ctx) redirect("/login");
  if (ctx.profile.isCustomerOnly) redirect("/cliente");
  return ctx;
}

export async function getServerSessionContext(): Promise<AuthenticatedContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) {
    return null;
  }

  const verified = verifySessionToken(rawToken);
  if (!verified.valid || !verified.profileId) {
    return null;
  }

  const context = await buildAuthenticatedContext(
    verified.profileId,
    verified.organizationId,
  );
  if (
    context?.profile.passwordChangedAt &&
    (!verified.issuedAt ||
      verified.issuedAt <= Date.parse(context.profile.passwordChangedAt))
  )
    return null;
  return context;
}
