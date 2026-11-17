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
import { readJsonBody, strictBoolean, RequestPayloadError } from "@/lib/api-input";
import { ResponsibleAreaSchema } from "@/domain/types";
import { SupabaseInfrastructureError } from "@/infrastructure/supabase";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const procedureInputSchema = z.object({
  procedureId: z.string().trim().min(1).nullish(),
  code: z.string().trim().min(1, "Informe o código do procedimento."),
  title: z.string().trim().min(1, "Informe o título do procedimento."),
  responsibleArea: ResponsibleAreaSchema.default("DOCUMENTATION"),
  content: z.string().trim().min(1, "Informe o escopo do procedimento."),
  sections: z.array(z.object({
    sectionNumber: z.string().trim().min(1, "Informe o número da seção."),
    heading: z.string().trim().min(1, "Informe o título da seção."),
    body: z.string().trim().min(1, "Informe o conteúdo da seção."),
  })).default([]),
  publishImmediately: z.boolean().default(false),
});

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

    const body = await readJsonBody(req);
    const { action } = body;

    if (action === "MARK_NOTIFICATION_READ") {
      await markNotificationAsRead({
        ctx,
        notificationId: body.notificationId
          ? String(body.notificationId)
          : undefined,
        markAll: strictBoolean(body.markAll),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "CREATE_OR_PUBLISH_PROCEDURE") {
      const input = procedureInputSchema.safeParse(body);
      if (!input.success)
        return NextResponse.json(
          { error: input.error.issues[0]?.message ?? "Procedimento inválido." },
          { status: 400 },
        );
      const res = await createOrPublishProcedureVersion({
        ctx,
        ...input.data,
        procedureId: input.data.procedureId ?? undefined,
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
        slaHours: typeof body.slaHours === "number" ? body.slaHours : NaN,
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
    if (err instanceof RequestPayloadError)
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    if (err instanceof SupabaseInfrastructureError)
      return NextResponse.json(
        { error: "Serviço temporariamente indisponível." },
        { status: err.statusCode },
      );
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
