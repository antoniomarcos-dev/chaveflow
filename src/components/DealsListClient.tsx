"use client";

import type { listDealsForOrg } from "@/application/deal-service";
import { WORKFLOW_STAGES } from "@/domain/types";
import { formatDateTimeBr } from "@/lib/format";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DealStatusBadge } from "./StatusBadge";

type DealListItem = Awaited<ReturnType<typeof listDealsForOrg>>[number];

type FilterTab =
  | "ALL"
  | "IN_PROGRESS"
  | "PENDING"
  | "AWAITING_RELEASE"
  | "DELIVERED"
  | "DRAFT";

export function DealsListClient({
  deals,
  canCreate,
  initialFilter = "ALL",
}: {
  deals: DealListItem[];
  canCreate: boolean;
  initialFilter?: FilterTab;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>(initialFilter);

  const counts = {
    ALL: deals.length,
    IN_PROGRESS: deals.filter((d) => d.deal.status === "ACTIVE").length,
    PENDING: deals.filter(
      (d) =>
        d.deal.status === "ACTIVE" && d.summary.deliveryBlockers.length > 0,
    ).length,
    AWAITING_RELEASE: deals.filter(
      (d) =>
        d.deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
        d.deal.status === "DELIVERY_AUTHORIZED",
    ).length,
    DELIVERED: deals.filter((d) => d.deal.status === "DELIVERED").length,
    DRAFT: deals.filter((d) => d.deal.status === "DRAFT").length,
  };

  const filtered = deals.filter((item) => {
    const { deal, vehicle, customer, sellerName } = item;

    if (tab === "IN_PROGRESS" && deal.status !== "ACTIVE") return false;
    if (
      tab === "PENDING" &&
      !(deal.status === "ACTIVE" && item.summary.deliveryBlockers.length > 0)
    ) {
      return false;
    }
    if (
      tab === "AWAITING_RELEASE" &&
      deal.status !== "ELIGIBLE_FOR_AUTHORIZATION" &&
      deal.status !== "DELIVERY_AUTHORIZED"
    ) {
      return false;
    }
    if (tab === "DELIVERED" && deal.status !== "DELIVERED") return false;
    if (tab === "DRAFT" && deal.status !== "DRAFT") return false;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${deal.dealNumber} ${vehicle.internalCode} ${vehicle.brand} ${vehicle.model} ${vehicle.trim} ${vehicle.color} ${vehicle.vin} ${customer.fullName} ${customer.documentNumber} ${sellerName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  const tabs: Array<{ id: FilterTab; label: string; count: number }> = [
    { id: "ALL", label: "Todas", count: counts.ALL },
    { id: "IN_PROGRESS", label: "Em andamento", count: counts.IN_PROGRESS },
    { id: "PENDING", label: "Com pendências", count: counts.PENDING },
    {
      id: "AWAITING_RELEASE",
      label: "Aguardando liberação",
      count: counts.AWAITING_RELEASE,
    },
    { id: "DELIVERED", label: "Concluídas", count: counts.DELIVERED },
    ...(counts.DRAFT > 0
      ? [{ id: "DRAFT" as const, label: "Rascunhos", count: counts.DRAFT }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="eyebrow">Passaportes Digitais</span>
          <h1 className="text-2xl font-extrabold text-[#172B3A] mt-1">
            Negociações
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Gerencie e acompanhe todas as negociações, pendências documentais,
            aprovações e liberação de entrega.
          </p>
        </div>

        {canCreate && (
          <Link
            href="/app/negociacoes/nova"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Negociação</span>
          </Link>
        )}
      </div>

      {/* Barra de Busca e Abas de Situação */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar por cliente, veículo ou número da negociação"
            placeholder="Buscar por cliente, veículo, chassi ou nº da negociação..."
            className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#172B3A]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  active
                    ? "bg-[#1684D8] text-white shadow-2xs"
                    : "bg-slate-50 text-slate-600 hover:bg-[#EAF3FC] hover:text-[#0B3B70]"
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-200/80 text-slate-700"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Listagem Estruturada */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <FileSpreadsheet className="mx-auto h-10 w-10 text-[#1684D8]" />
          <h2>Nenhuma negociação encontrada para o filtro selecionado</h2>
          <p>
            Ajuste os termos de busca, altere a aba de situação ou inicie uma
            nova negociação guiada.
          </p>
          {canCreate && (
            <Link
              href="/app/negociacoes/nova"
              className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] px-4 py-2.5 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Negociação</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Tabela Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Nº Negociação</th>
                  <th className="py-3.5 px-4">Veículo</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Etapa Atual & Pilares</th>
                  <th className="py-3.5 px-4">Responsável</th>
                  <th className="py-3.5 px-4">Situação</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map(
                  ({ deal, vehicle, customer, sellerName, summary }) => {
                    const stageObj = WORKFLOW_STAGES.find(
                      (s) => s.code === summary.currentStage,
                    );

                    return (
                      <tr
                        key={deal.id}
                        className="hover:bg-[#F4F7FA]/80 transition"
                      >
                        <td className="py-4 px-4 align-middle">
                          <span className="font-mono text-xs font-extrabold text-[#0B3B70] bg-[#EAF3FC] border border-[#1684D8]/25 px-2.5 py-1 rounded-lg">
                            {deal.dealNumber}
                          </span>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {formatDateTimeBr(deal.updatedAt)}
                          </div>
                        </td>

                        <td className="py-4 px-4 align-middle">
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                vehicle.photos[0] || "/vehicle-placeholder.svg"
                              }
                              alt={`${vehicle.brand} ${vehicle.model}`}
                              className="h-11 w-16 rounded-lg border border-slate-200 object-cover bg-slate-900 shrink-0"
                            />
                            <div>
                              <div className="font-extrabold text-[#172B3A] text-sm">
                                {vehicle.brand} {vehicle.model}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {vehicle.trim} • {vehicle.modelYear} •{" "}
                                {vehicle.color}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500">
                                {vehicle.internalCode} • {vehicle.vin}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 align-middle">
                          <div className="flex items-center gap-1.5 font-bold text-[#172B3A]">
                            <User className="h-3.5 w-3.5 text-[#1684D8] shrink-0" />
                            <span>{customer.fullName}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 pl-5 mt-0.5">
                            {deal.buyerType}
                          </div>
                        </td>

                        <td className="py-4 px-4 align-middle">
                          <div className="font-bold text-[#0B3B70]">
                            {stageObj?.name ?? summary.currentStage}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5 text-[10px]">
                            <span
                              className={`rounded px-1.5 py-0.5 font-semibold border ${
                                summary.pillars.financial.status === "OK"
                                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                                  : "bg-amber-50 text-amber-900 border-amber-200"
                              }`}
                            >
                              Fin:{" "}
                              {summary.pillars.financial.status === "OK"
                                ? "OK"
                                : "Pendente"}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 font-semibold border ${
                                summary.pillars.documentation.status === "OK"
                                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                                  : "bg-amber-50 text-amber-900 border-amber-200"
                              }`}
                            >
                              Doc:{" "}
                              {summary.pillars.documentation.status === "OK"
                                ? "OK"
                                : "Pendente"}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 font-semibold border ${
                                summary.pillars.operational.status === "OK"
                                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                                  : "bg-amber-50 text-amber-900 border-amber-200"
                              }`}
                            >
                              Oper:{" "}
                              {summary.pillars.operational.status === "OK"
                                ? "OK"
                                : "Pendente"}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4 align-middle">
                          <div className="font-semibold text-[#172B3A]">
                            {sellerName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Consultor Comercial
                          </div>
                        </td>

                        <td className="py-4 px-4 align-middle">
                          <div className="flex flex-col items-start gap-1">
                            <DealStatusBadge status={deal.status} />
                            {summary.deliveryBlockers.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                {summary.deliveryBlockers.length} requisito(s)
                                impeditivo(s)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                {summary.completedApplicableTasksCount}/
                                {summary.applicableTasksCount} tarefas
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-4 align-middle text-right">
                          {deal.status === "DRAFT" ? (
                            <Link
                              href={`/app/negociacoes/nova?draftId=${deal.id}`}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-3.5 py-2 text-xs font-bold text-white transition"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                              <span>Continuar Rascunho</span>
                            </Link>
                          ) : (
                            <Link
                              href={`/app/negociacoes/${deal.id}`}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3B70] hover:bg-[#1684D8] px-3.5 py-2 text-xs font-bold text-white transition"
                            >
                              <span>Abrir Passaporte</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>

          {/* Lista em Cards para Telas Menores */}
          <div className="lg:hidden divide-y divide-slate-200">
            {filtered.map(({ deal, vehicle, customer, sellerName, summary }) => {
              const stageObj = WORKFLOW_STAGES.find(
                (s) => s.code === summary.currentStage,
              );

              return (
                <div key={deal.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold bg-[#EAF3FC] text-[#0B3B70] border border-[#1684D8]/30 px-2.5 py-0.5 rounded">
                      {deal.dealNumber}
                    </span>
                    <DealStatusBadge status={deal.status} />
                  </div>

                  <div>
                    <h2 className="text-base font-extrabold text-[#172B3A]">
                      {vehicle.internalCode} — {vehicle.brand} {vehicle.model}{" "}
                      ({vehicle.color})
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Cliente: <strong>{customer.fullName}</strong> (
                      {deal.buyerType}) • Responsável: {sellerName}
                    </p>
                    <p className="text-xs text-[#0B3B70] font-semibold mt-1">
                      Etapa atual: {stageObj?.name ?? summary.currentStage}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="text-xs">
                      {summary.deliveryBlockers.length > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {summary.deliveryBlockers.length} requisito(s)
                          impeditivo(s)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Requisitos em dia
                        </span>
                      )}
                    </div>

                    {deal.status === "DRAFT" ? (
                      <Link
                        href={`/app/negociacoes/nova?draftId=${deal.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white"
                      >
                        <span>Continuar Rascunho</span>
                      </Link>
                    ) : (
                      <Link
                        href={`/app/negociacoes/${deal.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#1684D8] px-3.5 py-2 text-xs font-bold text-white"
                      >
                        <span>Abrir Passaporte</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
