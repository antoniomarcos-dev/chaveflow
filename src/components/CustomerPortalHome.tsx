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
    <div className="min-h-screen bg-[#f6f8fa]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="rounded-xl bg-teal-600 p-2.5 text-white">
              <KeyRound className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">
              chaveflow
              <span className="block text-[10px] font-medium uppercase tracking-[.15em] text-slate-400">
                Seu espaço
              </span>
            </span>
          </Link>
          <AccountNavigation signedIn={!!name} />
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-7 px-5 py-9 sm:py-12">
        <section className="relative overflow-hidden rounded-3xl bg-[#101d31] p-7 text-white sm:p-10">
          <span className="text-[10px] font-semibold uppercase tracking-[.2em] text-teal-300">
            Cada etapa, mais perto das chaves
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {name
              ? `Olá, ${name.split(" ")[0]}.`
              : "Sua próxima conquista começa aqui."}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
            {name
              ? "Acompanhe sua compra, confira os próximos passos e mantenha seus documentos em dia. Seu vendedor está com você nesta jornada."
              : "Entre com o acesso criado pelo seu vendedor para acompanhar sua compra com tranquilidade."}
          </p>
          {!name && (
            <Link
              href="/login?area=cliente"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-slate-950"
            >
              Acessar minha conta
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </section>
        <section>
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Minhas compras
          </h2>
          {deals.length ? (
            <div className="space-y-3">
              {deals.map((deal) => (
                <Link
                  key={deal.dealId}
                  href={`/cliente/negociacoes/${deal.dealId}`}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-teal-300 hover:shadow-md hover:shadow-slate-900/5"
                >
                  <span className="hidden rounded-2xl bg-slate-50 p-4 text-teal-700 sm:block">
                    <Car className="h-7 w-7" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                      {deal.dealNumber}
                    </span>
                    <h3 className="mt-1 font-bold text-slate-900">
                      {deal.vehicleLabel}
                    </h3>
                    <p className="mt-2 text-xs text-slate-500">
                      {deal.statusLabel}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-teal-700" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Car className="mx-auto h-10 w-10 text-teal-500" />
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
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          <p className="text-xs leading-relaxed text-slate-500">
            <strong className="font-semibold text-slate-700">
              Seu espaço é individual.
            </strong>{" "}
            Apenas suas compras e os documentos compartilhados com você aparecem
            aqui.
          </p>
        </div>
      </main>
      <footer className="pb-8 text-center text-xs text-slate-400">
        Pinauto BYD — Ceres · ChaveFlow
      </footer>
    </div>
  );
}
