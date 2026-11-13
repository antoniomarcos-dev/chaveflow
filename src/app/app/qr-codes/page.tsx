import { listVehiclesForOrg } from "@/application/vehicle-service";
import { VehicleQrManagerClient } from "@/components/VehicleQrManagerClient";
import { hasPermission } from "@/domain/permissions";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";
import { redirect } from "next/navigation";

export default async function QrCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const ctx = await requireInternalSession();
  if (!hasPermission(ctx, "vehicle:manage")) redirect("/app/veiculos");
  const [vehicles, db, params] = await Promise.all([
    listVehiclesForOrg({ ctx }),
    loadDatabaseState(),
    searchParams,
  ]);
  return (
    <VehicleQrManagerClient
      vehicles={vehicles}
      branches={db.branches.filter(
        (b) => b.organizationId === ctx.organization.id,
      )}
      initialVehicleId={params.vehicleId}
    />
  );
}
