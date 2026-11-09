import React from "react";
import { notFound } from "next/navigation";
import { getServerSessionContext } from "@/lib/server-session";
import { getDealPassportView } from "@/application/deal-service";
import { loadDatabaseState } from "@/infrastructure/database";
import { DealPassportClient } from "@/components/DealPassportClient";

export default async function DealPassportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = (await getServerSessionContext())!;

  try {
    const passport = getDealPassportView({ ctx, dealId: id });
    const db = loadDatabaseState();

    const internalStaffList = db.memberships
      .filter(
        (m) =>
          m.organizationId === ctx.organization.id &&
          m.isActive &&
          !m.roles.includes("CUSTOMER")
      )
      .map((m) => {
        const p = db.profiles.find((pr) => pr.id === m.profileId)!;
        return {
          id: p.id,
          fullName: p.fullName,
          roles: m.roles,
        };
      });

    return (
      <DealPassportClient
        passport={passport}
        userRoles={ctx.roles}
        userPermissions={ctx.permissions}
        internalStaffList={internalStaffList}
      />
    );
  } catch {
    notFound();
  }
}
