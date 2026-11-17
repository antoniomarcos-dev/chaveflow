import { readSearchParams, type PageSearchParams } from "@/lib/navigation";
import { getManagerialDashboardData } from "@/application/report-and-admin-service";
import { ManagerialDashboardClient } from "@/components/ManagerialDashboardClient";
import { hasPermission } from "@/domain/permissions";
import { DealStatusSchema } from "@/domain/types";
import { requireInternalSession } from "@/lib/server-session";
import { redirect } from "next/navigation";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const sp = await readSearchParams(searchParams);
  const ctx = await requireInternalSession();
  if (!hasPermission(ctx, "report:view")) redirect("/app");

  const requestedPeriod = Number(sp.periodDays);
  const status = DealStatusSchema.safeParse(sp.statusFilter);

  const data = await getManagerialDashboardData({
    ctx,
    periodDays: [7, 30, 90, 365].includes(requestedPeriod) ? requestedPeriod : 30,
    sellerId: sp.sellerId || "ALL",
    vehicleModel: sp.vehicleModel || "ALL",
    statusFilter: status.success ? status.data : "ALL",
  });

  return <ManagerialDashboardClient data={data} />;
}
