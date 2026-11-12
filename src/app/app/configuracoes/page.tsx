import { listProceduresForOrg } from "@/application/report-and-admin-service";
import { OrganizationSettingsClient } from "@/components/OrganizationSettingsClient";
import { hasPermission } from "@/domain/permissions";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";
import { redirect } from "next/navigation";

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await requireInternalSession();
  const sp = await searchParams;

  const canManageUsers = hasPermission(ctx, "user:manage");
  const canManageProcedures = hasPermission(ctx, "procedure:manage");

  if (!canManageUsers && !canManageProcedures) {
    redirect("/app");
  }

  const db = await loadDatabaseState();

  const branches = db.branches.filter(
    (b) => b.organizationId === ctx.organization.id,
  );

  const members = db.memberships
    .filter((m) => m.organizationId === ctx.organization.id)
    .map((m) => {
      const p = db.profiles.find((pr) => pr.id === m.profileId)!;
      const b = m.branchId
        ? branches.find((br) => br.id === m.branchId)
        : branches[0];
      return {
        membershipId: m.id,
        profileId: p.id,
        fullName: p?.fullName || "Sem nome",
        email: p?.email || "",
        phone: p?.phone || "",
        branchName: b?.name ?? "Unidade Padrão",
        roles: m.roles,
        isActive: m.isActive,
      };
    });

  const auditEvents = db.auditEvents
    .filter((ae) => ae.organizationId === ctx.organization.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const procedures = await listProceduresForOrg(ctx);

  const wfTemplate = db.workflowTemplates.find(
    (wt) => wt.organizationId === ctx.organization.id,
  );
  const taskTemplates = wfTemplate
    ? db.taskTemplates
        .filter((tt) => tt.workflowVersionId === wfTemplate.activeVersionId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ id, title, slaHours, defaultAssigneeId, responsibleArea }) => ({
          id,
          title,
          slaHours,
          defaultAssigneeId,
          responsibleArea,
        }))
    : [];

  const internalStaff = db.memberships
    .filter(
      (m) =>
        m.organizationId === ctx.organization.id &&
        m.isActive &&
        !m.roles.includes("CUSTOMER"),
    )
    .map((m) => {
      const p = db.profiles.find((pr) => pr.id === m.profileId)!;
      return { id: p?.id || "", fullName: p?.fullName || "", roles: m.roles };
    });

  const dealNumbersById: Record<string, string> = {};
  for (const d of db.deals) {
    if (d.organizationId === ctx.organization.id) {
      dealNumbersById[d.id] = d.dealNumber;
    }
  }

  const initialTab =
    sp.tab === "GENERAL" ||
    sp.tab === "PROCEDURES" ||
    sp.tab === "DEFAULTS" ||
    sp.tab === "AUDIT"
      ? sp.tab
      : "USERS";

  return (
    <OrganizationSettingsClient
      organization={ctx.organization}
      branches={branches}
      members={members}
      auditEvents={auditEvents}
      procedures={procedures}
      taskTemplates={taskTemplates}
      internalStaff={internalStaff}
      dealNumbersById={dealNumbersById}
      canManageUsers={canManageUsers}
      canManageProcedures={canManageProcedures}
      currentUserId={ctx.profile.id}
      initialTab={initialTab}
    />
  );
}
