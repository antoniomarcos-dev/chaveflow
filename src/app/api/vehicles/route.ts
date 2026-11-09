import {
  createOrUpdateVehicle,
  processVehicleCsvImport,
  resolveScannedVehicleCode,
} from "@/application/vehicle-service";
import { AuthorizationError } from "@/domain/permissions";
import { assertSameOriginRequest } from "@/lib/request-security";
import { getServerSessionContext } from "@/lib/server-session";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  try {
    assertSameOriginRequest(req);
    const body = await req.json();
    const action = body.action as string;

    if (action === "RESOLVE_QR_SCAN") {
      const ctx = await getServerSessionContext();
      const result = await resolveScannedVehicleCode({
        ctx,
        rawQrCode: String(body.rawQrCode || ""),
      });
      return NextResponse.json({ ok: true, result });
    }

    if (action === "GENERATE_QR_SVG") {
      const payload = String(body.payload || "cf://v/unknown");
      const svgString = await QRCode.toString(payload, {
        type: "svg",
        margin: 1,
        width: 200,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });
      return NextResponse.json({ ok: true, svg: svgString });
    }

    const ctx = await getServerSessionContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Sessão expirada ou usuário não autenticado." },
        { status: 401 },
      );
    }

    if (action === "CREATE_OR_UPDATE") {
      const vehicle = await createOrUpdateVehicle({
        ctx,
        vehicleId: body.vehicleId ? String(body.vehicleId) : undefined,
        input: body.input,
      });
      return NextResponse.json({ ok: true, vehicle });
    }

    if (action === "CSV_IMPORT") {
      const report = await processVehicleCsvImport({
        ctx,
        csvText: String(body.csvText || ""),
        branchId: String(body.branchId || ctx.branch?.id || ""),
        commit: Boolean(body.commit),
      });
      return NextResponse.json({ ok: true, report });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode },
      );
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: err.issues.map((i) => i.message).join(" • "),
          issues: err.issues,
        },
        { status: 400 },
      );
    }
    const msg =
      err instanceof Error ? err.message : "Erro ao processar veículo.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
