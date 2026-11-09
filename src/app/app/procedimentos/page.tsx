import { listProceduresForOrg } from "@/application/report-and-admin-service";
import { ProceduresAdminClient } from "@/components/ProceduresAdminClient";
import { hasPermission } from "@/domain/permissions";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";

export default async function ProcedimentosPage() {
  const ctx = await requireInternalSession();
  const procedures = await listProceduresForOrg(ctx);
  const db = await loadDatabaseState();

  const wfTemplate = db.workflowTemplates.find(
    (wt) => wt.organizationId === ctx.organization.id,
  )!;
  const taskTemplates = db.taskTemplates
    .filter((tt) => tt.workflowVersionId === wfTemplate.activeVersionId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const documentRequirements = db.documentRequirements.filter(
    (dr) => dr.workflowVersionId === wfTemplate.activeVersionId,
  );

  const internalStaff = db.memberships
    .filter(
      (m) =>
        m.organizationId === ctx.organization.id &&
        m.isActive &&
        !m.roles.includes("CUSTOMER"),
    )
    .map((m) => {
      const p = db.profiles.find((pr) => pr.id === m.profileId)!;
      return { id: p.id, fullName: p.fullName };
    });

  return (
    <ProceduresAdminClient
      procedures={procedures}
      taskTemplates={taskTemplates}
      documentRequirements={documentRequirements}
      internalStaff={internalStaff}
      canManageProcedures={hasPermission(ctx, "procedure:manage")}
    />
  );
}
