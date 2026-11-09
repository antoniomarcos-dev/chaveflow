import { getCustomerSafeDealView } from "@/application/customer-portal-service";
import { CustomerPortalViewClient } from "@/components/CustomerPortalViewClient";
import { AuthorizationError } from "@/domain/permissions";
import { getServerSessionContext } from "@/lib/server-session";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

export default async function CustomerDealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getServerSessionContext();

  try {
    const view = await getCustomerSafeDealView({
      ctx,
      dealId: id,
      accessToken: sp.token,
    });
    return <CustomerPortalViewClient view={view} accessToken={sp.token} />;
  } catch (err) {
    const isAuthErr = err instanceof AuthorizationError;
    const message =
      err instanceof Error
        ? err.message
        : "Você não possui permissão para visualizar esta negociação.";
    const code = isAuthErr ? err.code : "CUSTOMER_ACCESS_DENIED";

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6">
        <div className="max-w-lg w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                Isolamento do Comprador • {code}
              </span>
              <h1 className="text-lg font-bold text-white mt-1">
                Acesso Não Autorizado
              </h1>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            {message}
          </p>

          <div className="pt-2 flex flex-wrap gap-2">
            <Link
              href="/cliente"
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              Voltar ao Portal do Comprador
            </Link>
            <Link
              href="/login"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
            >
              Fazer Login como Cliente Titular
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
