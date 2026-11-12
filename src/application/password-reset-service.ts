import { loadDatabaseState, withTransaction } from "@/infrastructure/database";
import { hashPassword } from "@/lib/passwords";
import crypto from "node:crypto";

export interface PasswordResetTokenInspection {
  status: "VALID" | "EXPIRED" | "INVALID_OR_USED" | "MISSING";
  expiresAtIso: string | null;
}

export async function inspectPasswordResetToken(
  token: string,
): Promise<PasswordResetTokenInspection> {
  const clean = (token || "").trim();
  if (!clean) {
    return { status: "MISSING", expiresAtIso: null };
  }
  const hash = crypto.createHash("sha256").update(clean).digest("hex");
  const db = await loadDatabaseState();
  const record = db.passwordResetTokens?.find((t) => t.hash === hash);
  if (!record) {
    return { status: "INVALID_OR_USED", expiresAtIso: null };
  }
  if (record.expiresAt <= Date.now()) {
    return {
      status: "EXPIRED",
      expiresAtIso: new Date(record.expiresAt).toISOString(),
    };
  }
  return {
    status: "VALID",
    expiresAtIso: new Date(record.expiresAt).toISOString(),
  };
}

export async function sendPasswordReset(email: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CHAVEFLOW_EMAIL_FROM;
  const baseUrl = process.env.CHAVEFLOW_APP_URL;
  if (!apiKey || !from || !baseUrl)
    throw new Error(
      "O envio de e-mail não está configurado. Contate o administrador.",
    );
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const target = await withTransaction((db) => {
    const profile = db.profiles.find(
      (p) => p.email.toLowerCase() === email.trim().toLowerCase() && p.isActive,
    );
    if (!profile) return null;
    db.passwordResetTokens = (db.passwordResetTokens ?? []).filter(
      (t) => t.profileId !== profile.id && t.expiresAt > Date.now(),
    );
    db.passwordResetTokens.push({
      hash,
      profileId: profile.id,
      expiresAt: Date.now() + 3600000,
    });
    return profile.email;
  });
  if (!target) return;
  const url = new URL("/redefinir-senha", baseUrl);
  url.searchParams.set("token", token);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [target],
      subject: "Defina sua senha no ChaveFlow",
      text: `Para definir sua senha, acesse o link abaixo. Ele expira em uma hora e só pode ser usado uma vez.\n\n${url}\n\nSe você não solicitou, ignore esta mensagem.`,
    }),
  });
  if (!response.ok)
    throw new Error(
      "Não foi possível enviar o e-mail. Tente novamente mais tarde.",
    );
}

export async function resetPassword(token: string, password: string) {
  const passwordHash = hashPassword(password);
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  await withTransaction((db) => {
    const record = db.passwordResetTokens?.find(
      (t) => t.hash === hash && t.expiresAt > Date.now(),
    );
    if (!record)
      throw new Error(
        "Link inválido ou expirado. Solicite uma nova recuperação.",
      );
    const profile = db.profiles.find(
      (p) => p.id === record.profileId && p.isActive,
    );
    if (!profile) throw new Error("Conta indisponível.");
    profile.passwordHash = passwordHash;
    profile.passwordChangedAt = new Date().toISOString();
    profile.updatedAt = new Date().toISOString();
    db.passwordResetTokens = db.passwordResetTokens!.filter(
      (t) => t.profileId !== profile.id,
    );
  });
}
