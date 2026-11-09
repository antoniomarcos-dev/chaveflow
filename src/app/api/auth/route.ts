import { NextRequest, NextResponse } from "next/server";
import {
  authenticateWithCredentials,
  inviteCollaborator,
  SESSION_COOKIE_NAME,
  switchDemoPersona,
} from "@/application/auth-service";
import { getServerSessionContext } from "@/lib/server-session";
import { AuthorizationError } from "@/domain/permissions";
import { resetDemoDatabase } from "@/infrastructure/database";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "LOGIN") {
      const { context, sessionToken } = await authenticateWithCredentials({
        email: String(body.email || ""),
        password: body.password ? String(body.password) : undefined,
      });

      const res = NextResponse.json({
        ok: true,
        profile: {
          id: context.profile.id,
          fullName: context.profile.fullName,
          email: context.profile.email,
          isCustomerOnly: context.profile.isCustomerOnly,
        },
        roles: context.roles,
        redirectTo: context.profile.isCustomerOnly ? "/cliente" : "/app",
      });

      res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });

      return res;
    }

    if (action === "SWITCH_DEMO_PERSONA") {
      const { context, sessionToken } = await switchDemoPersona({
        targetProfileId: String(body.targetProfileId || ""),
      });

      const res = NextResponse.json({
        ok: true,
        profile: {
          id: context.profile.id,
          fullName: context.profile.fullName,
          isCustomerOnly: context.profile.isCustomerOnly,
        },
        roles: context.roles,
        redirectTo: context.profile.isCustomerOnly ? "/cliente" : "/app",
      });

      res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });

      return res;
    }

    if (action === "LOGOUT") {
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    if (action === "RECOVER_PASSWORD") {
      const email = String(body.email || "").trim();
      if (!email || !email.includes("@")) {
        return NextResponse.json(
          { error: "Informe um endereço de e-mail válido." },
          { status: 400 }
        );
      }
      return NextResponse.json({
        ok: true,
        message:
          "Solicitação registrada. Em ambiente demonstrativo sem provedor SMTP externo configurado, nenhum e-mail externo foi disparado — utilize a senha demonstrativa 'chaveflow123' ou o seletor de persona.",
      });
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
        roles: Array.isArray(body.roles) ? body.roles : [],
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "RESET_DEMO_DB") {
      resetDemoDatabase();
      return NextResponse.json({
        ok: true,
        message:
          "Dados demonstrativos da Pinauto BYD Ceres/GO restaurados ao estado inicial do roteiro.",
      });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    const msg = err instanceof Error ? err.message : "Erro interno no servidor.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
