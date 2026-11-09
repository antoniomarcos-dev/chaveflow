"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  KeyRound,
  Lock,
  LogIn,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { ROLE_LABELS, RoleCode } from "@/domain/types";

interface DemoPersonaItem {
  profileId: string;
  fullName: string;
  email: string;
  roles: RoleCode[];
  isCustomerOnly: boolean;
}

export function LoginFormClient({
  isDemoMode,
  demoPersonas,
  redirectTo,
}: {
  isDemoMode: boolean;
  demoPersonas: DemoPersonaItem[];
  redirectTo?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("vendedor@pinauto.demo");
  const [password, setPassword] = useState("chaveflow123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "LOGIN",
          email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha ao autenticar.");
        return;
      }
      const target =
        redirectTo && redirectTo.startsWith("/")
          ? redirectTo
          : data.redirectTo || "/app";
      router.push(target);
      router.refresh();
    } catch {
      setError("Erro de conexão ao autenticar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickPersonaLogin(profileId: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SWITCH_DEMO_PERSONA",
          targetProfileId: profileId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha ao alternar persona demonstrativa.");
        return;
      }
      const target =
        redirectTo && redirectTo.startsWith("/") && !data.profile.isCustomerOnly
          ? redirectTo
          : data.redirectTo || "/app";
      router.push(target);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-4xl">
        <div className="flex items-center justify-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              ChaveFlow
            </h1>
            <p className="text-xs text-teal-400 font-medium">
              Gestão de Faturamento, Passaporte Digital e Liberação
            </p>
          </div>
        </div>

        <div className="mt-8 grid lg:grid-cols-12 gap-6 items-start">
          {/* Formulário de Login Padrão */}
          <div className="lg:col-span-6 bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900">
              Acessar sua conta
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Autenticação verificada no servidor com controle de organização, unidade e funções.
            </p>

            {redirectTo && (
              <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
                Faça login para continuar para:{" "}
                <strong className="font-mono">{redirectTo}</strong>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-lg bg-red-50 border border-red-300 p-3 text-xs text-red-900 flex items-start gap-2"
              >
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-slate-700"
                >
                  E-mail corporativo ou do cliente
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600"
                  placeholder="seu.nome@concessionaria.com.br"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Senha
                  </label>
                  <Link
                    href="/recuperar-senha"
                    className="text-xs font-semibold text-teal-700 hover:underline"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f172a] hover:bg-slate-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:opacity-50"
              >
                <LogIn className="h-4 w-4 text-teal-400" />
                <span>{loading ? "Autenticando..." : "Entrar no ChaveFlow"}</span>
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-2">
              <Lock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Por política de segurança, o sistema não permite auto-cadastro público com escolha de funções privilegiadas. Novos colaboradores são convidados pelo Administrador da organização.
              </span>
            </div>
          </div>

          {/* Seletor de Personas Demonstrativas (Exclusivo Modo Demo) */}
          {isDemoMode && (
            <div className="lg:col-span-6 bg-slate-800/90 rounded-2xl border border-slate-700 p-6 text-slate-100">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                <ShieldAlert className="h-4 w-4" />
                <span>Modo Demonstrativo — Pinauto BYD Ceres/GO</span>
              </div>
              <h3 className="text-base font-bold text-white mt-1">
                Acesso Rápido por Perfil (Roteiro Demonstrativo)
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Clique em qualquer função abaixo para autenticar imediatamente e testar as permissões e caixas de trabalho daquela área (senha padrão:{" "}
                <code className="bg-slate-900 px-1.5 py-0.5 rounded text-teal-300">
                  chaveflow123
                </code>
                ):
              </p>

              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto pr-1">
                {demoPersonas.map((p) => (
                  <button
                    key={p.profileId}
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickPersonaLogin(p.profileId)}
                    className="w-full text-left rounded-xl bg-slate-900/90 hover:bg-slate-950 border border-slate-700 hover:border-teal-500 p-3 transition flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                        <span className="truncate">{p.fullName}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {p.email}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-teal-950 border border-teal-700/60 px-2 py-1 text-[11px] font-semibold text-teal-300">
                      {p.roles.map((r) => ROLE_LABELS[r]).join(" + ")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
