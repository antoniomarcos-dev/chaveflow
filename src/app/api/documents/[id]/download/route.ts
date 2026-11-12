import { canAccessDealRecord } from "@/domain/permissions";
import {
  loadDatabaseState,
  readPrivateFileBlob,
  verifyTemporaryDocumentToken,
} from "@/infrastructure/database";
import { getServerSessionContext } from "@/lib/server-session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: documentId } = await context.params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const versionParam = Number(url.searchParams.get("version") || "1");

  const verified = verifyTemporaryDocumentToken(token);
  if (!verified.valid || verified.documentId !== documentId) {
    return NextResponse.json(
      {
        error:
          "Acesso negado ao documento privado: link temporário inválido ou expirado.",
      },
      { status: 403 },
    );
  }

  const sessionCtx = await getServerSessionContext();
  if (sessionCtx && sessionCtx.organization.id !== verified.organizationId) {
    return NextResponse.json(
      { error: "Isolamento por organização: acesso negado." },
      { status: 403 },
    );
  }

  const db = await loadDatabaseState();
  const docRecord = db.documents.find(
    (d) =>
      d.id === documentId && d.organizationId === verified.organizationId,
  );
  if (sessionCtx && docRecord) {
    const parentDeal = db.deals.find((d) => d.id === docRecord.dealId);
    if (sessionCtx.profile.isCustomerOnly) {
      if (
        !parentDeal ||
        parentDeal.customerId !== sessionCtx.customerRecordId ||
        !docRecord.isCustomerVisible
      ) {
        return NextResponse.json(
          { error: "Acesso negado a este documento." },
          { status: 403 },
        );
      }
    } else if (parentDeal && !canAccessDealRecord(sessionCtx, parentDeal)) {
      return NextResponse.json(
        {
          error:
            "Acesso restrito: vendedores só podem acessar documentos de suas próprias negociações.",
        },
        { status: 403 },
      );
    }
  }

  const docVersion = db.documentVersions.find(
    (dv) =>
      dv.documentId === documentId &&
      dv.versionNumber === (verified.versionNumber || versionParam) &&
      dv.organizationId === verified.organizationId,
  );

  if (!docVersion) {
    return NextResponse.json(
      { error: "Versão do documento não encontrada." },
      { status: 404 },
    );
  }

  const blob = await readPrivateFileBlob(docVersion.storageKey);

  return new NextResponse(new Uint8Array(blob), {
    status: 200,
    headers: {
      "Content-Type": docVersion.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(
        docVersion.originalFilename,
      )}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
