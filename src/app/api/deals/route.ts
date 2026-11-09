import {
  authorizeDealRelease,
  ConcurrencyConflictError,
  confirmPhysicalDelivery,
  createOrSaveGuidedDeal,
  getDealPassportView,
  PreconditionBlockedError,
  recordTaskFormalApproval,
  registerDealBilling,
  registerPostDeliveryAddendum,
  requestAdditionalDocument,
  reviewDocumentVersion,
  updateTaskOperationalState,
  uploadDocumentVersion,
} from "@/application/deal-service";
import { answerContextualQuestion } from "@/domain/contextual-assistant";
import { AuthorizationError } from "@/domain/permissions";
import { AuthenticatedContext } from "@/domain/types";
import { loadDatabaseState } from "@/infrastructure/database";
import { assertSameOriginRequest } from "@/lib/request-security";
import { getServerSessionContext } from "@/lib/server-session";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

async function resolveCustomerTokenContext(
  accessToken: string,
  expectedDealId: string,
): Promise<AuthenticatedContext> {
  const db = await loadDatabaseState();
  const cleanToken = accessToken.trim();

  const isVehicleQr = db.vehicles.some(
    (v) =>
      v.qrToken.toLowerCase() === cleanToken.toLowerCase() ||
      v.internalCode.toLowerCase() === cleanToken.toLowerCase(),
  );
  if (isVehicleQr) {
    throw new AuthorizationError(
      "Acesso negado: o QR Code do veículo não concede acesso de comprador.",
      "VEHICLE_QR_FORBIDDEN_FOR_CUSTOMER_PORTAL",
      403,
    );
  }

  const grant = db.customerAccessGrants.find(
    (g) => g.accessToken === cleanToken,
  );
  if (
    !grant ||
    grant.revokedAt ||
    new Date(grant.expiresAt).getTime() < Date.now() ||
    grant.dealId !== expectedDealId
  ) {
    throw new AuthorizationError(
      "Token de convite do comprador inválido, revogado ou expirado.",
      "INVALID_ACCESS_GRANT",
      403,
    );
  }

  const customer = db.customers.find((c) => c.id === grant.customerId);
  const org = db.organizations.find((o) => o.id === grant.organizationId);
  const branch = db.branches.find(
    (b) => b.organizationId === grant.organizationId,
  );
  if (!customer || !org || !branch) {
    throw new AuthorizationError(
      "Cadastro do comprador não localizado.",
      "CUSTOMER_NOT_FOUND",
      403,
    );
  }

  const linkedProfile = customer.profileId
    ? db.profiles.find((p) => p.id === customer.profileId)
    : null;

  return {
    profile: linkedProfile ?? {
      id: `cust-token-${customer.id}`,
      email: customer.email,
      fullName: customer.fullName,
      phone: customer.phone,
      passwordHash: "token-auth",
      isActive: true,
      isCustomerOnly: true,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    },
    organization: org,
    branch,
    membership: null,
    roles: ["CUSTOMER"],
    permissions: ["customer_portal:access"],
    customerRecordId: customer.id,
  };
}

export async function POST(req: NextRequest) {
  try {
    assertSameOriginRequest(req);
    if (Number(req.headers.get("content-length") || "0") > 4.4 * 1024 * 1024)
      return NextResponse.json(
        { error: "Envie um arquivo de até 4 MB." },
        { status: 413 },
      );
    let ctx = await getServerSessionContext();

    const contentType = req.headers.get("content-type") || "";

    // Suporte a multipart/form-data para upload real de arquivos
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const dealId = String(formData.get("dealId") || "");
      const documentId = String(formData.get("documentId") || "");
      const uploadNotes = String(formData.get("uploadNotes") || "");
      const replacementReason = String(formData.get("replacementReason") || "");
      const accessToken = String(formData.get("accessToken") || "");
      const file = formData.get("file");

      if (accessToken) {
        ctx = await resolveCustomerTokenContext(accessToken, dealId);
      }
      if (!ctx) {
        return NextResponse.json(
          { error: "Autenticação obrigatória no servidor." },
          { status: 401 },
        );
      }

      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: "Selecione um arquivo válido para enviar." },
          { status: 400 },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const res = await uploadDocumentVersion({
        ctx,
        dealId,
        documentId,
        originalFilename: file.name,
        mimeType: file.type || "text/plain",
        contentBuffer: buffer,
        uploadNotes,
        replacementReason,
      });

      return NextResponse.json({ ok: true, ...res });
    }

    const body = await req.json();
    const action = body.action as string;

    if (!ctx) {
      return NextResponse.json(
        { error: "Autenticação obrigatória no servidor." },
        { status: 401 },
      );
    }

    if (action === "CREATE_OR_SAVE_DEAL") {
      const res = await createOrSaveGuidedDeal({
        ctx,
        input: body.input,
        idempotencyKey: body.idempotencyKey
          ? String(body.idempotencyKey)
          : undefined,
      });
      return NextResponse.json({ ok: true, ...res });
    }

    if (action === "TASK_ACTION") {
      const task = await updateTaskOperationalState({
        ctx,
        dealId: String(body.dealId || ""),
        taskCode: String(body.taskCode || ""),
        action: body.taskAction,
        targetAssigneeId: body.targetAssigneeId
          ? String(body.targetAssigneeId)
          : undefined,
        notes: body.notes ? String(body.notes) : undefined,
      });
      return NextResponse.json({ ok: true, task });
    }

    if (action === "REQUEST_DOCUMENT") {
      const doc = await requestAdditionalDocument({
        ctx,
        dealId: String(body.dealId || ""),
        title: String(body.title || ""),
        category: String(body.category || "COMPLEMENTARY"),
        whyRequired: String(body.whyRequired || ""),
        responsibleArea: body.responsibleArea || "DOCUMENTATION",
        taskCode: body.taskCode ? String(body.taskCode) : null,
        blocksBilling: Boolean(body.blocksBilling),
        blocksDelivery: Boolean(body.blocksDelivery),
        isCustomerVisible: Boolean(body.isCustomerVisible),
      });
      return NextResponse.json({ ok: true, document: doc });
    }

    if (action === "REVIEW_DOCUMENT") {
      const doc = await reviewDocumentVersion({
        ctx,
        dealId: String(body.dealId || ""),
        documentId: String(body.documentId || ""),
        decision: body.decision,
        justification: body.justification
          ? String(body.justification)
          : undefined,
      });
      return NextResponse.json({ ok: true, document: doc });
    }

    if (action === "FORMAL_APPROVAL") {
      const record = await recordTaskFormalApproval({
        ctx,
        dealId: String(body.dealId || ""),
        taskCode: String(body.taskCode || ""),
        decision: body.decision,
        justification: String(body.justification || ""),
        evidenceDocumentIds: Array.isArray(body.evidenceDocumentIds)
          ? body.evidenceDocumentIds
          : undefined,
      });
      return NextResponse.json({ ok: true, record });
    }

    if (action === "REGISTER_BILLING") {
      const deal = await registerDealBilling({
        ctx,
        dealId: String(body.dealId || ""),
        invoiceNumber: String(body.invoiceNumber || ""),
        notes: body.notes ? String(body.notes) : undefined,
      });
      return NextResponse.json({ ok: true, deal });
    }

    if (action === "AUTHORIZE_RELEASE") {
      const releaseAuth = await authorizeDealRelease({
        ctx,
        dealId: String(body.dealId || ""),
        notes: body.notes ? String(body.notes) : undefined,
        confirmedDeliveryWindow: body.confirmedDeliveryWindow
          ? String(body.confirmedDeliveryWindow)
          : undefined,
        expectedConcurrencyVersion:
          body.expectedConcurrencyVersion !== undefined
            ? Number(body.expectedConcurrencyVersion)
            : undefined,
      });
      return NextResponse.json({ ok: true, releaseAuthorization: releaseAuth });
    }

    if (action === "CONFIRM_DELIVERY") {
      const delivery = await confirmPhysicalDelivery({
        ctx,
        dealId: String(body.dealId || ""),
        confirmedVehicleIdentifier: String(
          body.confirmedVehicleIdentifier || "",
        ),
        recipientName: String(body.recipientName || ""),
        recipientDocument: String(body.recipientDocument || ""),
        deliveryNotes: body.deliveryNotes
          ? String(body.deliveryNotes)
          : undefined,
      });
      return NextResponse.json({ ok: true, delivery });
    }

    if (action === "POST_DELIVERY_ADDENDUM") {
      const delivery = await registerPostDeliveryAddendum({
        ctx,
        dealId: String(body.dealId || ""),
        note: String(body.note || ""),
      });
      return NextResponse.json({ ok: true, delivery });
    }

    if (action === "ASSISTANT_QUESTION") {
      const passport = await getDealPassportView({
        ctx,
        dealId: String(body.dealId || ""),
      });
      const db = await loadDatabaseState();
      const publishedProcedures = db.procedureVersions.filter(
        (pv) =>
          pv.organizationId === ctx.organization.id &&
          pv.status === "PUBLISHED",
      );

      const response = answerContextualQuestion({
        ctx,
        question: String(body.question || ""),
        deal: passport.deal,
        vehicle: passport.vehicle,
        tasks: passport.tasks,
        documents: passport.documents,
        publishedProcedures,
        recentEvents: passport.auditEvents,
        hasActiveReleaseAuthorization: Boolean(
          passport.activeReleaseAuthorization,
        ),
      });

      return NextResponse.json({ ok: true, response });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    if (err instanceof PreconditionBlockedError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          blockers: err.blockers,
        },
        { status: err.statusCode },
      );
    }
    if (err instanceof ConcurrencyConflictError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode },
      );
    }
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
      err instanceof Error ? err.message : "Erro ao processar operação.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
