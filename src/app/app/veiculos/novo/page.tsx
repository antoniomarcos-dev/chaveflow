import { VehicleFormClient } from "@/components/VehicleFormClient";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";
import { hasPermission } from "@/domain/permissions";
import { redirect } from "next/navigation";

export default async function NovoVeiculoPage() {
  const ctx = await requireInternalSession();
  if (!hasPermission(ctx, "vehicle:manage")) redirect("/app/veiculos");
  const db = await loadDatabaseState();
  const branches = db.branches.filter(
    (b) => b.organizationId === ctx.organization.id && b.isActive,
  );

  return <VehicleFormClient branches={branches} />;
}
