import {
  createCustomerAccountAccess,
  manageCollaboratorAccess,
} from "@/application/account-access-service";
import {
  authenticateWithCredentials,
  inviteCollaborator,
  SESSION_COOKIE_NAME,
} from "@/application/auth-service";
import {
  resetPassword,
  sendPasswordReset,
} from "@/application/password-reset-service";
import { AuthorizationError } from "@/domain/permissions";
import {
  assertSameOriginRequest,
  enforceRateLimit,
} from "@/lib/request-security";
import { getServerSessionContext } from "@/lib/server-session";
import { parseLiteral, readJsonBody, RequestPayloadError } from "@/lib/api-input";
import { CUSTOMER_ACCESS_COOKIE } from "@/lib/customer-access";
import { getDemoOrigin } from "@/lib/demo-request";
import { SupabaseInfrastructureError } from "@/infrastructure/supabase";
import { RoleCodeSchema } from "@/domain/types";
import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  try {
    assertSameOriginRequest(req);
    const body = await readJsonBody<Record<string, unknown>>(req);
    const action = typeof body.action === "string" ? body.action : "";
    const inDemo = Boolean(await getDemoOrigin());
    if (inDemo && action === "RECOVER_PASSWORD")
      return NextResponse.json(
        { error: "Use as credenciais de demonstração exibidas na página de acesso." },
        { status: 403 },
      );
    if (["LOGIN", "RECOVER_PASSWORD", "RESET_PASSWORD"].includes(action)) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      await enforceRateLimit(`auth:${ip}`, 30);
      if (action === "LOGIN") {
        await enforceRateLimit(
          `login:${inDemo ? `${ip}:` : ""}${String(body.email || "").trim().toLowerCase()}`,
          10,
        );
      }
      if (action === "RECOVER_PASSWORD")
        await enforceRateLimit(
          `recover:${String(body.email || "")
            .trim()
            .toLowerCase()}`,
          5,
        );
    }
    if (action === "LOGIN") {
      const { context, sessionToken } = await authenticateWithCredentials({
        email: String(body.email || ""),
        password: String(body.password || ""),
        inDemo,
      });
      const res = NextResponse.json({
        ok: true,
        redirectTo: context.profile.isCustomerOnly ? "/cliente" : "/app",
      });
      res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 86400,
      });
      return res;
    }
    if (action === "LOGOUT") {
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(SESSION_COOKIE_NAME);
      res.cookies.delete(CUSTOMER_ACCESS_COOKIE);
      return res;
    }
    if (action === "RECOVER_PASSWORD") {
      const email = String(body.email || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return NextResponse.json(
          { error: "Informe um e-mail válido." },
          { status: 400 },
        );
      await sendPasswordReset(email);
      return NextResponse.json({
        ok: true,
        message:
          "Se o e-mail estiver cadastrado, você receberá um link para definir sua senha.",
      });
    }
    if (action === "RESET_PASSWORD") {
      await resetPassword(
        String(body.token || ""),
        String(body.password || ""),
      );
      return NextResponse.json({ ok: true });
    }
    if (
      action === "CREATE_CUSTOMER_ACCESS" ||
      action === "MANAGE_COLLABORATOR"
    ) {
      const ctx = await getServerSessionContext();
      if (!ctx)
        return NextResponse.json(
          { error: "Entre na sua conta para continuar." },
          { status: 401 },
        );
      if (action === "CREATE_CUSTOMER_ACCESS") {
        const result = await createCustomerAccountAccess({
          ctx,
          dealId: String(body.dealId || ""),
        });
        return NextResponse.json({ ok: true, ...result });
      }
      const accessAction = parseLiteral(
        body.accessAction,
        ["REISSUE", "DISABLE", "ENABLE"] as const,
        "Ação inválida.",
      );
      const result = await manageCollaboratorAccess({
        ctx,
        profileId: String(body.profileId || ""),
        action: accessAction,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === "INVITE_COLLABORATOR") {
      const ctx = await getServerSessionContext();
      const result = await inviteCollaborator({
        ctx,
        isPublicSelfSignup: Boolean(body.isPublicSelfSignup),
        email: String(body.email || ""),
        fullName: String(body.fullName || ""),
        phone: String(body.phone || ""),
        branchId: String(body.branchId || ""),
        roles: Array.isArray(body.roles)
          ? body.roles.map((role) => RoleCodeSchema.parse(role))
          : [],
      });
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthorizationError)
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      );
    if (err instanceof RequestPayloadError)
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    if (err instanceof SupabaseInfrastructureError)
      return NextResponse.json(
        { error: "Serviço temporariamente indisponível." },
        { status: err.statusCode },
      );
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erro ao processar solicitação.",
      },
      { status: 400 },
    );
  }
}
