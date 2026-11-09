import React from "react";
import { getServerSessionContext } from "@/lib/server-session";
import { listVehiclesForOrg } from "@/application/vehicle-service";
import { hasPermission } from "@/domain/permissions";
import { loadDatabaseState } from "@/infrastructure/database";
import { VehiclesCatalogClient } from "@/components/VehiclesCatalogClient";

export default async function VeiculosPage() {
  const ctx = (await getServerSessionContext())!;
  const vehicles = listVehiclesForOrg({ ctx });
  const db = loadDatabaseState();
  const branches = db.branches.filter(
    (b) => b.organizationId === ctx.organization.id
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
