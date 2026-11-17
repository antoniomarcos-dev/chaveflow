"use client";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { demoCredentials } from "@/lib/demo-credentials";
import { sectionHref } from "@/lib/navigation";

export function LoginFormClient({
  redirectTo,
  area,
  authenticatedDashboardUrl,
  authenticatedUserName,
  showDemoCredentials,
  showOverview = false,
}: {
  redirectTo?: string;
  area?: string;
  authenticatedDashboardUrl?: string | null;
  authenticatedUserName?: string | null;
  showDemoCredentials?: boolean;
  showOverview?: boolean;
}) {
  const router = useRouter();
  const submitButton = useRef<HTMLButtonElement>(null);
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
      const destination = data.redirectTo === "/cliente" ? "/cliente" : "/app";
      router.push(sectionHref(redirectTo, destination) ?? destination);
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
              <span className="text-[#126FB8] mr-1">//</span>AUTO
              <span className="text-[#126FB8]">FLOW</span>
            </span>
            <span className="block text-[11px] font-medium text-slate-600">
              Sua operação conectada do início ao fim.
            </span>
          </div>
        </Link>
        <span className="inline-flex items-center rounded-lg bg-[#EAF3FC] border border-[#126FB8]/30 px-3 py-1 text-xs font-bold text-[#0B3B70]">
          Pinauto BYD — Ceres/GO
        </span>
      </header>

      <section className={`mx-auto my-6 w-full ${showOverview ? "max-w-4xl lg:grid lg:grid-cols-2 lg:items-start lg:gap-6" : "max-w-md"}`}>
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
            <div className="mt-4 rounded-xl border border-[#126FB8]/30 bg-[#EAF3FC] p-3.5 flex items-center justify-between gap-3">
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
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#0B3B70] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#0B3B70] transition"
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
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@pinauto.com.br"
                className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-[#172B3A] focus:border-[#126FB8]"
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
                {!showDemoCredentials && (
                  <Link
                    href="/recuperar-senha"
                    className="text-xs font-semibold text-[#0B3B70] hover:text-[#126FB8] hover:underline"
                  >
                    Recuperar senha
                  </Link>
                )}
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
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 pr-24 text-sm text-[#172B3A] focus:border-[#126FB8]"
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
              ref={submitButton}
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#126FB8] px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0B3B70] disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>{loading ? "Entrando no sistema…" : "Entrar"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {showDemoCredentials && (
            <section
              aria-labelledby="demo-credentials-title"
              className="mt-5 rounded-xl border border-[#126FB8]/25 bg-[#EAF3FC] p-4"
            >
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#126FB8]" />
                <div className="min-w-0">
                  <h2
                    id="demo-credentials-title"
                    className="text-xs font-extrabold uppercase tracking-wide text-[#0B3B70]"
                  >
                    Credenciais para avaliação da banca
                  </h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                    Escolha um perfil e depois selecione Entrar.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {demoCredentials.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    aria-pressed={email === account.email && password === account.password}
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      setError(null);
                      submitButton.current?.focus();
                    }}
                    className="rounded-lg border border-white/80 bg-white/80 px-3 py-2.5 text-left hover:border-[#126FB8] focus-visible:outline-2 focus-visible:outline-[#126FB8]"
                  >
                    <p className="text-[11px] font-bold text-[#172B3A]">{account.label}</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-[#0B3B70]">
                      {account.email}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      Senha:{" "}
                      <span className="font-mono font-semibold text-[#172B3A]">
                        {account.password}
                      </span>
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

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

        <details open={showOverview || undefined} className={`group mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 ${showOverview ? "lg:mt-0 lg:p-6" : ""}`}>
          <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 font-semibold text-[#0B3B70]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#126FB8]" />
              Sobre o funcionamento do AUTOFLOW
            </span>
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 leading-relaxed">
            <p>
              Cada negociação tem um <strong>Passaporte Digital</strong> com
              tarefas, documentos e aprovações, da venda à entrega. A equipe
              acompanha o faturamento, a inspeção pré-entrega (PDI) e as
              pendências que precisam ser resolvidas antes da liberação.
            </p>
            <p>
              <strong>Equipe interna.</strong> Consulte sua fila de trabalho e
              leia a etiqueta QR do veículo para localizar o cadastro no pátio.
            </p>
            <p>
              <strong>Comprador.</strong> Acompanhe a compra e envie os
              documentos solicitados pelo portal, usando sua conta ou o
              convite individual fornecido pelo vendedor.
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
