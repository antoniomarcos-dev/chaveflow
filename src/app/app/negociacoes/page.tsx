import { listDealsForOrg } from "@/application/deal-service";
import {
  DealsListClient,
  type EnrichedDealListItem,
  type StatusFilterId,
} from "@/components/DealsListClient";
import { hasPermission } from "@/domain/permissions";
import { computeUserNextAction } from "@/domain/workflow-engine";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";

function normalizeInitialStatusFilter(
  statusParam?: string,
  legacyFiltro?: string,
): StatusFilterId {
  const raw = (statusParam || legacyFiltro || "").toUpperCase();
  if (raw === "EM_ANDAMENTO" || raw === "IN_PROGRESS") return "EM_ANDAMENTO";
  if (raw === "EXIGINDO_ACAO" || raw === "PENDENTES" || raw === "PENDING")
    return "EXIGINDO_ACAO";
  if (raw === "PRONTA_AUTORIZACAO" || raw === "LIBERACAO")
    return "PRONTA_AUTORIZACAO";
  if (raw === "AUTORIZADA_ENTREGA") return "AUTORIZADA_ENTREGA";
  if (raw === "ENTREGUE" || raw === "CONCLUIDAS" || raw === "DELIVERED")
    return "ENTREGUE";
  if (raw === "RASCUNHO" || raw === "DRAFT") return "RASCUNHO";
  if (raw === "CANCELADA" || raw === "CANCELLED") return "CANCELADA";
  return "TODAS";
}

export default async function NegociacoesListPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    filtro?: string;
    responsavel?: string;
  }>;
}) {
  const ctx = await requireInternalSession();
  const deals = await listDealsForOrg({ ctx });
  const db = await loadDatabaseState();
  const canCreate = hasPermission(ctx, "deal:create");
  const sp = await searchParams;

  const enrichedDeals: EnrichedDealListItem[] = deals.map((item) => {
    const dealTasks = db.taskInstances.filter(
      (t) => t.dealId === item.deal.id,
    );
    const dealDocs = db.documents.filter((d) => d.dealId === item.deal.id);
    const nextAction = computeUserNextAction(
      ctx,
      item.deal,
      dealTasks,
      dealDocs,
      item.summary,
    );

    return {
      ...item,
      nextActionHeadline: nextAction.headline,
      nextActionAreaLabel: nextAction.responsibleAreaLabel,
      nextActionHasDirectAction: nextAction.hasDirectAction,
    };
  });

  const initialStatus = normalizeInitialStatusFilter(sp.status, sp.filtro);

  return (
    <DealsListClient
      deals={enrichedDeals}
      canCreate={canCreate}
      initialSearch={sp.q || ""}
      initialStatus={initialStatus}
      initialResponsible={sp.responsavel || "TODOS"}
    />
  );
}
