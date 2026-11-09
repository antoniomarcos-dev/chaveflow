import { VehicleFormClient } from "@/components/VehicleFormClient";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";

export default async function NovoVeiculoPage() {
  const ctx = await requireInternalSession();
  const db = await loadDatabaseState();
  const branches = db.branches.filter(
    (b) => b.organizationId === ctx.organization.id,
  );

  return <VehicleFormClient branches={branches} />;
}
