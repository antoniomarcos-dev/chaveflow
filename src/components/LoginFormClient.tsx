"use client";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginFormClient({
  redirectTo,
  area,
}: {
  redirectTo?: string;
  area?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [visible, setVisible] = useState(false);
  const areaLabel =
    area === "admin"
      ? "Administração"
      : area === "vendedor"
        ? "Equipe de vendas"
        : area === "cliente"
          ? "Área do cliente"
          : "Seu espaço no AUTOFLOW";
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
      if (!res.ok || !data.ok)
        throw new Error(data.error || "Não foi possível entrar.");
      const target =
        redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : data.redirectTo || "/app";
      router.push(target);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Verifique sua conexão e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#F4F7FA] lg:grid lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#0B3B70] p-12 text-white lg:flex lg:flex-col xl:p-16">
        <div className="absolute -bottom-32 -right-32 h-[32rem] w-[32rem] rounded-full border-[70px] border-[#1684D8]/15" />
        <div className="relative flex items-center justify-between gap-4">
          <Link href="/" className="flex w-fit items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1684D8] text-white">
              <KeyRound className="h-6 w-6" />
            </span>
            <div>
              <span className="text-2xl font-extrabold tracking-tight block">
                <span className="text-[#7CC4FA] mr-1">//</span>AUTOFLOW
              </span>
              <span className="text-[11px] text-blue-200 block">
                Sua operação conectada do início ao fim.
              </span>
            </div>
          </Link>
        </div>
        <div className="relative my-auto max-w-lg py-16">
          <span className="inline-flex items-center rounded-lg bg-white/10 border border-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#7CC4FA]">
            Unidade: Pinauto BYD · Ceres/GO
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-[1.12] tracking-tight xl:text-6xl">
            Sua operação
            <br />
            conectada
            <br />
            <span className="text-[#7CC4FA]">do início ao fim.</span>
          </h1>
          <p className="mt-7 max-w-sm text-base leading-relaxed text-blue-100/90">
            Acesse o Passaporte Digital das negociações, conferências, faturamento e liberações.
          </p>
          <div className="mt-10 space-y-4">
            {[
              "Equipe conectada e acessos individuais por função",
              "Negociações, documentos e aprovações em um só lugar",
              "Liberação condicionada aos requisitos obrigatórios",
            ].map((text) => (
              <p
                key={text}
                className="flex items-center gap-3 text-sm text-blue-100"
              >
                <span className="rounded-full bg-[#1684D8]/30 p-1">
                  <Check className="h-3.5 w-3.5 text-[#7CC4FA]" />
                </span>
                {text}
              </p>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-blue-200/70">
          AUTOFLOW · Plataforma Operacional — Pinauto BYD (Ceres/GO)
        </p>
      </section>
      <section className="flex min-h-screen flex-col px-6 py-7 sm:px-12">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#1684D8]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>
        <div className="mx-auto my-auto w-full max-w-md py-12">
          <Link href="/" className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="rounded-xl bg-[#0B3B70] p-2.5 text-white">
              <KeyRound className="h-6 w-6 text-[#7CC4FA]" />
            </span>
            <div>
              <span className="text-xl font-extrabold text-[#0B3B70] block">
                <span className="text-[#1684D8] mr-1">//</span>AUTOFLOW
              </span>
              <span className="text-[10px] text-slate-500 block">
                Pinauto BYD — Ceres/GO
              </span>
            </div>
          </Link>
          <span className="eyebrow">{areaLabel}</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#172B3A]">
            Bom ter você por aqui.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Entre com seu e-mail e senha para acessar sua conta.
          </p>
          {error && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="text-sm font-semibold text-slate-700"
              >
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com.br"
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-[#172B3A] outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="login-password"
                  className="text-sm font-semibold text-slate-700"
                >
                  Senha
                </label>
                <Link
                  href="/recuperar-senha"
                  className="text-xs font-semibold text-[#1684D8] hover:underline"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative mt-2">
                <input
                  id="login-password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha de acesso"
                  className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 pr-12 text-sm text-[#172B3A] outline-none"
                />
                <button
                  type="button"
                  aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setVisible((v) => !v)}
                  className="absolute right-3 top-3.5 p-0.5 text-slate-400 hover:text-slate-700"
                >
                  {visible ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            <button
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1684D8] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#1684D8]/15 transition hover:bg-[#126FB8] disabled:opacity-50"
            >
              {loading ? "Entrando…" : "Entrar no AUTOFLOW"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <div className="mt-7 border-t border-slate-200 pt-6">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1684D8]" />
              Primeiro acesso? Use o link enviado pelo administrador ou pelo seu
              vendedor para definir sua senha.
            </p>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400">
          AUTOFLOW · Unidade: Pinauto BYD — Ceres/GO
        </p>
      </section>
    </main>
  );
}
