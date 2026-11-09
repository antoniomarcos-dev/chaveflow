import {
  getCustomerSafeDealView,
  listDealsForAuthenticatedCustomer,
} from "@/application/customer-portal-service";
import { CustomerPortalViewClient } from "@/components/CustomerPortalViewClient";
import { AuthorizationError } from "@/domain/permissions";
import { getServerSessionContext } from "@/lib/server-session";
import { ArrowRight, CheckCircle2, KeyRound, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default async function CustomerPortalIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; dealId?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await getServerSessionContext();

  // Caso 1: Token individual de convite na URL (?token=...)
  if (sp.token) {
    try {
      const view = await getCustomerSafeDealView({
        ctx,
        accessToken: sp.token,
        dealId: sp.dealId,
      });
      return <CustomerPortalViewClient view={view} accessToken={sp.token} />;
    } catch (err) {
      const isAuthErr = err instanceof AuthorizationError;
      const message =
        err instanceof Error
          ? err.message
          : "Acesso não autorizado ao Portal do Comprador.";
      const code = isAuthErr ? err.code : "ACCESS_DENIED";

      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6">
          <div className="max-w-lg w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                  Bloqueio no Servidor • {code}
                </span>
                <h1 className="text-lg font-bold text-white mt-1">
                  Acesso Recusado à Área do Comprador
                </h1>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              {message}
            </p>

            <div className="text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">
                Regra de Segurança Verificada (Funcionalidade 9):
              </p>
              <p>
                • O QR Code físico do veículo é estritamente de uso operacional
                interno e jamais concede acesso aos dados do comprador.
              </p>
              <p>
                • O acesso do comprador exige conta autenticada do titular ou
                token de convite individual com validade e possibilidade de
                revogação.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <Link
                href="/cliente"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Voltar ao Portal do Comprador
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  // Caso 2: Cliente autenticado por sessão
  const customerDeals = ctx ? await listDealsForAuthenticatedCustomer(ctx) : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                ChaveFlow • Área do Comprador
              </h1>
              <p className="text-xs text-slate-500">
                Acompanhamento seguro e transparente até a entrega das chaves
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            Trocar conta / Login
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Negociações vinculadas à conta autenticada do cliente */}
        {customerDeals.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              Suas Aquisições Vinculadas ({ctx?.profile.fullName})
            </h2>
            <div className="space-y-2.5">
              {customerDeals.map((d) => (
                <Link
                  key={d.dealId}
                  href={`/cliente/negociacoes/${d.dealId}`}
                  className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/70 flex items-center justify-between gap-3 transition"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-700">
                      {d.dealNumber}
                    </span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {d.vehicleLabel}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Situação: {d.statusLabel}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                    Acompanhar <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-white border p-6 text-sm text-slate-600">
          {ctx
            ? "As negociações vinculadas à sua conta aparecem nesta página."
            : "Entre na sua conta ou utilize o link individual enviado pela concessionária."}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 text-xs text-slate-600 space-y-2">
          <p className="font-bold text-slate-900 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Garantias de Privacidade da Área do Cliente
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Exibe somente o veículo adquirido, etapas compartilháveis,
              solicitações de documentos visíveis ao cliente, atualizações
              públicas e contato do consultor comercial.
            </li>
            <li>
              A previsão de entrega só exibe data quando confirmada oficialmente
              por responsável autorizado da concessionária.
            </li>
            <li>
              Observações internas, pareceres de crédito/documentação e trilha
              de auditoria interna permanecem restritos à equipe autorizada.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
