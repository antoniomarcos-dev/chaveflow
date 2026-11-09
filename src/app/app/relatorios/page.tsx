import { getManagerialDashboardData } from "@/application/report-and-admin-service";
import { ManagerialDashboardClient } from "@/components/ManagerialDashboardClient";
import { requireInternalSession } from "@/lib/server-session";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodDays?: string;
    sellerId?: string;
    vehicleModel?: string;
    statusFilter?: string;
  }>;
}) {
  const sp = await searchParams;
  const ctx = await requireInternalSession();

  const data = await getManagerialDashboardData({
    ctx,
    periodDays: sp.periodDays ? Number(sp.periodDays) : 30,
    sellerId: sp.sellerId || "ALL",
    vehicleModel: sp.vehicleModel || "ALL",
    statusFilter: sp.statusFilter || "ALL",
  });

  return <ManagerialDashboardClient data={data} />;
}
