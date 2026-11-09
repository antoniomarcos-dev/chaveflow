"use client";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { AccountActivation, ActivationLinkCard } from "./ActivationLinkCard";

export function CustomerAccessButton({
  dealId,
  compact = false,
}: {
  dealId: string;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [access, setAccess] = useState<AccountActivation | null>(null);
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
                : "Não foi possível criar o acesso.",
            );
          } finally {
            setLoading(false);
          }
        }}
        className={`inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 font-semibold text-teal-800 transition hover:bg-teal-100 disabled:opacity-50 ${compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"}`}
      >
        <UserPlus className="h-4 w-4" />
        {loading ? "Preparando acesso…" : "Criar acesso do cliente"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
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
