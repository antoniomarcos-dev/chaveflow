import { listVehiclesForOrg } from "@/application/vehicle-service";
import { VehicleQrScannerClient } from "@/components/VehicleQrScannerClient";
import { requireInternalSession } from "@/lib/server-session";

export default async function EscanearVeiculoPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireInternalSession();
  const vehicles = await listVehiclesForOrg({ ctx });

  const labelVehicles = vehicles.map((v) => ({
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
      labelVehicles={labelVehicles}
    />
  );
}
