import { LoginFormClient } from "@/components/LoginFormClient";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const sp = await searchParams;
  return <LoginFormClient redirectTo={sp.redirect} />;
}
