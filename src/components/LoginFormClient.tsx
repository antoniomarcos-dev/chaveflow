"use client";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginFormClient({
  redirectTo,
  area,
  authenticatedDashboardUrl,
  authenticatedUserName,
}: {
  redirectTo?: string;
  area?: string;
  authenticatedDashboardUrl?: string | null;
  authenticatedUserName?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  const areaLabel =
    area === "admin"
      ? "Administração"
      : area === "vendedor"
        ? "Equipe de vendas"
        : area === "cliente"
          ? "Portal do comprador"
          : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "LOGIN", email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Não foi possível entrar.");
      }
      const safeRedirect =
        redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : null;
      const target =
        data.redirectTo === "/cliente"
          ? safeRedirect && safeRedirect.startsWith("/cliente")
            ? safeRedirect
            : "/cliente"
          : safeRedirect || data.redirectTo || "/app";
      router.push(target);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Verifique sua conexão e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#172B3A] flex flex-col justify-between p-4 sm:p-8">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="AUTOFLOW — Início"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3B70] text-white shadow-sm">
            <KeyRound className="h-5 w-5 text-[#7CC4FA]" />
          </span>
          <div>
            <span className="block text-lg font-extrabold tracking-tight text-[#0B3B70]">
              <span className="text-[#1684D8] mr-1">//</span>AUTO
              <span className="text-[#1684D8]">FLOW</span>
            </span>
            <span className="block text-[11px] font-medium text-slate-600">
              Sua operação conectada do início ao fim.
            </span>
          </div>
        </Link>
        <span className="inline-flex items-center rounded-lg bg-[#EAF3FC] border border-[#1684D8]/30 px-3 py-1 text-xs font-bold text-[#0B3B70]">
          Pinauto BYD — Ceres/GO
        </span>
      </header>

      <section className="mx-auto my-6 w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          {areaLabel && (
            <span className="inline-block rounded-md bg-[#EAF3FC] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0B3B70] mb-2">
              {areaLabel}
            </span>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-[#172B3A]">
            Acessar o AUTOFLOW
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Organização do faturamento, conferência e liberação de veículos por
            Passaporte Digital.
          </p>

          {authenticatedDashboardUrl && (
            <div className="mt-4 rounded-xl border border-[#1684D8]/30 bg-[#EAF3FC] p-3.5 flex items-center justify-between gap-3">
              <div className="text-xs text-[#0B3B70]">
                <p className="font-bold">Sessão ativa localizada</p>
                {authenticatedUserName && (
                  <p className="mt-0.5 text-slate-700">
                    Conectado como {authenticatedUserName}
                  </p>
                )}
              </div>
              <Link
                href={authenticatedDashboardUrl}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#0B3B70] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1684D8] transition"
              >
                Continuar
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {redirectTo && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              Faça login para continuar para a página solicitada.
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-bold text-[#172B3A]"
              >
                E-mail
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@pinauto.com.br"
                className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-[#172B3A] focus:border-[#1684D8]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold text-[#172B3A]"
                >
                  Senha
                </label>
                <Link
                  href="/recuperar-senha"
                  className="text-xs font-semibold text-[#0B3B70] hover:text-[#1684D8] hover:underline"
                >
                  Recuperar senha
                </Link>
              </div>
              <div className="relative mt-1.5">
                <input
                  id="login-password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 pr-24 text-sm text-[#172B3A] focus:border-[#1684D8]"
                />
                <button
                  type="button"
                  aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setVisible((v) => !v)}
                  className="absolute right-2.5 top-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-[#172B3A]"
                >
                  {visible ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Ocultar</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Mostrar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1684D8] px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0B3B70] disabled:opacity-50"
            >
              <span>{loading ? "Entrando no sistema…" : "Entrar"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-4 space-y-2">
            <div className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0B3B70]" />
              <p>
                <strong className="text-[#172B3A]">Primeiro acesso:</strong>{" "}
                utilize o link individual enviado pelo administrador (equipe) ou
                pelo seu vendedor (comprador) para criar sua senha.
              </p>
            </div>
          </div>
        </div>

        <details className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-[#0B3B70]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#1684D8]" />
              Sobre o funcionamento do AUTOFLOW
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </summary>
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 leading-relaxed">
            <p>
              O <strong>AUTOFLOW</strong> conecta vendas, documentação,
              financeiro, faturamento, preparação física (PDI), liberação e
              entrega em um único Passaporte Digital por veículo.
            </p>
            <p>
              <strong>Equipe interna:</strong> acesse pelo seu e-mail corporativo
              para visualizar sua fila de trabalho ou escanear o QR Code do
              veículo no pátio.
            </p>
            <p>
              <strong>Comprador:</strong> acompanhe as etapas da compra e envie
              documentos solicitados pelo link individual ou conta ativada pelo
              vendedor.
            </p>
          </div>
        </details>
      </section>

      <footer className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-2 border-t border-slate-200/80 pt-4 text-xs text-slate-500 sm:flex-row">
        <p>AUTOFLOW — Sua operação conectada do início ao fim.</p>
        <p>Unidade Piloto: Pinauto BYD — Ceres/GO</p>
      </footer>
    </main>
  );
}
