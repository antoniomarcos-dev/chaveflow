"use client";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function ResetPasswordClient({
  token,
  initialTokenStatus = token ? "VALID" : "MISSING",
  expiresAtIso = null,
}: {
  token: string;
  initialTokenStatus?: "VALID" | "EXPIRED" | "INVALID_OR_USED" | "MISSING";
  expiresAtIso?: string | null;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenStatus, setTokenStatus] = useState(initialTokenStatus);

  const formattedExpiry = expiresAtIso
    ? new Date(expiresAtIso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <main className="min-h-screen bg-[#F4F7FA] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/login"
            className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-[#0B3B70]"
          >
            <span className="rounded-xl bg-[#0B3B70] p-2 text-white">
              <KeyRound className="h-5 w-5 text-[#7CC4FA]" />
            </span>
            <span>
              <span className="text-[#1684D8] mr-1">//</span>AUTOFLOW
            </span>
          </Link>
          <span className="rounded-md bg-[#EAF3FC] px-2.5 py-1 text-[11px] font-semibold text-[#0B3B70]">
            Pinauto BYD · Ceres/GO
          </span>
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#172B3A]">
            Definir senha de acesso
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Crie sua senha pessoal para acessar o AUTOFLOW. Este link é de uso
            único.
          </p>
        </div>

        {tokenStatus === "VALID" && !done && (
          <div className="flex items-start gap-2.5 rounded-xl border border-[#1684D8]/30 bg-[#EAF3FC] p-3 text-xs text-[#0B3B70]">
            <Clock className="h-4 w-4 shrink-0 mt-0.5 text-[#1684D8]" />
            <div>
              <p className="font-semibold">Link ativo e válido para uso único</p>
              <p className="mt-0.5 text-slate-700">
                {formattedExpiry
                  ? `Válido até ${formattedExpiry}. Após salvar sua senha, este link será desativado automaticamente.`
                  : "Links de recuperação valem por 1 hora e links de primeiro acesso por 24 horas."}
              </p>
            </div>
          </div>
        )}

        {tokenStatus !== "VALID" && !done && (
          <div
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 space-y-2"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {tokenStatus === "EXPIRED"
                    ? "Link de acesso expirado"
                    : tokenStatus === "MISSING"
                      ? "Link incompleto"
                      : "Link inválido ou já utilizado"}
                </p>
                <p className="mt-1 leading-relaxed">
                  {tokenStatus === "EXPIRED"
                    ? "O prazo de validade deste link terminou. Solicite uma nova recuperação de senha ou peça ao administrador/vendedor a emissão de um novo link."
                    : tokenStatus === "MISSING"
                      ? "Nenhum código de validação foi encontrado no endereço. Abra o link completo recebido ou solicite a recuperação de senha."
                      : "Cada link de ativação ou redefinição funciona apenas uma vez. Se você já cadastrou sua senha, basta entrar no sistema; caso contrário, solicite um novo link."}
                </p>
              </div>
            </div>
            <div className="pt-2 flex flex-wrap gap-2">
              <Link
                href="/recuperar-senha"
                className="inline-flex items-center justify-center rounded-lg bg-[#0B3B70] px-3 py-2 text-xs font-bold text-white hover:bg-[#1684D8] transition"
              >
                Solicitar novo link
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#172B3A] hover:bg-slate-50 transition"
              >
                Ir para o login
              </Link>
            </div>
          </div>
        )}

        {message && (
          <div
            role={done ? "status" : "alert"}
            className={`flex items-start gap-2 rounded-xl border p-3.5 text-xs ${
              done
                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <span>{message}</span>
          </div>
        )}

        {!done && tokenStatus === "VALID" && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (password !== confirmation) {
                setMessage("As senhas digitadas devem ser iguais.");
                return;
              }
              setLoading(true);
              setMessage("");
              try {
                const response = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "RESET_PASSWORD",
                    token,
                    password,
                  }),
                });
                const data = await response.json();
                if (!response.ok) {
                  if (
                    data.error &&
                    /inválido|expirado/i.test(String(data.error))
                  ) {
                    setTokenStatus("INVALID_OR_USED");
                  }
                  throw new Error(data.error || "Não foi possível salvar a senha.");
                }
                setDone(true);
                setMessage(
                  "Senha definida com sucesso. Você já pode entrar com seu e-mail e nova senha.",
                );
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Falha de conexão.",
                );
              } finally {
                setLoading(false);
              }
            }}
          >
            <div>
              <label
                htmlFor="reset-new-password"
                className="block text-xs font-semibold text-slate-700"
              >
                Nova senha
              </label>
              <div className="relative mt-1">
                <input
                  id="reset-new-password"
                  autoComplete="new-password"
                  required
                  type={showPassword ? "text" : "password"}
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo de 12 caracteres"
                  className="block border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 w-full text-sm text-[#172B3A]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-[#172B3A]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="reset-confirm-password"
                className="block text-xs font-semibold text-slate-700"
              >
                Confirme a nova senha
              </label>
              <input
                id="reset-confirm-password"
                autoComplete="new-password"
                required
                type={showPassword ? "text" : "password"}
                minLength={12}
                maxLength={128}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="Repita a nova senha"
                className="mt-1 block border border-slate-300 rounded-xl px-3.5 py-2.5 w-full text-sm text-[#172B3A]"
              />
            </div>

            <p className="text-xs text-slate-600">
              Requisito de segurança: utilize entre 12 e 128 caracteres.
            </p>

            <button
              type="submit"
              disabled={loading || !token}
              className="bg-[#1684D8] hover:bg-[#126FB8] text-white text-sm font-bold rounded-xl py-3 px-4 w-full disabled:opacity-40 transition"
            >
              {loading ? "Salvando senha…" : "Salvar senha e ativar acesso"}
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-semibold text-[#0B3B70] hover:text-[#1684D8]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para o login
          </Link>
          {done && (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-[#0B3B70] px-3.5 py-2 font-bold text-white hover:bg-[#1684D8]"
            >
              Entrar agora
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
