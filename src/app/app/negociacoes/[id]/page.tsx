import { getDealPassportView } from "@/application/deal-service";
import { DealPassportClient } from "@/components/DealPassportClient";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";
import { notFound } from "next/navigation";

export default async function DealPassportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireInternalSession();

  try {
    const passport = await getDealPassportView({ ctx, dealId: id });
    const db = await loadDatabaseState();

    const internalStaffList = db.memberships
      .filter(
        (m) =>
          m.organizationId === ctx.organization.id &&
          m.isActive &&
          !m.roles.includes("CUSTOMER"),
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
