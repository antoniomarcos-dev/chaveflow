import { LoginFormClient } from "@/components/LoginFormClient";

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
    />
  );
}
