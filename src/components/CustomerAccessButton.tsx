"use client";

import { KeyRound, UserCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { AccountActivation, ActivationLinkCard } from "./ActivationLinkCard";

export function CustomerAccessButton({
  dealId,
  compact = false,
  isAccountActive = false,
}: {
  dealId: string;
  compact?: boolean;
  isAccountActive?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [access, setAccess] = useState<AccountActivation | null>(null);

  const buttonLabel = loading
    ? "Preparando acesso..."
    : isAccountActive
      ? "Conta ativa — Reemitir link"
      : "Preparar acesso";

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError("");
          try {
            const r = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "CREATE_CUSTOMER_ACCESS",
                dealId,
              }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            setAccess(data);
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Não foi possível preparar o acesso.",
            );
          } finally {
            setLoading(false);
          }
        }}
        className={`inline-flex items-center gap-2 rounded-xl border border-[#1684D8]/30 bg-[#EAF3FC] font-bold text-[#0B3B70] transition hover:bg-[#1684D8] hover:text-white disabled:opacity-50 ${
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
        }`}
      >
        {isAccountActive ? (
          <UserCheck className="h-4 w-4 text-[#1684D8]" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        <span>{buttonLabel}</span>
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-700 font-medium">
          {error}
        </p>
      )}
      {access && (
        <ActivationLinkCard
          key={access.activationPath}
          access={access}
          onClose={() => setAccess(null)}
        />
      )}
    </div>
  );
}
