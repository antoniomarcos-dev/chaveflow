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

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
            Gestão de Pátio e Showroom
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
            Veículos e Estoque ({filtered.length})
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            O cadastro do veículo é permanente; cada negociação possui seu
            próprio passaporte e histórico.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canManageVehicles && (
            <>
              <button
                type="button"
                onClick={() => setShowCsvPanel((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800 transition"
              >
                <FileUp className="h-4 w-4 text-teal-600" />
                <span>Importar CSV</span>
              </button>
              <Link
                href="/app/veiculos/novo"
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition"
              >
                <Plus className="h-4 w-4" />
                <span>Cadastrar Veículo</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Painel de Importação CSV com Prévia, Validação e Relatório de Erros */}
      {showCsvPanel && canManageVehicles && (
        <section className="bg-white rounded-2xl border-2 border-teal-500 p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
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
              className="text-xs font-semibold text-slate-500 hover:text-slate-900"
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900"
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
                Conteúdo CSV (inclui exemplo válido + exemplo de chassi
                duplicado para testar validação)
              </label>
              <textarea
                rows={4}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-xs font-mono text-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={csvLoading}
              onClick={() => handleCsvAction(false)}
              className="rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white"
            >
              1. Gerar Prévia e Validar Linhas
            </button>
            <button
              type="button"
              disabled={csvLoading || !csvReport || csvReport.validCount === 0}
              onClick={() => handleCsvAction(true)}
              className="rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              2. Confirmar Importação das Linhas Válidas (
              {csvReport?.validCount ?? 0})
            </button>
          </div>

          {csvReport && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                <span className="text-slate-800">
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

      {/* Filtros e Busca */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs grid sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6 relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por chassi, código interno, placa, modelo ou cor..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3.5 py-2 text-xs sm:text-sm text-slate-900"
          />
        </div>
        <div className="sm:col-span-3">
          <select
            aria-label="Filtrar por unidade"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-900"
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-900"
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

      {/* Grade de Veículos */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
          <Car className="h-8 w-8 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-800">
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
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
            >
              <div>
                <div className="relative h-40 bg-slate-900">
                  <img
                    src={v.photos[0] || "/vehicle-placeholder.svg"}
                    alt={`${v.brand} ${v.model}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="rounded-md bg-slate-950/90 border border-slate-700 px-2.5 py-1 font-mono text-xs font-bold text-white">
                      {v.internalCode}
                    </span>
                    <span className="rounded-md bg-teal-600/95 px-2 py-1 text-[11px] font-bold text-white">
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
                    <h2 className="text-base font-extrabold text-slate-900">
                      {v.brand} {v.model} • {v.color}
                    </h2>
                    <p className="text-xs text-slate-600">
                      {v.trim} • Ano {v.manufacturingYear}/{v.modelYear}
                    </p>
                  </div>

                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Chassi (VIN):</span>
                      <code className="font-mono font-bold text-slate-900">
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
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-50/60 border border-blue-200 p-2">
                        <span className="font-mono text-xs font-bold text-blue-950">
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

              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                <Link
                  href={`/app/veiculos/${v.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-teal-700"
                >
                  <QrCode className="h-3.5 w-3.5 text-teal-600" />
                  <span>Ficha, Histórico & Etiqueta QR</span>
                </Link>

                {v.activeDeal ? (
                  <Link
                    href={`/app/negociacoes/${v.activeDeal.id}`}
                    className="rounded-lg bg-[#0f172a] hover:bg-slate-800 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Abrir Passaporte →
                  </Link>
                ) : (
                  canCreateDeal && (
                    <Link
                      href={`/app/negociacoes/nova?vehicleId=${v.id}`}
                      className="rounded-lg bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      + Iniciar Venda
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
