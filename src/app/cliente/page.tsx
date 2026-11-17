import { readSearchParams, type PageSearchParams } from "@/lib/navigation";
import {
  listDealsForAuthenticatedCustomer,
} from "@/application/customer-portal-service";
import { CustomerPortalHome } from "@/components/CustomerPortalHome";
import { AuthorizationError } from "@/domain/permissions";
import { getServerSessionContext } from "@/lib/server-session";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function CustomerPortalIndexPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const sp = await readSearchParams(searchParams);
  const ctx = await getServerSessionContext();

  // Legacy links are exchanged for an HttpOnly cookie before rendering.
  if (sp.token) {
    redirect(
      `/cliente/convite/${encodeURIComponent(sp.token)}${
        sp.dealId ? `?dealId=${encodeURIComponent(sp.dealId)}` : ""
      }`,
    );
  }

  // Caso 1: sessão autenticada do cliente
  try {
    const customerDeals = ctx
      ? await listDealsForAuthenticatedCustomer(ctx)
      : [];
    return (
      <CustomerPortalHome
        name={ctx?.profile.isCustomerOnly ? ctx.profile.fullName : undefined}
        deals={customerDeals}
      />
    );
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
