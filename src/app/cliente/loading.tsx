import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main
      role="status"
      aria-label="Carregando Portal do Comprador"
      className="min-h-screen bg-[#F4F7FA] px-4 py-6"
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Carregando seu portal…
        </div>
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    </main>
  );
}
