import { LoginFormClient } from "@/components/LoginFormClient";
import { getDemoOrigin, getDemoUrl } from "@/lib/demo-request";
import { readSearchParams, type PageSearchParams } from "@/lib/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const [sp, demoOrigin] = await Promise.all([
    readSearchParams(searchParams),
    getDemoOrigin(),
  ]);
  return (
    <LoginFormClient
      redirectTo={sp.redirect || sp.next}
      area={sp.area}
      showDemoCredentials={Boolean(demoOrigin)}
      demoUrl={getDemoUrl()}
      showOverview={Boolean(demoOrigin) && !sp.redirect && !sp.next}
    />
  );
}
