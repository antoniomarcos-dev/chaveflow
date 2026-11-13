import { VehicleQrScannerClient } from "@/components/VehicleQrScannerClient";
import { getServerSessionContext } from "@/lib/server-session";
import { redirect } from "next/navigation";

export default async function EscanearVeiculoPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await getServerSessionContext();
  if (!ctx) redirect(`/login?redirect=${encodeURIComponent(`/app/escanear${sp.code ? `?code=${encodeURIComponent(sp.code)}` : ""}`)}`);
  if (ctx.profile.isCustomerOnly) redirect("/cliente");

  return (
    <VehicleQrScannerClient
      initialCode={sp.code}
      canManageVehicles={ctx.roles.includes("ADMIN") || ctx.roles.includes("MANAGER")}
    />
  );
}
