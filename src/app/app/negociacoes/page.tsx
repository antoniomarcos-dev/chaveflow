import { listDealsForOrg } from "@/application/deal-service";
import { DealStatusBadge } from "@/components/StatusBadge";
import { hasPermission } from "@/domain/permissions";
import { WORKFLOW_STAGES } from "@/domain/types";
import { formatDateTimeBr } from "@/lib/format";
import { requireInternalSession } from "@/lib/server-session";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  PlusCircle,
} from "lucide-react";
import Link from "next/link";

export default async function NegociacoesListPage() {
  const ctx = await requireInternalSession();
  const deals = await listDealsForOrg({ ctx });
  const canCreate = hasPermission(ctx, "deal:create");

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
            Passaportes Digitais da Concessionária
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
            Negociações ({deals.length})
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Acompanhe situação, bloqueios financeiros/documentais, faturamento e
            autorização de entrega.
          </p>
        </div>

        {canCreate && (
          <Link
            href="/app/negociacoes/nova"
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Nova Negociação Guiada</span>
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {deals.map(({ deal, vehicle, customer, sellerName, summary }) => {
          const stageObj = WORKFLOW_STAGES.find(
            (s) => s.code === summary.currentStage,
          );

          return (
            <div
              key={deal.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:border-slate-300 transition"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-teal-50 text-teal-900 border border-teal-200 px-2.5 py-0.5 rounded">
                    {deal.dealNumber}
                  </span>
                  <DealStatusBadge status={deal.status} />
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded">
                    Etapa: {stageObj?.name ?? summary.currentStage}
                  </span>
                </div>

                <h2 className="text-base font-extrabold text-slate-900">
                  {vehicle.internalCode} — {vehicle.brand} {vehicle.model}{" "}
                  {vehicle.trim} ({vehicle.color})
                </h2>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>
                    Comprador: <strong>{customer.fullName}</strong> (
                    {deal.buyerType})
                  </span>
                  <span>Vendedor: {sellerName}</span>
                  <span>
                    Chassi: <code className="font-mono">{vehicle.vin}</code>
                  </span>
                  <span>Atualizado em: {formatDateTimeBr(deal.updatedAt)}</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                  <span
                    className={`rounded px-2 py-0.5 font-semibold border ${
                      summary.pillars.financial.status === "OK"
                        ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                        : "bg-amber-50 text-amber-900 border-amber-200"
                    }`}
                  >
                    Financeiro: {summary.pillars.financial.summary}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 font-semibold border ${
                      summary.pillars.documentation.status === "OK"
                        ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                        : "bg-amber-50 text-amber-900 border-amber-200"
                    }`}
                  >
                    Documental: {summary.pillars.documentation.summary}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 font-semibold border ${
                      summary.pillars.operational.status === "OK"
                        ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                        : "bg-amber-50 text-amber-900 border-amber-200"
                    }`}
                  >
                    Operacional: {summary.pillars.operational.summary}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                <div className="text-xs">
                  {summary.deliveryBlockers.length > 0 ? (
                    <span className="inline-flex items-center gap-1 font-bold text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      {summary.deliveryBlockers.length} requisito(s)
                      impeditivo(s)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Requisitos cumpridos (
                      {summary.completedApplicableTasksCount}/
                      {summary.applicableTasksCount})
                    </span>
                  )}
                </div>

                {deal.status === "DRAFT" ? (
                  <Link
                    href={`/app/negociacoes/nova?draftId=${deal.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-bold text-white"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Continuar Rascunho</span>
                  </Link>
                ) : (
                  <Link
                    href={`/app/negociacoes/${deal.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f172a] hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-white"
                  >
                    <span>Abrir Passaporte Digital</span>
                    <ArrowRight className="h-4 w-4 text-teal-400" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
