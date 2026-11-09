"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Clock,
  FileCheck2,
  Filter,
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
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
            Inteligência Operacional Real (Sem Estimativas Fictícias)
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
            Painel Gerencial da Concessionária
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Todos os indicadores e tempos são calculados estritamente a partir dos registros e timestamps reais do banco de dados.
          </p>
        </div>
      </div>

      {/* Barra de Filtros: Período, Vendedor, Modelo e Situação */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500">
            Período
          </label>
          <select
            value={filtersApplied.periodDays}
            onChange={(e) =>
              updateFilter({ periodDays: Number(e.target.value) })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900"
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
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900"
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
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900"
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
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900"
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

      {/* 8 Indicadores Obrigatórios com Definição Clara */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            key: "activeDealsCount",
            title: "Negociações Ativas",
            value: kpis.activeDealsCount,
            accent: "text-blue-700",
          },
          {
            key: "waitingDocumentsCount",
            title: "Aguardando Documentos",
            value: kpis.waitingDocumentsCount,
            accent: "text-amber-700",
          },
          {
            key: "waitingFinancialAnalysisCount",
            title: "Aguardando Análise Financeira",
            value: kpis.waitingFinancialAnalysisCount,
            accent: "text-amber-700",
          },
          {
            key: "waitingDocumentAnalysisCount",
            title: "Aguardando Análise Documental",
            value: kpis.waitingDocumentAnalysisCount,
            accent: "text-indigo-700",
          },
          {
            key: "eligibleForAuthorizationCount",
            title: "Elegíveis para Autorização",
            value: kpis.eligibleForAuthorizationCount,
            accent: "text-teal-700",
          },
          {
            key: "deliveryAuthorizedCount",
            title: "Entregas Autorizadas",
            value: kpis.deliveryAuthorizedCount,
            accent: "text-emerald-700",
          },
          {
            key: "deliveredInPeriodCount",
            title: "Entregas Realizadas no Período",
            value: kpis.deliveredInPeriodCount,
            accent: "text-emerald-800",
          },
          {
            key: "overdueTasksCount",
            title: "Tarefas Atrasadas (SLA)",
            value: kpis.overdueTasksCount,
            accent: "text-red-700",
          },
        ].map((item) => (
          <div
            key={item.key}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-2"
          >
            <div>
              <div className="text-xs font-bold text-slate-700">
                {item.title}
              </div>
              <div className={`text-3xl font-extrabold mt-1 ${item.accent}`}>
                {item.value}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug border-t border-slate-100 pt-2">
              {indicatorDefinitions[item.key]}
            </p>
          </div>
        ))}
      </div>

      {/* Gráficos 1 e 2: Processos por Etapa & Pendências por Motivo */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Gráfico: Processos por Etapa */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-teal-600" />
                <span>Processos por Etapa do Fluxo</span>
              </h2>
              <p className="text-xs text-slate-500">
                Distribuição das negociações filtradas pelas 8 etapas do motor de processos.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            {dealsByStage.map((st) => {
              const pct = Math.round((st.count / maxStageCount) * 100);
              return (
                <div key={st.stageCode} className="space-y-1">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>{st.stageName}</span>
                    <span>{st.count} negociação(ões)</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-teal-600 rounded-full transition-all"
                      style={{ width: `${st.count > 0 ? Math.max(8, pct) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Gráfico: Pendências por Motivo */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span>Pendências Ativas por Motivo</span>
            </h2>
            <p className="text-xs text-slate-500">
              Causas diretas que retêm negociações ativas antes da autorização de entrega.
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            {pendingByReason.map((r) => {
              const pct = Math.round((r.count / maxReasonCount) * 100);
              return (
                <div key={r.reasonCategory} className="space-y-1">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>{r.reasonCategory}</span>
                    <span>{r.count}</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${r.count > 0 ? Math.max(8, pct) : 0}%` }}
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
        <section className="lg:col-span-5 bg-[#0f172a] text-white rounded-2xl p-6 border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
              Ciclo Ponta a Ponta Auditado
            </span>
            <h2 className="text-lg font-bold">
              Tempo Mediano entre Venda e Entrega
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Calculado pela diferença exata entre a criação do passaporte (
              <code>deal.createdAt</code>) e o registro de entrega física das chaves (
              <code>delivery.deliveredAt</code>).
            </p>
          </div>

          {medianSaleToDeliveryHours !== null ? (
            <div className="rounded-xl bg-slate-900 border border-slate-700 p-4">
              <div className="text-3xl font-extrabold text-teal-400">
                {medianSaleToDeliveryHours} horas
              </div>
              <div className="text-xs text-slate-400 mt-1">
                (~{Math.round((medianSaleToDeliveryHours / 24) * 10) / 10} dias
                corridos nas entregas concluídas do período)
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-900 border border-slate-700 p-4 text-xs text-slate-300">
              <strong>Dados insuficientes no filtro selecionado:</strong> Não há entregas físicas concluídas no recorte atual para cálculo da mediana.
            </div>
          )}

          <div className="text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
            <span>
              Política de integridade: O sistema nunca inventa percentuais de economia ou redução de tempo sem base histórica real.
            </span>
          </div>
        </section>

        <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-teal-600" />
              <span>Tempo Registrado em Cada Etapa (Horas)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Média das tarefas concluídas em cada etapa a partir dos eventos reais. Exibe &ldquo;Dados insuficientes&rdquo; quando não há amostra concluída na etapa.
            </p>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
            {hoursByStage.map((hs) => (
              <div
                key={hs.stageCode}
                className="p-3 flex items-center justify-between gap-2"
              >
                <span className="font-bold text-slate-800">{hs.stageName}</span>
                {hs.avgHours !== null ? (
                  <span className="font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded">
                    {hs.avgHours}h ({hs.sampleSize} concluída(s))
                  </span>
                ) : (
                  <span className="text-slate-400 italic">
                    Dados insuficientes (0 concluídas nesta etapa)
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Gráficos 5 e 6: Retrabalho por Negociação & Volume por Responsável / Unidade */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <RefreshCcw className="h-5 w-5 text-teal-600" />
              <span>Retrabalho por Negociação</span>
            </h2>
            <p className="text-xs text-slate-500">
              Soma de reaberturas de tarefas, rejeições/aprovações desatualizadas e versões extras de documentos substituídos.
            </p>
          </div>

          {reworkByDeal.length === 0 ? (
            <p className="text-xs text-slate-500">
              Dados insuficientes para o filtro selecionado.
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
                      className="font-bold text-slate-900 hover:underline"
                    >
                      {rw.dealNumber} — {rw.vehicleLabel}
                    </Link>
                    <div className="text-[11px] text-slate-500">
                      Reaberturas/Rejeições: {rw.reopenAndRejectionCount} •
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
                    {rw.totalReworkEvents} evento(s) de retrabalho
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-600" />
              <span>Volume por Responsável e Unidade</span>
            </h2>
            <p className="text-xs text-slate-500">
              Carga operacional de tarefas por colaborador e volume de negociações por unidade.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="font-bold text-slate-700">Por Unidade:</div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {volumeByResponsibleAndBranch.byBranch.map((b) => (
                <div
                  key={b.branchId}
                  className="rounded-xl bg-slate-50 border border-slate-200 p-3"
                >
                  <div className="font-bold text-slate-900 truncate">
                    {b.branchName}
                  </div>
                  <div className="text-slate-600 mt-1">
                    Ativas: <strong>{b.activeDeals}</strong> • Entregues:{" "}
                    <strong>{b.deliveredDeals}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="font-bold text-slate-700 pt-2">
              Por Colaborador Responsável:
            </div>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
              {volumeByResponsibleAndBranch.byResponsible.map((resp) => (
                <div
                  key={resp.profileId}
                  className="p-2.5 flex items-center justify-between gap-2"
                >
                  <span className="font-semibold text-slate-800">
                    {resp.fullName}
                  </span>
                  <div className="flex items-center gap-2">
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
        </section>
      </div>
    </div>
  );
}
