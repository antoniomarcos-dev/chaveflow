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
import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  try {
    assertSameOriginRequest(req);
    const body = await req.json();
    if (["LOGIN", "RECOVER_PASSWORD", "RESET_PASSWORD"].includes(body.action)) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      await enforceRateLimit(`auth:${ip}`, 30);
      if (body.action === "RECOVER_PASSWORD")
        await enforceRateLimit(
          `recover:${String(body.email || "")
            .trim()
            .toLowerCase()}`,
          5,
        );
    }
    if (body.action === "LOGIN") {
      const { context, sessionToken } = await authenticateWithCredentials({
        email: String(body.email || ""),
        password: String(body.password || ""),
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
    if (body.action === "LOGOUT") {
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }
    if (body.action === "RECOVER_PASSWORD") {
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
    if (body.action === "RESET_PASSWORD") {
      await resetPassword(
        String(body.token || ""),
        String(body.password || ""),
      );
      return NextResponse.json({ ok: true });
    }
    if (
      body.action === "CREATE_CUSTOMER_ACCESS" ||
      body.action === "MANAGE_COLLABORATOR"
    ) {
      const ctx = await getServerSessionContext();
      if (!ctx)
        return NextResponse.json(
          { error: "Entre na sua conta para continuar." },
          { status: 401 },
        );
      if (body.action === "CREATE_CUSTOMER_ACCESS") {
        const result = await createCustomerAccountAccess({
          ctx,
          dealId: String(body.dealId || ""),
        });
        return NextResponse.json({ ok: true, ...result });
      }
      if (!["REISSUE", "DISABLE", "ENABLE"].includes(body.accessAction))
        return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
      const result = await manageCollaboratorAccess({
        ctx,
        profileId: String(body.profileId || ""),
        action: body.accessAction,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "INVITE_COLLABORATOR") {
      const ctx = await getServerSessionContext();
      const result = await inviteCollaborator({
        ctx,
        isPublicSelfSignup: Boolean(body.isPublicSelfSignup),
        email: String(body.email || ""),
        fullName: String(body.fullName || ""),
        phone: String(body.phone || ""),
        branchId: String(body.branchId || ""),
        roles: Array.isArray(body.roles) ? body.roles : [],
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
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erro ao processar solicitação.",
      },
      { status: 400 },
    );
  }
}
