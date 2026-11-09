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
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-teal-600 flex items-center justify-center text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Recuperação de Senha
            </h1>
            <p className="text-xs text-slate-500">ChaveFlow • Acesso seguro</p>
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
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar para o Login</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Informe o e-mail vinculado ao seu perfil. Enviaremos um link
              temporário de redefinição.
            </p>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-300 p-3 text-xs text-red-900">
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
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com.br"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition"
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
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
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
