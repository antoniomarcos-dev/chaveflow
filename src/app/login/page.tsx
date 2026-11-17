import { LoginFormClient } from "@/components/LoginFormClient";
import { getDemoOrigin, getDemoUrl } from "@/lib/demo-request";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; next?: string; area?: string }>;
}) {
  const sp = await searchParams;
  return (
    <LoginFormClient
      redirectTo={sp.redirect || sp.next}
      area={sp.area}
      showDemoCredentials={Boolean(await getDemoOrigin())}
      demoUrl={getDemoUrl()}
    />
  );
}
