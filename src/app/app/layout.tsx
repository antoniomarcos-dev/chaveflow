import React from "react";
import { getServerSessionContext } from "@/lib/server-session";
import { isDemoEnvironment, listDemoPersonas } from "@/application/auth-service";
import { listNotificationsForUser } from "@/application/report-and-admin-service";
import { AppShell } from "@/components/AppShell";
import { UnauthenticatedGate } from "@/components/UnauthenticatedGate";

export default async function InternalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getServerSessionContext();
  const isDemoMode = isDemoEnvironment();
  const demoPersonas = isDemoMode ? listDemoPersonas() : [];

  if (!ctx || ctx.profile.isCustomerOnly) {
    return (
      <UnauthenticatedGate
        isDemoMode={isDemoMode}
        demoPersonas={demoPersonas}
      />
    );
  }

  const notifications = listNotificationsForUser(ctx);

  return (
    <AppShell
      user={{
        id: ctx.profile.id,
        fullName: ctx.profile.fullName,
        email: ctx.profile.email,
        isCustomerOnly: ctx.profile.isCustomerOnly,
      }}
      organizationName={ctx.organization.name}
      branchName={ctx.branch?.name ?? "Unidade Padrão"}
      roles={ctx.roles}
      isDemoMode={isDemoMode}
      demoPersonas={demoPersonas}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}
