import { getDealPassportView } from "@/application/deal-service";
import { DealPassportClient } from "@/components/DealPassportClient";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";
import { notFound } from "next/navigation";

export default async function DealPassportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    taskCode?: string;
    docId?: string;
    from?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
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

    const initialTab =
      sp.tab === "DOCUMENTS" ||
      sp.tab === "SALE_DATA" ||
      sp.tab === "RELEASE" ||
      sp.tab === "HISTORY" ||
      sp.tab === "TASKS"
        ? sp.tab === "RELEASE"
          ? "SALE_DATA"
          : sp.tab
        : sp.docId
          ? "DOCUMENTS"
          : "TASKS";

    return (
      <DealPassportClient
        passport={passport}
        userRoles={ctx.roles}
        userPermissions={ctx.permissions}
        internalStaffList={internalStaffList}
        initialTab={initialTab}
        initialTaskCode={sp.taskCode}
        initialDocId={sp.docId}
        backHref={
          sp.from && sp.from.startsWith("/app") ? sp.from : "/app/negociacoes"
        }
      />
    );
  } catch {
    notFound();
  }
}
