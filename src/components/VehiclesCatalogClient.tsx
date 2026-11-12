"use client";

import type {
  CsvImportResult,
  VehicleWithDealStatus,
} from "@/application/vehicle-service";
import {
  Branch,
  VEHICLE_STOCK_STATUS_LABELS,
  VehicleStockStatus,
} from "@/domain/types";
import { formatDateBr } from "@/lib/format";
import {
  AlertCircle,
  Car,
  CheckCircle2,
  FileUp,
  Plus,
  QrCode,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DealStatusBadge, StockStatusBadge } from "./StatusBadge";

export function VehiclesCatalogClient({
  vehicles,
  branches,
  canManageVehicles,
  canCreateDeal,
}: {
  vehicles: VehicleWithDealStatus[];
  branches: Branch[];
  canManageVehicles: boolean;
  canCreateDeal: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<VehicleStockStatus | "ALL">(
    "ALL",
  );
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [csvText, setCsvText] = useState(
    "codigo_interno;chassi;marca;modelo;versao;ano_fab;ano_mod;cor;condicao;placa;data_entrada;observacoes",
  );
  const [csvBranchId, setCsvBranchId] = useState(branches[0]?.id || "");
  const [csvReport, setCsvReport] = useState<CsvImportResult | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const filtered = vehicles.filter((v) => {
    if (branchFilter !== "ALL" && v.branchId !== branchFilter) return false;
    if (statusFilter !== "ALL" && v.stockStatus !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${v.internalCode} ${v.vin} ${v.brand} ${v.model} ${v.trim} ${
        v.color
      } ${v.plate || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  async function handleCsvAction(commit: boolean) {
    setCsvError(null);
    setCsvLoading(true);
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CSV_IMPORT",
          csvText,
          branchId: csvBranchId,
          commit,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCsvError(data.error || "Falha ao processar CSV.");
      } else {
        setCsvReport(data.report);
        if (commit) {
          router.refresh();
        }
      }
    } finally {
      setCsvLoading(false);
    }
  }

  const countsByStatus = {
    ALL: vehicles.filter((v) => branchFilter === "ALL" || v.branchId === branchFilter).length,
    AVAILABLE: vehicles.filter(
      (v) =>
        (branchFilter === "ALL" || v.branchId === branchFilter) &&
        v.stockStatus === "AVAILABLE",
    ).length,
    RESERVED: vehicles.filter(
      (v) =>
        (branchFilter === "ALL" || v.branchId === branchFilter) &&
        v.stockStatus === "RESERVED",
    ).length,
    IN_PREPARATION: vehicles.filter(
      (v) =>
        (branchFilter === "ALL" || v.branchId === branchFilter) &&
        v.stockStatus === "IN_PREPARATION",
    ).length,
    SOLD_DELIVERED: vehicles.filter(
      (v) =>
        (branchFilter === "ALL" || v.branchId === branchFilter) &&
        v.stockStatus === "SOLD_DELIVERED",
    ).length,
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho (4.5 Veículos e Estoque) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#1684D8]">
            Gestão de Pátio e Showroom
          </span>
          <h1 className="text-2xl font-extrabold text-[#172B3A] mt-1">
            Veículos (Estoque) ({filtered.length})
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Gerencie o estoque e as informações permanentes dos veículos; cada negociação possui seu próprio passaporte e histórico.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/app/escanear"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-[#172B3A] transition"
          >
            <QrCode className="h-4 w-4 text-[#1684D8]" />
            <span>Etiquetas QR e Leitor</span>
          </Link>
          {canManageVehicles && (
            <>
              <button
                type="button"
                onClick={() => setShowCsvPanel((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-[#172B3A] transition"
              >
                <FileUp className="h-4 w-4 text-[#1684D8]" />
                <span>Importar CSV</span>
              </button>
              <Link
                href="/app/veiculos/novo"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition"
              >
                <Plus className="h-4 w-4" />
                <span>Cadastrar veículo</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Painel de Importação CSV com Prévia, Validação e Relatório de Erros */}
      {showCsvPanel && canManageVehicles && (
        <section className="bg-white rounded-2xl border-2 border-[#1684D8] p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#172B3A]">
                Importação de Estoque em Lote (CSV com Prévia e Validação)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Formato das colunas:{" "}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                  codigo_interno;chassi;marca;modelo;versao;ano_fab;ano_mod;cor;condicao;placa;data_entrada;observacoes
                </code>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCsvPanel(false)}
              className="text-xs font-semibold text-slate-500 hover:text-[#172B3A]"
            >
              Fechar
            </button>
          </div>

          {csvError && (
            <div className="rounded-lg bg-red-50 border border-red-300 p-3 text-xs text-red-900">
              {csvError}
            </div>
          )}

          <div className="grid sm:grid-cols-12 gap-4">
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700">
                Unidade de destino
              </label>
              <select
                value={csvBranchId}
                onChange={(e) => setCsvBranchId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-[#172B3A]"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-12">
              <label className="block text-xs font-semibold text-slate-700">
                Linhas do arquivo CSV (separadas por ponto e vírgula)
              </label>
              <textarea
                rows={4}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-xs font-mono text-[#172B3A]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={csvLoading}
              onClick={() => handleCsvAction(false)}
              className="rounded-lg bg-[#0B3B70] hover:bg-[#082B54] px-4 py-2 text-xs font-bold text-white"
            >
              1. Gerar Prévia e Validar Linhas
            </button>
            <button
              type="button"
              disabled={csvLoading || !csvReport || csvReport.validCount === 0}
              onClick={() => handleCsvAction(true)}
              className="rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              2. Confirmar Importação das Linhas Válidas (
              {csvReport?.validCount ?? 0})
            </button>
          </div>

          {csvReport && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                <span className="text-[#172B3A]">
                  Total de linhas: {csvReport.totalRows}
                </span>
                <span className="text-emerald-700">
                  Válidas: {csvReport.validCount}
                </span>
                <span className="text-red-700">
                  Com erro / Duplicadas: {csvReport.errorCount}
                </span>
                {csvReport.mode === "COMMIT" && (
                  <span className="rounded bg-emerald-100 text-emerald-900 px-2.5 py-0.5">
                    Importados no banco: {csvReport.importedCount}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {csvReport.rows.map((r) => (
                  <div
                    key={r.rowNumber}
                    className={`rounded-lg border p-3 text-xs ${
                      r.valid
                        ? "bg-emerald-50/50 border-emerald-200 text-emerald-950"
                        : "bg-red-50/70 border-red-300 text-red-950"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        {r.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        Linha #{r.rowNumber}:{" "}
                        {r.parsedVehicle
                          ? `${r.parsedVehicle.internalCode} — ${r.parsedVehicle.brand} ${r.parsedVehicle.model} (${r.parsedVehicle.vin})`
                          : r.rawLine}
                      </span>
                      <span>{r.valid ? "VÁLIDA" : "IMPEDIDA"}</span>
                    </div>
                    {r.errors.length > 0 && (
                      <ul className="mt-1 list-disc list-inside text-red-800 space-y-0.5">
                        {r.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Filtros e Busca (Tela 4 da prancha) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-4">
        <div className="grid sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por modelo, placa, chassi, código interno ou cor..."
              className="w-full rounded-xl border border-slate-300 bg-[#F4F7FA]/60 focus:bg-white pl-9 pr-3.5 py-2 text-xs sm:text-sm text-[#172B3A]"
            />
          </div>
          <div className="sm:col-span-3">
            <select
              aria-label="Filtrar por unidade"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-[#172B3A]"
            >
              <option value="ALL">Todas as unidades</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <select
              aria-label="Filtrar por disponibilidade no estoque"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as VehicleStockStatus | "ALL")
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-[#172B3A]"
            >
              <option value="ALL">Todas as situações de estoque</option>
              {(
                Object.keys(VEHICLE_STOCK_STATUS_LABELS) as VehicleStockStatus[]
              ).map((st) => (
                <option key={st} value={st}>
                  {VEHICLE_STOCK_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Abas rápidas de disponibilidade (conforme prancha 4. Veículos) */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          {(
            [
              { key: "ALL", label: "Todos", count: countsByStatus.ALL },
              {
                key: "AVAILABLE",
                label: "Disponíveis",
                count: countsByStatus.AVAILABLE,
              },
              {
                key: "RESERVED",
                label: "Em negociação / Reservados",
                count: countsByStatus.RESERVED,
              },
              {
                key: "IN_PREPARATION",
                label: "Em preparação",
                count: countsByStatus.IN_PREPARATION,
              },
              {
                key: "SOLD_DELIVERED",
                label: "Liberados / Entregues",
                count: countsByStatus.SOLD_DELIVERED,
              },
            ] as const
          ).map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-[#EAF3FC] text-[#0B3B70] border border-[#1684D8]/30"
                    : "text-slate-600 hover:bg-slate-100 hover:text-[#172B3A]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                    active
                      ? "bg-[#1684D8] text-white"
                      : "bg-slate-200/80 text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grade de Veículos */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
          <Car className="h-8 w-8 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-[#172B3A]">
            Nenhum veículo encontrado com os filtros aplicados
          </p>
          <p className="text-xs text-slate-500">
            Ajuste os termos da busca ou cadastre um novo veículo no estoque.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs flex flex-col justify-between hover:border-[#1684D8]/50 transition"
            >
              <div>
                <div className="relative h-40 bg-[#0B3B70]">
                  <img
                    src={v.photos[0] || "/vehicle-placeholder.svg"}
                    alt={`${v.brand} ${v.model}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="rounded-md bg-[#0B3B70]/95 border border-white/20 px-2.5 py-1 font-mono text-xs font-bold text-white">
                      {v.internalCode}
                    </span>
                    <span className="rounded-md bg-[#1684D8]/95 px-2 py-1 text-[11px] font-bold text-white">
                      {v.condition === "NEW" ? "0km / Novo" : "Seminovo"}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Situação do Estoque:
                    </span>
                    <StockStatusBadge status={v.stockStatus} />
                  </div>

                  <div>
                    <h2 className="text-base font-extrabold text-[#172B3A]">
                      {v.brand} {v.model} • {v.color}
                    </h2>
                    <p className="text-xs text-slate-600">
                      {v.trim} • Ano {v.manufacturingYear}/{v.modelYear}
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#F4F7FA] border border-slate-200 p-2.5 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Chassi (VIN):</span>
                      <code className="font-mono font-bold text-[#172B3A]">
                        {v.vin}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Placa:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {v.plate || "Sem placa (0km)"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Entrada:</span>
                      <span className="text-slate-800">
                        {formatDateBr(v.entryDate)}
                      </span>
                    </div>
                  </div>

                  {/* Situação da Negociação Separada da Situação do Estoque */}
                  <div className="pt-1">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1">
                      Situação da Negociação Vinculada:
                    </div>
                    {v.activeDeal ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-[#EAF3FC]/70 border border-[#1684D8]/30 p-2">
                        <span className="font-mono text-xs font-bold text-[#0B3B70]">
                          {v.activeDeal.dealNumber}
                        </span>
                        <DealStatusBadge status={v.activeDeal.status} />
                      </div>
                    ) : (
                      <div className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs text-slate-600 font-medium">
                        Nenhuma negociação ativa ({v.totalDealsCount} histórico)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-5 py-3.5 bg-[#F4F7FA] border-t border-slate-200 flex items-center justify-between gap-2">
                <Link
                  href={`/app/veiculos/${v.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#172B3A] hover:text-[#1684D8]"
                >
                  <QrCode className="h-3.5 w-3.5 text-[#1684D8]" />
                  <span>Ficha, Histórico & Etiqueta QR</span>
                </Link>

                {v.activeDeal ? (
                  <Link
                    href={`/app/negociacoes/${v.activeDeal.id}`}
                    className="rounded-lg bg-[#0B3B70] hover:bg-[#1684D8] px-3 py-1.5 text-xs font-bold text-white transition"
                  >
                    Abrir Passaporte →
                  </Link>
                ) : v.stockStatus === "AVAILABLE" && canCreateDeal ? (
                  <Link
                    href={`/app/negociacoes/nova?vehicleId=${v.id}`}
                    className="rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-3 py-1.5 text-xs font-bold text-white transition"
                  >
                    + Iniciar Venda
                  </Link>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-500">
                    {VEHICLE_STOCK_STATUS_LABELS[v.stockStatus]}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
