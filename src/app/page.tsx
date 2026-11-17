import { LoginFormClient } from "@/components/LoginFormClient";
import { getDemoOrigin } from "@/lib/demo-config";
import { readSearchParams, type PageSearchParams } from "@/lib/navigation";
import { getServerSessionContext } from "@/lib/server-session";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const [ctx, sp] = await Promise.all([
    getServerSessionContext(),
    readSearchParams(searchParams),
  ]);
  const dashboard = ctx
    ? ctx.profile.isCustomerOnly
      ? "/cliente"
      : "/app"
    : null;

  return (
    <LoginFormClient
      redirectTo={sp.redirect || sp.next}
      area={sp.area}
      authenticatedDashboardUrl={dashboard}
      authenticatedUserName={ctx?.profile.fullName ?? null}
      showDemoCredentials={Boolean(getDemoOrigin())}
      showOverview
    />
  );
}
