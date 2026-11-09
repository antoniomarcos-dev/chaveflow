import { requireInternalSession } from "@/lib/server-session";
import React from "react";

import { listNotificationsForUser } from "@/application/report-and-admin-service";
import { AppShell } from "@/components/AppShell";

export default async function InternalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireInternalSession();

  const notifications = await listNotificationsForUser(ctx);

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
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}
