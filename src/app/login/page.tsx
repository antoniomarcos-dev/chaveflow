import React from "react";
import { isDemoEnvironment, listDemoPersonas } from "@/application/auth-service";
import { LoginFormClient } from "@/components/LoginFormClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const sp = await searchParams;
  const isDemoMode = isDemoEnvironment();
  const demoPersonas = isDemoMode ? listDemoPersonas() : [];

  return (
    <LoginFormClient
      isDemoMode={isDemoMode}
      demoPersonas={demoPersonas}
      redirectTo={sp.redirect}
    />
  );
}
