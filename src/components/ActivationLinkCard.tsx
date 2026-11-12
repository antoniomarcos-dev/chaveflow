"use client";
import { Check, Copy, KeyRound, X } from "lucide-react";
import { useState } from "react";

export interface AccountActivation {
  activationPath: string;
  email: string;
  fullName: string;
}
export function ActivationLinkCard({
  access,
  onClose,
}: {
  access: AccountActivation;
  onClose?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const url =
    typeof window !== "undefined"
      ? new URL(access.activationPath, window.location.origin).href
      : access.activationPath;
  return (
    <section
      className="rounded-2xl border border-[#1684D8]/30 bg-[#EAF3FC] p-5 space-y-3"
      aria-label="Link de ativação de acesso"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#0B3B70] p-2.5 text-white">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-[#172B3A]">
            Acesso preparado para {access.fullName}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Login: <strong>{access.email}</strong>. Envie o link abaixo para a
            pessoa definir a própria senha.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar link de acesso"
            className="p-1 text-slate-500 hover:text-[#172B3A]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          aria-label="Link individual para definir senha"
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded-xl border border-[#1684D8]/30 bg-white px-3 py-2.5 text-sm text-[#172B3A]"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              setFallback(true);
            }
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-sm font-bold text-white transition"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Link copiado" : "Copiar link"}
        </button>
      </div>
      <p className="text-xs text-[#0B3B70]" role="status">
        {fallback
          ? "Selecione o link no campo acima e copie manualmente."
          : "Válido por 24 horas, com uso único. Gerar outro link invalida o anterior. Compartilhe apenas com o titular."}
      </p>
    </section>
  );
}
