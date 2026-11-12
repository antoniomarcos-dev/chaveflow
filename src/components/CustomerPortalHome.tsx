import { ArrowRight, Car, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AccountNavigation } from "./AccountNavigation";

export function CustomerPortalHome({
  name,
  deals,
}: {
  name?: string;
  deals: Array<{
    dealId: string;
    dealNumber: string;
    vehicleLabel: string;
    statusLabel: string;
  }>;
}) {
  return (
    <div className="min-h-screen bg-[#F4F7FA] text-[#172B3A]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="rounded-xl bg-[#0B3B70] p-2.5 text-white">
                <KeyRound className="h-5 w-5 text-[#7CC4FA]" />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-[#0B3B70]">
                <span className="text-[#1684D8] mr-1">//</span>AUTOFLOW
                <span className="block text-[10px] font-semibold uppercase tracking-[.15em] text-slate-400">
                  Portal do Cliente
                </span>
              </span>
            </Link>
            <span className="hidden sm:inline-flex items-center rounded-lg bg-[#EAF3FC] border border-[#1684D8]/30 px-2.5 py-1 text-[11px] font-bold text-[#0B3B70]">
              Unidade: Pinauto BYD · Ceres/GO
            </span>
          </div>
          <AccountNavigation signedIn={!!name} />
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-7 px-5 py-9 sm:py-12">
        <section className="relative overflow-hidden rounded-3xl bg-[#0B3B70] p-7 text-white sm:p-10">
          <span className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#7CC4FA]">
            Sua operação conectada do início ao fim
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {name
              ? `Olá, ${name.split(" ")[0]}.`
              : "Acompanhe a entrega do seu veículo."}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-blue-100">
            {name
              ? "Confira o andamento autorizado da sua compra, envie os documentos solicitados e veja as orientações da nossa equipe."
              : "Entre com o acesso individual criado pelo seu consultor comercial para acompanhar sua compra com tranquilidade."}
          </p>
          {!name && (
            <Link
              href="/login?area=cliente"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-5 py-3 text-sm font-bold text-white transition"
            >
              Acessar minha conta
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </section>
        <section>
          <h2 className="mb-4 text-lg font-bold text-[#172B3A]">
            Minhas aquisições
          </h2>
          {deals.length ? (
            <div className="space-y-3">
              {deals.map((deal) => (
                <Link
                  key={deal.dealId}
                  href={`/cliente/negociacoes/${deal.dealId}`}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 transition hover:border-[#1684D8] hover:shadow-md hover:shadow-slate-900/5"
                >
                  <span className="hidden rounded-2xl bg-[#EAF3FC] p-4 text-[#1684D8] sm:block">
                    <Car className="h-7 w-7" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1684D8]">
                      {deal.dealNumber}
                    </span>
                    <h3 className="mt-1 font-bold text-[#172B3A]">
                      {deal.vehicleLabel}
                    </h3>
                    <p className="mt-2 text-xs text-slate-500">
                      {deal.statusLabel}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[#1684D8]" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Car className="mx-auto h-10 w-10 text-[#1684D8]" />
              <h2>
                {name
                  ? "Ainda não há compras vinculadas"
                  : "Tudo no seu tempo."}
              </h2>
              <p>
                {name
                  ? "Assim que o vendedor vincular uma negociação à sua conta, ela aparecerá aqui."
                  : "Peça ao seu vendedor o link de primeiro acesso. Você define sua senha e acompanha as etapas da sua compra."}
              </p>
            </div>
          )}
        </section>
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#1684D8]" />
          <p className="text-xs leading-relaxed text-slate-500">
            <strong className="font-semibold text-[#172B3A]">
              Seu espaço é individual e simplificado.
            </strong>{" "}
            Apenas o andamento autorizado da sua compra, solicitações de documentos e orientações necessárias são exibidos aqui.
          </p>
        </div>
      </main>
      <footer className="pb-8 text-center text-xs text-slate-400">
        AUTOFLOW — Sua operação conectada do início ao fim. · Unidade: Pinauto BYD — Ceres/GO
      </footer>
    </div>
  );
}
