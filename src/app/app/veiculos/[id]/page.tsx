import React from "react";
import { notFound } from "next/navigation";
import { getServerSessionContext } from "@/lib/server-session";
import { getVehicleDetails } from "@/application/vehicle-service";
import { hasPermission } from "@/domain/permissions";
import { loadDatabaseState } from "@/infrastructure/database";
import { VehicleDetailClient } from "@/components/VehicleDetailClient";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = (await getServerSessionContext())!;

  try {
    const details = getVehicleDetails({ ctx, vehicleId: id });
    const db = loadDatabaseState();
    const branches = db.branches.filter(
      (b) => b.organizationId === ctx.organization.id
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
