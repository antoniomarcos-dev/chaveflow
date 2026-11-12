import { listDealsForOrg } from "@/application/deal-service";
import { DealsListClient } from "@/components/DealsListClient";
import { hasPermission } from "@/domain/permissions";
import { requireInternalSession } from "@/lib/server-session";

export default async function NegociacoesListPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const ctx = await requireInternalSession();
  const deals = await listDealsForOrg({ ctx });
  const canCreate = hasPermission(ctx, "deal:create");
  const { filtro } = await searchParams;

  const initialFilter =
    filtro === "PENDENTES"
      ? "PENDING"
      : filtro === "LIBERACAO"
        ? "AWAITING_RELEASE"
        : filtro === "CONCLUIDAS"
          ? "DELIVERED"
          : "ALL";

  return (
    <DealsListClient
      deals={deals}
      canCreate={canCreate}
      initialFilter={initialFilter}
    />
  );
}
