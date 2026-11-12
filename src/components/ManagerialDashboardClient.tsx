"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Clock,
  FileCheck2,
  Info,
  RefreshCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { ManagerialDashboardData } from "@/application/report-and-admin-service";
import { DEAL_STATUS_LABELS, DealStatus } from "@/domain/types";

export function ManagerialDashboardClient({
  data,
}: {
  data: ManagerialDashboardData;
}) {
  const router = useRouter();
  const {
    filtersApplied,
    availableFilterOptions,
    kpis,
    indicatorDefinitions,
    dealsByStage,
    pendingByReason,
    medianSaleToDeliveryHours,
    hoursByStage,
    reworkByDeal,
    volumeByResponsibleAndBranch,
  } = data;

  function updateFilter(next: Partial<typeof filtersApplied>) {
    const merged = { ...filtersApplied, ...next };
    const sp = new URLSearchParams();
    sp.set("periodDays", String(merged.periodDays));
    sp.set("sellerId", merged.sellerId);
    sp.set("vehicleModel", merged.vehicleModel);
    sp.set("statusFilter", merged.statusFilter);
    router.push(`/app/relatorios?${sp.toString()}`);
  }

  const maxStageCount = Math.max(1, ...dealsByStage.map((s) => s.count));
  const maxReasonCount = Math.max(1, ...pendingByReason.map((r) => r.count));

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#172B3A]">
            Visão Gerencial e Indicadores
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Métricas operacionais reais calculadas a partir dos registros,
            prazos e entregas do AUTOFLOW.
          </p>
        </div>
      </div>

      {/* Barra de Filtros: Período, Vendedor, Modelo e Situação */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500">
            Período
          </label>
          <select
            value={filtersApplied.periodDays}
            onChange={(e) =>
              updateFilter({ periodDays: Number(e.target.value) })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-[#172B3A]"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Últimos 12 meses</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500">
            Vendedor Responsável
          </label>
          <select
            value={filtersApplied.sellerId}
            onChange={(e) => updateFilter({ sellerId: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-[#172B3A]"
          >
            <option value="ALL">Todos os vendedores</option>
            {availableFilterOptions.sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500">
            Modelo do Veículo
          </label>
          <select
            value={filtersApplied.vehicleModel}
            onChange={(e) => updateFilter({ vehicleModel: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-[#172B3A]"
          >
            <option value="ALL">Todos os modelos</option>
            {availableFilterOptions.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500">
            Situação da Negociação
          </label>
          <select
            value={filtersApplied.statusFilter}
            onChange={(e) => updateFilter({ statusFilter: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-[#172B3A]"
          >
            <option value="ALL">Todas as situações</option>
            {(Object.keys(DEAL_STATUS_LABELS) as DealStatus[]).map((st) => (
              <option key={st} value={st}>
                {DEAL_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Indicadores Operacionais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
        {[
          {
            key: "openedInPeriodCount",
            title: "Abertas no Período",
            value: kpis.openedInPeriodCount,
            unit: `últimos ${filtersApplied.periodDays}d`,
            accent: "text-[#0B3B70]",
          },
          {
            key: "activeDealsCount",
            title: "Negociações Ativas",
            value: kpis.activeDealsCount,
            unit: "negociações",
            accent: "text-[#0B3B70]",
          },
          {
            key: "eligibleForAuthorizationCount",
            title: "Prontas para Autorização",
            value: kpis.eligibleForAuthorizationCount,
            unit: "veículos",
            accent: "text-[#1684D8]",
          },
          {
            key: "deliveryAuthorizedCount",
            title: "Entregas Autorizadas",
            value: kpis.deliveryAuthorizedCount,
            unit: "veículos",
            accent: "text-emerald-700",
          },
          {
            key: "deliveredInPeriodCount",
            title: "Entregas no Período",
            value: kpis.deliveredInPeriodCount,
            unit: `últimos ${filtersApplied.periodDays}d`,
            accent: "text-emerald-800",
          },
          {
            key: "overdueTasksCount",
            title: "Tarefas em Atraso",
            value: kpis.overdueTasksCount,
            unit: "tarefas",
            accent: "text-red-700",
          },
          {
            key: "waitingDocumentsCount",
            title: "Aguardando Documentos",
            value: kpis.waitingDocumentsCount,
            unit: "negociações",
            accent: "text-amber-700",
          },
          {
            key: "waitingFinancialAnalysisCount",
            title: "Conferência Financeira",
            value: kpis.waitingFinancialAnalysisCount,
            unit: "negociações",
            accent: "text-amber-700",
          },
          {
            key: "waitingDocumentAnalysisCount",
            title: "Conferência Documental",
            value: kpis.waitingDocumentAnalysisCount,
            unit: "negociações",
            accent: "text-[#1684D8]",
          },
        ].map((item) => (
          <div
            key={item.key}
            className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between gap-2"
          >
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-[#172B3A]">
                  {item.title}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                  {item.unit}
                </span>
              </div>
              <div className={`text-2xl sm:text-3xl font-extrabold mt-1 ${item.accent}`}>
                {item.value}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug border-t border-slate-100 pt-2">
              {indicatorDefinitions[item.key as keyof typeof indicatorDefinitions] || ""}
            </p>
          </div>
        ))}
      </div>

      {/* Gráficos 1 e 2: Processos por Etapa & Pendências por Motivo */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Gráfico: Processos por Etapa */}
        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#1684D8]" />
              <span>Processos por Etapa do Fluxo</span>
            </h2>
            <p className="text-xs text-slate-500">
              Distribuição das negociações filtradas pelas etapas do processo.
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            {dealsByStage.map((st) => {
              const pct = Math.round((st.count / maxStageCount) * 100);
              return (
                <div key={st.stageCode} className="space-y-1">
                  <div className="flex justify-between font-semibold text-[#172B3A]">
                    <span>{st.stageName}</span>
                    <span>{st.count} negociação(ões)</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-[#1684D8] rounded-full transition-all"
                      style={{
                        width: `${st.count > 0 ? Math.max(8, pct) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Gráfico: Pendências por Motivo */}
        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span>Pendências Ativas por Motivo</span>
            </h2>
            <p className="text-xs text-slate-500">
              Causas principais que impedem a conclusão das etapas.
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            {pendingByReason.map((r) => {
              const pct = Math.round((r.count / maxReasonCount) * 100);
              return (
                <div key={r.reasonCategory} className="space-y-1">
                  <div className="flex justify-between font-semibold text-[#172B3A]">
                    <span>{r.reasonCategory}</span>
                    <span>{r.count}</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{
                        width: `${r.count > 0 ? Math.max(8, pct) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Gráficos 3 e 4: Tempo Mediano Venda -> Entrega & Tempo em Cada Etapa */}
      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-[#0B3B70] text-white rounded-2xl p-6 border border-[#1684D8]/30 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7CC4FA]">
              Tempo do Ciclo Operacional
            </span>
            <h2 className="text-lg font-bold">
              Tempo Mediano entre Venda e Entrega
            </h2>
            <p className="text-xs text-blue-100 leading-relaxed">
              Calculado a partir da data de abertura da negociação até a data
              real de entrega física das chaves, considerando as entregas
              realizadas no período selecionado.
            </p>
          </div>

          {medianSaleToDeliveryHours !== null ? (
            <div className="rounded-xl bg-[#082B54] border border-white/15 p-4">
              <div className="text-3xl font-extrabold text-[#7CC4FA]">
                {medianSaleToDeliveryHours} horas
              </div>
              <div className="text-xs text-blue-100/80 mt-1">
                (~{Math.round((medianSaleToDeliveryHours / 24) * 10) / 10} dias
                corridos nas entregas concluídas do período)
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-[#082B54] border border-white/15 p-4 text-xs text-blue-100">
              <strong>Sem entregas no período:</strong> Não há entregas
              concluídas no recorte selecionado para cálculo da mediana.
            </div>
          )}

          <div className="text-[11px] text-blue-100/80 flex items-start gap-2">
            <Info className="h-4 w-4 text-[#7CC4FA] shrink-0 mt-0.5" />
            <span>
              Métrica calculada estritamente com base nos registros reais de
              entrega.
            </span>
          </div>
        </section>

        <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#1684D8]" />
              <span>Tempo Médio de Execução das Tarefas por Etapa (Horas)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Calculado da disponibilização ou início de cada tarefa até a sua
              conclusão.
            </p>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
            {hoursByStage.map((hs) => (
              <div
                key={hs.stageCode}
                className="p-3 flex items-center justify-between gap-2"
              >
                <span className="font-bold text-[#172B3A]">{hs.stageName}</span>
                {hs.avgHours !== null ? (
                  <span className="font-mono font-bold text-[#0B3B70] bg-[#EAF3FC] border border-[#1684D8]/30 px-2.5 py-0.5 rounded">
                    {hs.avgHours}h ({hs.sampleSize} concluída(s))
                  </span>
                ) : (
                  <span className="text-slate-400 italic">
                    Sem tarefas concluídas nesta etapa
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Gráficos 5 e 6: Retrabalho por Negociação & Carga por Área e Responsável */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
              <RefreshCcw className="h-5 w-5 text-[#1684D8]" />
              <span>Retrabalho por Negociação</span>
            </h2>
            <p className="text-xs text-slate-500">
              Contagem de reaberturas, correções solicitadas e substituições de
              documentos.
            </p>
          </div>

          {reworkByDeal.length === 0 ? (
            <p className="text-xs text-slate-500">
              Nenhum retrabalho registrado no filtro selecionado.
            </p>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
              {reworkByDeal.map((rw) => (
                <div
                  key={rw.dealId}
                  className="p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <Link
                      href={`/app/negociacoes/${rw.dealId}`}
                      className="font-bold text-[#0B3B70] hover:underline"
                    >
                      {rw.dealNumber} — {rw.vehicleLabel}
                    </Link>
                    <div className="text-[11px] text-slate-500">
                      Reaberturas/Correções: {rw.reopenAndRejectionCount} •
                      Substituições de doc: {rw.documentVersionsExtraCount}
                    </div>
                  </div>
                  <span
                    className={`rounded px-2.5 py-1 font-bold ${
                      rw.totalReworkEvents > 0
                        ? "bg-amber-100 text-amber-950"
                        : "bg-emerald-50 text-emerald-900"
                    }`}
                  >
                    {rw.totalReworkEvents} evento(s)
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
              <Users className="h-5 w-5 text-[#1684D8]" />
              <span>Carga de Trabalho por Área e Responsável</span>
            </h2>
            <p className="text-xs text-slate-500">
              Distribuição por área, tarefas sem atribuição individual e volume
              por unidade.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            {/* Carga por Área */}
            {volumeByResponsibleAndBranch.byArea &&
              volumeByResponsibleAndBranch.byArea.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-700">
                    Por Área Responsável:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {volumeByResponsibleAndBranch.byArea.map((a) => (
                      <div
                        key={a.area}
                        className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-2.5"
                      >
                        <span className="text-slate-500 block text-[11px] truncate">
                          {a.areaLabel}
                        </span>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <strong className="text-sm font-extrabold text-[#172B3A]">
                            {a.openTasks} abertas
                          </strong>
                          {a.unassignedOpenTasks > 0 && (
                            <span className="text-[10px] text-amber-700 font-semibold">
                              ({a.unassignedOpenTasks} sem resp.)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Alerta de tarefas sem atribuição individual */}
            {volumeByResponsibleAndBranch.unassignedTasksCount > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>
                    {volumeByResponsibleAndBranch.unassignedTasksCount} tarefa(s)
                  </strong>{" "}
                  na fila geral das áreas aguardando atribuição nominal.
                </span>
              </div>
            )}

            {/* Por Unidade */}
            <div className="pt-2">
              <div className="font-bold text-slate-700 mb-1.5">Por Unidade:</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {volumeByResponsibleAndBranch.byBranch.map((b) => (
                  <div
                    key={b.branchId}
                    className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-2.5"
                  >
                    <div className="font-bold text-[#172B3A] truncate">
                      {b.branchName}
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      Ativas: <strong>{b.activeDeals}</strong> • Entregues no
                      período: <strong>{b.deliveredDeals}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Por Colaborador */}
            <div className="pt-2">
              <div className="font-bold text-slate-700 mb-1.5">
                Por Colaborador:
              </div>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {volumeByResponsibleAndBranch.byResponsible.map((resp) => (
                  <div
                    key={resp.profileId}
                    className="p-2.5 flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold text-[#172B3A] truncate">
                      {resp.fullName}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                        {resp.openTasks} abertas
                      </span>
                      <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                        {resp.completedTasks} concluídas
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
