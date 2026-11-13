import { listVehiclesForOrg } from "@/application/vehicle-service";
import { GuidedDealWizardClient } from "@/components/GuidedDealWizardClient";
import { canAccessDealRecord, isVehicleSellable, hasPermission } from "@/domain/permissions";
import { redirect } from "next/navigation";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";

export default async function NovaNegociacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string; draftId?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireInternalSession();
  if (!hasPermission(ctx, "deal:create")) redirect("/app/negociacoes");
  const db = await loadDatabaseState();

  const candidateDraft = sp.draftId
    ? db.deals.find(
        (d) =>
          d.id === sp.draftId &&
          d.organizationId === ctx.organization.id &&
          d.status === "DRAFT",
      )
    : undefined;

  const existingDraft =
    candidateDraft && canAccessDealRecord(ctx, candidateDraft)
      ? candidateDraft
      : undefined;

  const existingDraftTradeIn = existingDraft
    ? (db.tradeInVehicles.find((t) => t.dealId === existingDraft.id) ?? null)
    : null;

  const allVehicles = await listVehiclesForOrg({ ctx });
  const availableVehicles = allVehicles.filter(
    (v) =>
      isVehicleSellable(v, Boolean(v.activeDeal)) ||
      v.id === existingDraft?.vehicleId,
  );

  const customers = db.customers.filter(
    (c) => c.organizationId === ctx.organization.id,
  );
  const branches = db.branches.filter(
    (b) => b.organizationId === ctx.organization.id && b.isActive,
  );

  const internalSellers = db.memberships
    .filter(
      (m) =>
        m.organizationId === ctx.organization.id &&
        (!ctx.roles.every((r) => r === "SELLER") ||
          m.profileId === ctx.profile.id) &&
        m.isActive &&
        (m.roles.includes("SELLER") ||
          m.roles.includes("MANAGER") ||
          m.roles.includes("ADMIN")),
    )
    .map((m) => {
      const p = db.profiles.find((pr) => pr.id === m.profileId)!;
      return { id: p.id, fullName: p.fullName };
    });

  const wfTemplate = db.workflowTemplates.find(
    (wt) => wt.organizationId === ctx.organization.id,
  )!;
  const taskTemplates = db.taskTemplates
    .filter((tt) => tt.workflowVersionId === wfTemplate.activeVersionId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const documentRequirements = db.documentRequirements.filter(
    (dr) => dr.workflowVersionId === wfTemplate.activeVersionId,
  );

  return (
    <GuidedDealWizardClient
      availableVehicles={availableVehicles}
      customers={customers}
      branches={branches}
      sellers={internalSellers}
      taskTemplates={taskTemplates}
      documentRequirements={documentRequirements}
      defaultSellerId={ctx.profile.id}
      defaultBranchId={ctx.branch?.id || branches[0]?.id || ""}
      preselectedVehicleId={sp.vehicleId}
      existingDraft={existingDraft}
      existingDraftTradeIn={existingDraftTradeIn}
    />
  );
}
