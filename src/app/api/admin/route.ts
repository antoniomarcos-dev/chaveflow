import { revokeCustomerAccessGrant } from "@/application/customer-portal-service";
import {
  createOrPublishProcedureVersion,
  markNotificationAsRead,
  publishExistingDraftProcedureVersion,
  updateTaskTemplateSlaAndDefaultAssignee,
} from "@/application/report-and-admin-service";
import { AuthorizationError } from "@/domain/permissions";
import { assertSameOriginRequest } from "@/lib/request-security";
import { getServerSessionContext } from "@/lib/server-session";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    assertSameOriginRequest(req);
    const ctx = await getServerSessionContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Autenticação obrigatória." },
        { status: 401 },
      );
    }

    const body = await req.json();
    const action = body.action as string;

    if (action === "MARK_NOTIFICATION_READ") {
      await markNotificationAsRead({
        ctx,
        notificationId: body.notificationId
          ? String(body.notificationId)
          : undefined,
        markAll: Boolean(body.markAll),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "CREATE_OR_PUBLISH_PROCEDURE") {
      const res = await createOrPublishProcedureVersion({
        ctx,
        procedureId: body.procedureId ? String(body.procedureId) : undefined,
        code: String(body.code || ""),
        title: String(body.title || ""),
        responsibleArea: body.responsibleArea || "DOCUMENTATION",
        content: String(body.content || ""),
        sections: Array.isArray(body.sections) ? body.sections : [],
        publishImmediately: Boolean(body.publishImmediately),
      });
      return NextResponse.json({ ok: true, ...res });
    }

    if (action === "PUBLISH_DRAFT_PROCEDURE") {
      const ver = await publishExistingDraftProcedureVersion({
        ctx,
        versionId: String(body.versionId || ""),
      });
      return NextResponse.json({ ok: true, version: ver });
    }

    if (action === "UPDATE_SLA") {
      const tpl = await updateTaskTemplateSlaAndDefaultAssignee({
        ctx,
        taskTemplateId: String(body.taskTemplateId || ""),
        slaHours: Number(body.slaHours),
        defaultAssigneeId: body.defaultAssigneeId
          ? String(body.defaultAssigneeId)
          : null,
      });
      return NextResponse.json({ ok: true, template: tpl });
    }

    if (action === "REVOKE_CUSTOMER_GRANT") {
      await revokeCustomerAccessGrant({
        ctx,
        dealId: String(body.dealId || ""),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode },
      );
    }
    const msg =
      err instanceof Error ? err.message : "Erro ao processar administração.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
