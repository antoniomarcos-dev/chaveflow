import { listVehiclesForOrg } from "@/application/vehicle-service";
import { VehiclesCatalogClient } from "@/components/VehiclesCatalogClient";
import { hasPermission } from "@/domain/permissions";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";

export default async function VeiculosPage() {
  const ctx = await requireInternalSession();
  const vehicles = await listVehiclesForOrg({ ctx });
  const db = await loadDatabaseState();
  const branches = db.branches.filter(
    (b) => b.organizationId === ctx.organization.id,
  );

  return (
    <VehiclesCatalogClient
      vehicles={vehicles}
      branches={branches}
      canManageVehicles={hasPermission(ctx, "vehicle:manage")}
      canCreateDeal={hasPermission(ctx, "deal:create")}
    />
  );
}
