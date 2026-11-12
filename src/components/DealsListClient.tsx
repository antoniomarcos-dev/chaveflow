"use client";

import type { listDealsForOrg } from "@/application/deal-service";
import {
  ArrowRight,
  FileSpreadsheet,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { DealStatusBadge } from "./StatusBadge";

type BaseDealListItem = Awaited<ReturnType<typeof listDealsForOrg>>[number];

export interface EnrichedDealListItem extends BaseDealListItem {
  nextActionHeadline: string;
  nextActionAreaLabel: string;
  nextActionHasDirectAction: boolean;
}

export type StatusFilterId =
  | "TODAS"
  | "EM_ANDAMENTO"
  | "EXIGINDO_ACAO"
  | "PRONTA_AUTORIZACAO"
  | "AUTORIZADA_ENTREGA"
  | "ENTREGUE"
  | "RASCUNHO"
  | "CANCELADA";

const FILTER_DESCRIPTIONS: Record<StatusFilterId, string> = {
  TODAS: "Exibe todas as negociações visíveis para o seu perfil.",
  EM_ANDAMENTO:
    "Reúne todas as vendas ativas (em preparação, prontas para autorização ou já autorizadas aguardando entrega).",
  EXIGINDO_ACAO:
    "Subconjunto das negociações ativas que possuem pendências abertas, estão prontas para autorizar ou aguardam entrega física.",
  PRONTA_AUTORIZACAO:
    "Negociações que cumpriram 100% dos requisitos e aguardam a emissão da Autorização Formal de Liberação.",
  AUTORIZADA_ENTREGA:
    "Negociações com Autorização Formal ativa, aguardando apenas a entrega física das chaves ao comprador.",
  ENTREGUE: "Negociações encerradas com entrega física do veículo confirmada.",
  RASCUNHO: "Aberturas iniciadas e salvas como rascunho ainda sem fluxo ativo.",
  CANCELADA: "Negociações canceladas e encerradas sem entrega.",
};

function matchesStatusFilter(
  item: EnrichedDealListItem,
  filter: StatusFilterId,
): boolean {
  const { deal, summary } = item;
  if (filter === "TODAS") return true;
  if (filter === "EM_ANDAMENTO") {
    return (
      deal.status === "ACTIVE" ||
      deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      deal.status === "DELIVERY_AUTHORIZED"
    );
  }
  if (filter === "EXIGINDO_ACAO") {
    const isActive =
      deal.status === "ACTIVE" ||
      deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      deal.status === "DELIVERY_AUTHORIZED";
    return (
      isActive &&
      (summary.deliveryBlockers.length > 0 ||
        deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
        deal.status === "DELIVERY_AUTHORIZED")
    );
  }
  if (filter === "PRONTA_AUTORIZACAO") {
    return (
      deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      (summary.deliveryEligible && deal.status === "ACTIVE")
    );
  }
  if (filter === "AUTORIZADA_ENTREGA") {
    return deal.status === "DELIVERY_AUTHORIZED";
  }
  if (filter === "ENTREGUE") {
    return deal.status === "DELIVERED";
  }
  if (filter === "RASCUNHO") {
    return deal.status === "DRAFT";
  }
  if (filter === "CANCELADA") {
    return deal.status === "CANCELLED";
  }
  return true;
}

export function DealsListClient({
  deals,
  canCreate,
  initialSearch = "",
  initialStatus = "TODAS",
  initialResponsible = "TODOS",
}: {
  deals: EnrichedDealListItem[];
  canCreate: boolean;
  initialSearch?: string;
  initialStatus?: StatusFilterId;
  initialResponsible?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] =
    useState<StatusFilterId>(initialStatus);
  const [responsibleFilter, setResponsibleFilter] =
    useState<string>(initialResponsible);

  function buildFilterUrl(
    nextSearch: string,
    nextStatus: StatusFilterId,
    nextResp: string,
  ) {
    const params = new URLSearchParams();
    if (nextSearch.trim()) params.set("q", nextSearch.trim());
    if (nextStatus !== "TODAS") params.set("status", nextStatus);
    if (nextResp !== "TODOS") params.set("responsavel", nextResp);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function updateFilters(
    nextSearch: string,
    nextStatus: StatusFilterId,
    nextResp: string,
  ) {
    setSearch(nextSearch);
    setStatusFilter(nextStatus);
    setResponsibleFilter(nextResp);
    const url = buildFilterUrl(nextSearch, nextStatus, nextResp);
    router.replace(url, { scroll: false });
  }

  const sellers = Array.from(new Set(deals.map((d) => d.sellerName))).sort();

  const counts: Record<StatusFilterId, number> = {
    TODAS: deals.length,
    EM_ANDAMENTO: deals.filter((d) => matchesStatusFilter(d, "EM_ANDAMENTO"))
      .length,
    EXIGINDO_ACAO: deals.filter((d) => matchesStatusFilter(d, "EXIGINDO_ACAO"))
      .length,
    PRONTA_AUTORIZACAO: deals.filter((d) =>
      matchesStatusFilter(d, "PRONTA_AUTORIZACAO"),
    ).length,
    AUTORIZADA_ENTREGA: deals.filter((d) =>
      matchesStatusFilter(d, "AUTORIZADA_ENTREGA"),
    ).length,
    ENTREGUE: deals.filter((d) => matchesStatusFilter(d, "ENTREGUE")).length,
    RASCUNHO: deals.filter((d) => matchesStatusFilter(d, "RASCUNHO")).length,
    CANCELADA: deals.filter((d) => matchesStatusFilter(d, "CANCELADA")).length,
  };

  const filtered = deals.filter((item) => {
    const { deal, vehicle, customer, sellerName, nextActionAreaLabel } = item;

    if (!matchesStatusFilter(item, statusFilter)) return false;

    if (responsibleFilter !== "TODOS") {
      if (
        sellerName !== responsibleFilter &&
        nextActionAreaLabel !== responsibleFilter
      ) {
        return false;
      }
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = [
        deal.dealNumber,
        vehicle.internalCode,
        vehicle.brand,
        vehicle.model,
        vehicle.trim,
        vehicle.color,
        vehicle.vin,
        customer.fullName,
        customer.documentNumber,
        sellerName,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  const tabs: Array<{ id: StatusFilterId; label: string; count: number }> = [
    { id: "TODAS", label: "Todas", count: counts.TODAS },
    { id: "EM_ANDAMENTO", label: "Em andamento", count: counts.EM_ANDAMENTO },
    {
      id: "EXIGINDO_ACAO",
      label: "Exigindo ação",
      count: counts.EXIGINDO_ACAO,
    },
    {
      id: "PRONTA_AUTORIZACAO",
      label: "Pronta para autorização",
      count: counts.PRONTA_AUTORIZACAO,
    },
    {
      id: "AUTORIZADA_ENTREGA",
      label: "Autorizada aguardando entrega",
      count: counts.AUTORIZADA_ENTREGA,
    },
    { id: "ENTREGUE", label: "Entregue", count: counts.ENTREGUE },
    { id: "RASCUNHO", label: "Rascunho", count: counts.RASCUNHO },
    { id: "CANCELADA", label: "Cancelada", count: counts.CANCELADA },
  ];

  const currentListUrl = buildFilterUrl(
    search,
    statusFilter,
    responsibleFilter,
  );

  return (
    <div className="space-y-5">
      {/* Cabeçalho Compacto */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#172B3A]">
            Negociações
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Consulte vendas e acesse o Passaporte Digital de cada veículo.
          </p>
        </div>

        {canCreate && (
          <Link
            href="/app/negociacoes/nova"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#0B3B70] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Nova negociação</span>
          </Link>
        )}
      </div>

      {/* Barra de Busca e Filtros Claros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3.5">
        <div className="grid sm:grid-cols-[1fr_240px] gap-3">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) =>
                updateFilters(e.target.value, statusFilter, responsibleFilter)
              }
              aria-label="Pesquisar por número, cliente, modelo, código interno ou chassi"
              placeholder="Pesquisar por número, cliente, modelo, código interno ou chassi..."
              className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#172B3A]"
            />
          </div>

          <div>
            <label htmlFor="filter-responsible" className="sr-only">
              Filtrar por responsável
            </label>
            <select
              id="filter-responsible"
              value={responsibleFilter}
              onChange={(e) =>
                updateFilters(search, statusFilter, e.target.value)
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-[#172B3A]"
            >
              <option value="TODOS">Todos os responsáveis</option>
              {sellers.map((s) => (
                <option key={s} value={s}>
                  Vendedor: {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Filtros de situação da negociação"
          className="flex flex-wrap items-center gap-1.5 pt-1"
        >
          {tabs.map((t) => {
            const active = statusFilter === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() =>
                  updateFilters(search, t.id, responsibleFilter)
                }
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-[#0B3B70] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-[#EAF3FC] hover:text-[#0B3B70]"
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-700"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-600 border-t border-slate-100 pt-2">
          <strong>Filtro ativo:</strong> {FILTER_DESCRIPTIONS[statusFilter]}
        </p>
      </div>

      {/* Lista Compacta */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <FileSpreadsheet className="mx-auto h-9 w-9 text-[#1684D8]" />
          <h2>Nenhuma negociação encontrada</h2>
          <p>
            Ajuste a pesquisa ou escolha outro filtro de situação acima.
          </p>
          {(search ||
            statusFilter !== "TODAS" ||
            responsibleFilter !== "TODOS") && (
            <button
              type="button"
              onClick={() => updateFilters("", "TODAS", "TODOS")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-[#0B3B70] hover:bg-slate-50"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Tabela Compacta Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Negociação</th>
                  <th className="py-3 px-4">Veículo</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4">Responsável</th>
                  <th className="py-3 px-4">Próxima ação</th>
                  <th className="py-3 px-4 text-right">Passaporte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map(
                  ({
                    deal,
                    vehicle,
                    customer,
                    sellerName,
                    nextActionHeadline,
                    nextActionAreaLabel,
                    nextActionHasDirectAction,
                  }) => {
                    const passportHref =
                      deal.status === "DRAFT"
                        ? `/app/negociacoes/nova?draftId=${deal.id}`
                        : `/app/negociacoes/${deal.id}?from=${encodeURIComponent(
                            currentListUrl,
                          )}`;

                    return (
                      <tr
                        key={deal.id}
                        className="hover:bg-[#F4F7FA]/80 transition"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-[#0B3B70] bg-[#EAF3FC] px-2.5 py-1 rounded-md">
                            {deal.dealNumber}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#172B3A]">
                            {vehicle.brand} {vehicle.model}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            {vehicle.internalCode} • {vehicle.color}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#172B3A]">
                            {customer.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {deal.buyerType}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <DealStatusBadge status={deal.status} />
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#172B3A]">
                            {sellerName}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Área atual: {nextActionAreaLabel}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-semibold text-[#172B3A] truncate">
                            {nextActionHeadline}
                          </div>
                          {nextActionHasDirectAction && (
                            <span className="text-[11px] font-bold text-[#1684D8]">
                              Ação disponível para você
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Link
                            href={passportHref}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition ${
                              deal.status === "DRAFT"
                                ? "bg-amber-600 hover:bg-amber-700"
                                : "bg-[#0B3B70] hover:bg-[#1684D8]"
                            }`}
                          >
                            <span>
                              {deal.status === "DRAFT"
                                ? "Continuar rascunho"
                                : "Abrir passaporte"}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>

          {/* Cards Compactos para Celular */}
          <div className="lg:hidden divide-y divide-slate-200">
            {filtered.map(
              ({
                deal,
                vehicle,
                customer,
                sellerName,
                nextActionHeadline,
                nextActionAreaLabel,
              }) => {
                const passportHref =
                  deal.status === "DRAFT"
                    ? `/app/negociacoes/nova?draftId=${deal.id}`
                    : `/app/negociacoes/${deal.id}?from=${encodeURIComponent(
                        currentListUrl,
                      )}`;

                return (
                  <div key={deal.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold bg-[#EAF3FC] text-[#0B3B70] px-2.5 py-0.5 rounded">
                        {deal.dealNumber}
                      </span>
                      <DealStatusBadge status={deal.status} />
                    </div>

                    <div>
                      <h2 className="text-sm font-extrabold text-[#172B3A]">
                        {vehicle.brand} {vehicle.model} ({vehicle.color})
                      </h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Cliente: <strong>{customer.fullName}</strong> •
                        Responsável: {sellerName}
                      </p>
                      <p className="text-xs text-[#0B3B70] font-semibold mt-1">
                        Próxima ação ({nextActionAreaLabel}):{" "}
                        {nextActionHeadline}
                      </p>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Link
                        href={passportHref}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1684D8] px-4 py-2.5 text-xs font-bold text-white"
                      >
                        <span>
                          {deal.status === "DRAFT"
                            ? "Continuar rascunho"
                            : "Abrir passaporte"}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}
    </div>
  );
}
