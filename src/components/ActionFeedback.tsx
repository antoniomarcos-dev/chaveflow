"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import type { ReactNode } from "react";

type ActionFeedbackType = "success" | "error" | "info";

export function ActionFeedback({
  type,
  children,
  onDismiss,
}: {
  type: ActionFeedbackType;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const styles = {
    success: {
      container: "border-emerald-300 bg-emerald-50 text-emerald-950",
      Icon: CheckCircle2,
    },
    error: {
      container: "border-red-300 bg-red-50 text-red-950",
      Icon: AlertCircle,
    },
    info: {
      container: "border-[#126FB8]/35 bg-[#EAF3FC] text-[#0B3B70]",
      Icon: Info,
    },
  }[type];
  const Icon = styles.Icon;

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      className={`flex items-start gap-3 rounded-xl border p-4 text-xs font-medium shadow-xs ${styles.container}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 underline hover:no-underline focus-visible:outline-2"
          aria-label="Fechar mensagem"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
