"use client";

import { ArrowLeft, CheckCircle2, KeyRound, Mail } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmittedMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECOVER_PASSWORD",
          email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao solicitar recuperação.");
      } else {
        setSubmittedMessage(data.message);
      }
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B3B70] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-[#0B3B70] flex items-center justify-center text-white">
            <KeyRound className="h-5 w-5 text-[#7CC4FA]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#172B3A]">
              Recuperação de Senha
            </h1>
            <p className="text-xs text-slate-500">
              AUTOFLOW • Pinauto BYD (Ceres/GO)
            </p>
          </div>
        </div>

        {submittedMessage ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-950 flex items-start gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Instruções processadas</p>
                <p className="mt-1 leading-relaxed">{submittedMessage}</p>
              </div>
            </div>
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0B3B70] hover:bg-[#1684D8] px-4 py-2.5 text-xs font-bold text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar para o Login</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Informe o e-mail da sua conta. Se houver um perfil ativo
              correspondente, enviaremos um link temporário de uso único (válido
              por 1 hora) para redefinir sua senha.
            </p>
            <div className="rounded-xl bg-[#EAF3FC] border border-[#1684D8]/25 p-3 text-xs text-[#0B3B70]">
              <strong>Primeiro acesso?</strong> Solicite ao administrador da
              concessionária (ou ao seu vendedor, se for comprador) o link
              individual de ativação da conta (válido por 24 horas).
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg bg-red-50 border border-red-300 p-3 text-xs text-red-900"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="recover-email"
                className="block text-xs font-semibold text-slate-700"
              >
                E-mail cadastrado
              </label>
              <input
                id="recover-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com.br"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-[#172B3A]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-sm font-bold text-white transition"
            >
              <Mail className="h-4 w-4" />
              <span>
                {loading
                  ? "Processando..."
                  : "Enviar instruções de recuperação"}
              </span>
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#172B3A]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Voltar para a tela de login</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
