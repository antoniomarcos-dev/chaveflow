import { cookies } from "next/headers";
import {
  buildAuthenticatedContext,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/application/auth-service";
import { AuthenticatedContext } from "@/domain/types";

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

  return buildAuthenticatedContext(
    verified.profileId,
    verified.organizationId
  );
}
