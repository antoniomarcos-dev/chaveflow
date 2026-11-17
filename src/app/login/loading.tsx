import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main
      role="status"
      aria-label="Carregando acesso"
      className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-4"
    >
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Carregando acesso…
      </div>
    </main>
  );
}
