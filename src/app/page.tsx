import { LoginFormClient } from "@/components/LoginFormClient";
import { getServerSessionContext } from "@/lib/server-session";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string; next?: string; area?: string }>;
}) {
  const ctx = await getServerSessionContext();
  const sp = searchParams ? await searchParams : {};
  const dashboard = ctx
    ? ctx.profile.isCustomerOnly
      ? "/cliente"
      : "/app"
    : null;

  return (
    <LoginFormClient
      redirectTo={sp?.redirect || sp?.next}
      area={sp?.area}
      authenticatedDashboardUrl={dashboard}
      authenticatedUserName={ctx?.profile.fullName ?? null}
    />
  );
}
