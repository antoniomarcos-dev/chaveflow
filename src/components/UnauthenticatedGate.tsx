"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { KeyRound, Lock, LogIn, UserCheck } from "lucide-react";
import { ROLE_LABELS, RoleCode } from "@/domain/types";

export function UnauthenticatedGate({
  isDemoMode,
  demoPersonas,
}: {
  isDemoMode: boolean;
  demoPersonas: Array<{
    profileId: string;
    fullName: string;
    email: string;
    roles: RoleCode[];
    isCustomerOnly: boolean;
  }>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function quickEnter(profileId: string) {
    setLoading(true);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SWITCH_DEMO_PERSONA",
          targetProfileId: profileId,
        }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-lg w-full rounded-2xl bg-white text-slate-900 shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-600 flex items-center justify-center text-white">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Autenticação Necessária
            </h1>
            <p className="text-xs text-slate-500">
              Esta área operacional da ChaveFlow requer sessão autenticada.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <Link
            href={`/login?redirect=${encodeURIComponent(pathname || "/app")}`}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f172a] hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-white transition"
          >
            <LogIn className="h-4 w-4 text-teal-400" />
            <span>Ir para Tela de Login</span>
          </Link>
        </div>

        {isDemoMode && (
          <div className="pt-4 border-t border-slate-200 space-y-2.5">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-teal-600" />
              <span>Atalho do Ambiente Demonstrativo (Pinauto BYD Ceres/GO):</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {demoPersonas
                .filter((p) => !p.isCustomerOnly)
                .map((p) => (
                  <button
                    key={p.profileId}
                    type="button"
                    disabled={loading}
                    onClick={() => quickEnter(p.profileId)}
                    className="w-full text-left rounded-lg border border-slate-200 hover:border-teal-600 hover:bg-teal-50/40 p-2.5 transition flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-teal-600" />
                      {p.fullName}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {p.roles.map((r) => ROLE_LABELS[r]).join(", ")}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
