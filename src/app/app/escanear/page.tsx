import React from "react";
import { getServerSessionContext } from "@/lib/server-session";
import { listVehiclesForOrg } from "@/application/vehicle-service";
import { scannerCapabilitiesAdapter } from "@/infrastructure/adapters";
import { VehicleQrScannerClient } from "@/components/VehicleQrScannerClient";

export default async function EscanearVeiculoPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const sp = await searchParams;
  const ctx = (await getServerSessionContext())!;
  const vehicles = listVehiclesForOrg({ ctx });

  const demoVehicles = vehicles.map((v) => ({
    id: v.id,
    internalCode: v.internalCode,
    qrToken: v.qrToken,
    brand: v.brand,
    model: v.model,
    color: v.color,
    vin: v.vin,
    activeDealNumber: v.activeDeal?.dealNumber ?? null,
  }));

  return (
    <VehicleQrScannerClient
      initialCode={sp.code}
      demoVehicles={demoVehicles}
      scannerCapabilities={scannerCapabilitiesAdapter.getCapabilitiesSummary()}
    />
  );
}
