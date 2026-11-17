import { LoginFormClient } from "@/components/LoginFormClient";
import { getDemoOrigin, getDemoUrl } from "@/lib/demo-request";
import { readSearchParams, type PageSearchParams } from "@/lib/navigation";
import { getServerSessionContext } from "@/lib/server-session";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const [ctx, sp, demoOrigin] = await Promise.all([
    getServerSessionContext(),
    readSearchParams(searchParams),
    getDemoOrigin(),
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
      showDemoCredentials={Boolean(demoOrigin)}
      demoUrl={getDemoUrl()}
      showOverview
    />
  );
}
