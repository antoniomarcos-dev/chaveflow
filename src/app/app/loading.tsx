import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div role="status" className="space-y-5" aria-label="Carregando página">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando informações…
      </div>
      <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-2xl bg-slate-200"
          />
        ))}
      </div>
    </div>
  );
}
