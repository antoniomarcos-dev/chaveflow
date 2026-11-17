import { LoginFormClient } from "@/components/LoginFormClient";
import { getDemoOrigin } from "@/lib/demo-config";
import { readSearchParams, type PageSearchParams } from "@/lib/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const sp = await readSearchParams(searchParams);
  const inDemo = Boolean(getDemoOrigin());
  return (
    <LoginFormClient
      redirectTo={sp.redirect || sp.next}
      area={sp.area}
      showDemoCredentials={inDemo}
      showOverview={inDemo && !sp.redirect && !sp.next}
    />
  );
}
