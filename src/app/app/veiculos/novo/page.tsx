import React from "react";
import { getServerSessionContext } from "@/lib/server-session";
import { loadDatabaseState } from "@/infrastructure/database";
import { VehicleFormClient } from "@/components/VehicleFormClient";

export default async function NovoVeiculoPage() {
  const ctx = (await getServerSessionContext())!;
  const db = loadDatabaseState();
  const branches = db.branches.filter(
    (b) => b.organizationId === ctx.organization.id
  );

  return <VehicleFormClient branches={branches} />;
}
