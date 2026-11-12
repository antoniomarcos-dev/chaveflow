import { listDealsForOrg } from "@/application/deal-service";
import { WorkQueuesClient } from "@/components/WorkQueuesClient";
import { canActOnArea, isSellerOnlyContext } from "@/domain/permissions";
import { AREA_LABELS, ResponsibleArea } from "@/domain/types";
import { recalculateTaskStates } from "@/domain/workflow-engine";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";

export default async function MinhasTarefasPage() {
  const ctx = await requireInternalSession();
  const deals = await listDealsForOrg({ ctx });
  const db = await loadDatabaseState();

  const visibleDeals = deals.filter(
    (d) => d.deal.status !== "DRAFT" && d.deal.status !== "CANCELLED",
  );

  const documents = visibleDeals.flatMap(({ deal, vehicle, customer }) =>
    db.documents
      .filter((doc) => doc.dealId === deal.id)
      .map((doc) => ({
        doc,
        deal,
        vehicle,
        customerName: customer.fullName,
      })),
  );

  const allTasks = visibleDeals.flatMap(({ deal, vehicle, customer }) => {
    const rawTasks = db.taskInstances.filter((t) => t.dealId === deal.id);
    const dealDocs = db.documents.filter((d) => d.dealId === deal.id);
    const recalculated = recalculateTaskStates(rawTasks, dealDocs);
    return recalculated
      .filter((t) => t.state !== "WAIVED_BY_RULE" && t.state !== "CANCELLED")
      .map((task) => ({
        task,
        deal,
        vehicle,
        customerName: customer.fullName,
      }));
  });

  const formalTasks = allTasks.filter(
    ({ task }) =>
      task.requiresFormalApproval &&
      task.approvalStatus !== "APPROVED" &&
      task.code !== "TASK_RELEASE_AUTH",
  );

  const accessibleAreas = (Object.keys(AREA_LABELS) as ResponsibleArea[]).filter(
    (area) => canActOnArea(ctx, area),
  );

  const canSeeTeam = !isSellerOnlyContext(ctx);

  return (
    <WorkQueuesClient
      deals={visibleDeals.map(
        ({ deal, vehicle, customer, sellerName, summary }) => ({
          deal,
          vehicle,
          customer: {
            id: customer.id,
            fullName: customer.fullName,
            documentNumber: customer.documentNumber,
          },
          sellerName,
          summary,
        }),
      )}
      documents={documents}
      formalTasks={formalTasks}
      allTasks={allTasks}
      currentUser={{
        id: ctx.profile.id,
        fullName: ctx.profile.fullName,
        roles: ctx.roles,
        accessibleAreas,
        canSeeTeam,
      }}
      defaultScope="MINE"
    />
  );
}
