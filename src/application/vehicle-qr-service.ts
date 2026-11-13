import QRCode from "qrcode";
import { assertInternalStaff, assertPermission } from "@/domain/permissions";
import type { AuthenticatedContext } from "@/domain/types";
import { loadDatabaseState } from "@/infrastructure/database";

export async function generateVehicleQrLabels(params: {
  ctx: AuthenticatedContext;
  vehicleIds: string[];
  origin: string;
  requireManage?: boolean;
}) {
  assertInternalStaff(params.ctx);
  if (params.requireManage !== false)
    assertPermission(params.ctx, "vehicle:manage");
  const ids = [...new Set(params.vehicleIds)];
  if (!ids.length || ids.length > 40)
    throw new Error("Selecione de 1 a 40 veículos por impressão.");
  const base = new URL(process.env.CHAVEFLOW_APP_URL || params.origin);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  )
    throw new Error("Endereço do aplicativo inválido para gerar etiquetas.");
  const db = await loadDatabaseState();
  const vehicles = ids.map((id) =>
    db.vehicles.find(
      (v) => v.id === id && v.organizationId === params.ctx.organization.id,
    ),
  );
  if (vehicles.some((v) => !v))
    throw new Error(
      "Um dos veículos não está disponível nesta organização. Atualize a lista.",
    );
  return Promise.all(
    vehicles.map(async (vehicle) => {
      const url = new URL(`/q/${encodeURIComponent(vehicle!.qrToken)}`, base);
      const payload = url.toString();
      const svg = await QRCode.toString(payload, {
        type: "svg",
        margin: 4,
        width: 240,
        errorCorrectionLevel: "M",
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      return { vehicleId: vehicle!.id, payload, svg };
    }),
  );
}
