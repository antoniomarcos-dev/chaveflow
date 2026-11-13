import {
  createOrUpdateVehicle,
  processVehicleCsvImport,
  resolveScannedVehicleCode,
} from "@/application/vehicle-service";
import { AuthorizationError } from "@/domain/permissions";
import { generateVehicleQrLabels } from "@/application/vehicle-qr-service";
import { assertSameOriginRequest } from "@/lib/request-security";
import { getServerSessionContext } from "@/lib/server-session";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  try {
    assertSameOriginRequest(req);
    if (Number(req.headers.get("content-length") || "0") > 4.4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Envie uma foto de até 4 MB." },
        { status: 413 },
      );
    }
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const ctx = await getServerSessionContext();
      if (!ctx)
        return NextResponse.json(
          { error: "Sua sessão expirou. Entre novamente para salvar." },
          { status: 401 },
        );
      const form = await req.formData();
      const entry = form.get("photo");
      if (entry !== null && !(entry instanceof File))
        throw new Error("Foto inválida.");
      const file = entry instanceof File ? entry : null;
      if (file && file.size > 4 * 1024 * 1024)
        return NextResponse.json(
          { error: "Envie uma foto de até 4 MB." },
          { status: 413 },
        );
      const vehicle = await createOrUpdateVehicle({
        ctx,
        vehicleId: String(form.get("vehicleId") || "") || undefined,
        input: JSON.parse(String(form.get("input") || "{}")),
        removePhoto: form.get("removePhoto") === "true",
        photo:
          file && file.size > 0
            ? {
                contentBuffer: Buffer.from(await file.arrayBuffer()),
                originalFilename: file.name,
                mimeType: file.type,
              }
            : undefined,
      });
      return NextResponse.json({ ok: true, vehicle });
    }
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

    const ctx = await getServerSessionContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Sessão expirada ou usuário não autenticado." },
        { status: 401 },
      );
    }

    if (action === "GENERATE_QR_SVG" || action === "GENERATE_QR_LABELS") {
      const labels = await generateVehicleQrLabels({
        ctx,
        vehicleIds:
          action === "GENERATE_QR_SVG"
            ? [String(body.vehicleId || "")]
            : Array.isArray(body.vehicleIds)
              ? body.vehicleIds.map(String)
              : [],
        origin: req.nextUrl.origin,
        requireManage: action === "GENERATE_QR_LABELS",
      });
      return NextResponse.json({
        ok: true,
        labels,
        ...(action === "GENERATE_QR_SVG" ? labels[0] : {}),
      });
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
        commit: body.commit === true,
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
