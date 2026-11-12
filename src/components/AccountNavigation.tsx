"use client";
import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountNavigation({
  signedIn = false,
}: {
  signedIn?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#1684D8]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Início
      </Link>
      {signedIn ? (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "LOGOUT" }),
              });
              if (!r.ok) throw Error();
              router.push("/");
              router.refresh();
            } catch {
              setError("Tente sair novamente.");
              setBusy(false);
            }
          }}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#1684D8]"
        >
          <LogOut className="h-3.5 w-3.5" />
          {busy ? "Saindo…" : "Sair da conta"}
        </button>
      ) : (
        <Link
          href="/login?area=cliente"
          className="rounded-lg bg-[#EAF3FC] border border-[#1684D8]/30 px-3 py-2 text-[#0B3B70] font-bold hover:bg-[#1684D8] hover:text-white transition"
        >
          Entrar na minha conta
        </Link>
      )}
      {error && (
        <span role="alert" className="text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
