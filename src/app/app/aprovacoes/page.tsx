import { listDealsForOrg } from "@/application/deal-service";
import { WorkQueuesClient } from "@/components/WorkQueuesClient";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";

export default async function AprovacoesWorkQueuesPage() {
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

  const formalTasks = visibleDeals.flatMap(({ deal, vehicle, customer }) =>
    db.taskInstances
      .filter(
        (t) =>
          t.dealId === deal.id &&
          t.requiresFormalApproval &&
          t.state !== "WAIVED_BY_RULE" &&
          t.approvalStatus !== "APPROVED" &&
          t.code !== "TASK_RELEASE_AUTH",
      )
      .map((task) => ({
        task,
        deal,
        vehicle,
        customerName: customer.fullName,
      })),
  );

  return (
    <WorkQueuesClient
      deals={visibleDeals.map(({ deal, vehicle, customer, sellerName, summary }) => ({
        deal,
        vehicle,
        customer: {
          id: customer.id,
          fullName: customer.fullName,
          documentNumber: customer.documentNumber,
        },
        sellerName,
        summary,
      }))}
      documents={documents}
      formalTasks={formalTasks}
    />
  );
}
