import { LoginFormClient } from "@/components/LoginFormClient";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; area?: string }>;
}) {
  const sp = await searchParams;
  return <LoginFormClient redirectTo={sp.redirect} area={sp.area} />;
}
