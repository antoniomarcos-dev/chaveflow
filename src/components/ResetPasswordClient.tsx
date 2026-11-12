"use client";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function ResetPasswordClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  return (
    <main className="min-h-screen bg-[#f6f8fa] flex items-center justify-center p-6">
      <form
        className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 shadow-xl shadow-slate-900/5 space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password !== confirmation) {
            setMessage("As senhas devem ser iguais.");
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
            if (!response.ok) throw new Error(data.error);
            setDone(true);
            setMessage("Senha definida com sucesso.");
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Falha de conexão.",
            );
          } finally {
            setLoading(false);
          }
        }}
      >
        <Link
          href="/"
          className="mb-7 flex items-center gap-3 text-xl font-extrabold tracking-tight text-[#0B3B70]"
        >
          <span className="rounded-xl bg-[#0B3B70] p-2.5 text-white">
            <KeyRound className="h-5 w-5 text-[#7CC4FA]" />
          </span>
          <span>
            <span className="text-[#1684D8] mr-1">//</span>AUTOFLOW
          </span>
        </Link>
        <div>
          <span className="eyebrow">Seu acesso é individual</span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#172B3A]">
            Vamos preparar sua conta.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Defina uma senha para entrar e acompanhar seus próximos passos.
          </p>
        </div>
        {message && <p role="status">{message}</p>}
        {!done && (
          <>
            <label className="block text-sm font-semibold text-slate-700">
              Nova senha
              <input
                autoComplete="new-password"
                required
                type="password"
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block border border-slate-300 rounded-xl p-3 w-full text-sm text-[#172B3A]"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Confirme a senha
              <input
                autoComplete="new-password"
                required
                type="password"
                minLength={12}
                maxLength={128}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="mt-1 block border border-slate-300 rounded-xl p-3 w-full text-sm text-[#172B3A]"
              />
            </label>
            <p className="text-xs text-slate-500">
              Use entre 12 e 128 caracteres.
            </p>
            <button
              disabled={loading || !token}
              className="bg-[#1684D8] hover:bg-[#126FB8] text-white font-bold rounded-xl p-3 w-full disabled:opacity-40 transition"
            >
              {loading ? "Salvando…" : "Salvar senha"}
            </button>
          </>
        )}
        <Link href="/login" className="block text-sm font-semibold text-[#1684D8] hover:underline">
          Voltar para o login
        </Link>
      </form>
    </main>
  );
}
