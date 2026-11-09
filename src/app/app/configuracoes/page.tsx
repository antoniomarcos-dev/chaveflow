import { OrganizationSettingsClient } from "@/components/OrganizationSettingsClient";
import { hasPermission } from "@/domain/permissions";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";

export default async function ConfiguracoesPage() {
  const ctx = await requireInternalSession();
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
        fullName: p.fullName,
        email: p.email,
        phone: p.phone,
        branchName: b?.name ?? "Unidade Padrão",
        roles: m.roles,
        isActive: m.isActive,
      };
    });

  const auditEvents = db.auditEvents
    .filter((ae) => ae.organizationId === ctx.organization.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <OrganizationSettingsClient
      organization={ctx.organization}
      branches={branches}
      members={members}
      auditEvents={auditEvents}
      canManageUsers={hasPermission(ctx, "user:manage")}
    />
  );
}
