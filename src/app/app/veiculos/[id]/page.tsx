import { getVehicleDetails } from "@/application/vehicle-service";
import { VehicleDetailClient } from "@/components/VehicleDetailClient";
import { hasPermission } from "@/domain/permissions";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";
import { notFound } from "next/navigation";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireInternalSession();

  try {
    const details = await getVehicleDetails({ ctx, vehicleId: id });
    const db = await loadDatabaseState();
    const branches = db.branches.filter(
      (b) => b.organizationId === ctx.organization.id,
    );

    return (
      <VehicleDetailClient
        vehicle={details.vehicle}
        dealHistory={details.dealHistory}
        branches={branches}
        canManageVehicles={hasPermission(ctx, "vehicle:manage")}
        canCreateDeal={hasPermission(ctx, "deal:create")}
      />
    );
  } catch {
    notFound();
  }
}
