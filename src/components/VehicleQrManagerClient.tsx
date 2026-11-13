"use client";

import type { VehicleWithDealStatus } from "@/application/vehicle-service";
import type { Branch } from "@/domain/types";
import { apiRequest } from "@/lib/api-client";
import { normalizeSearch } from "@/lib/format";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Printer,
  QrCode,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StockStatusBadge } from "./StatusBadge";
import { VehicleQrLabel, type GeneratedVehicleQr } from "./VehicleQrLabel";

export function VehicleQrManagerClient({
  vehicles,
  branches,
  initialVehicleId,
}: {
  vehicles: VehicleWithDealStatus[];
  branches: Branch[];
  initialVehicleId?: string;
}) {
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("ALL");
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        vehicles.some((v) => v.id === initialVehicleId)
          ? [initialVehicleId!]
          : [],
      ),
  );
  const [labels, setLabels] = useState<GeneratedVehicleQr[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtered = vehicles.filter(
    (v) =>
      (branch === "ALL" || branch === v.branchId) &&
      normalizeSearch(
        `${v.internalCode} ${v.brand} ${v.model} ${v.color} ${v.vin} ${v.plate || ""}`,
      ).includes(normalizeSearch(search)),
  );

  function toggle(id: string) {
    setError(null);
    if (!selected.has(id) && selected.size >= 40) {
      setError(
        "Selecione até 40 carros por vez. Gere estas etiquetas antes de selecionar o próximo grupo.",
      );
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function generate() {
    if (busy || !selected.size) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiRequest<{ labels: GeneratedVehicleQr[] }>(
        "/api/vehicles",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "GENERATE_QR_LABELS",
            vehicleIds: [...selected],
          }),
        },
      );
      setLabels(result.labels);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível gerar as etiquetas.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="page-heading no-print">
        <div>
          <span className="eyebrow">Gestão de veículos</span>
          <h1>Gerar QR Code</h1>
          <p>
            Selecione os carros, confira as etiquetas e imprima para colocar em
            cada veículo.
          </p>
        </div>
        <Link
          href="/app/escanear"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold"
        >
          <QrCode className="h-4 w-4" />
          Abrir leitor
        </Link>
      </div>
      <ol
        className="no-print grid gap-3 text-sm sm:grid-cols-3"
        aria-label="Etapas para gerar etiquetas"
      >
        {[
          "Selecione os veículos",
          "Gere e confira as etiquetas",
          "Imprima ou baixe o QR Code",
        ].map((step, i) => (
          <li
            key={step}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF3FC] font-bold text-[#0B3B70]">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      {error && (
        <div
          role="alert"
          className="no-print flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}
      {vehicles.length === 0 ? (
        <div className="empty-state no-print">
          <QrCode className="mx-auto h-10 w-10 text-slate-400" />
          <h2>Cadastre o primeiro carro</h2>
          <p>
            As etiquetas ficam disponíveis assim que o veículo é cadastrado.
          </p>
          <Link
            href="/app/veiculos/novo"
            className="inline-flex min-h-11 items-center rounded-xl bg-[#1684D8] px-5 text-sm font-bold text-white"
          >
            Cadastrar veículo
          </Link>
        </div>
      ) : (
        <section
          className="no-print space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
          aria-label="Selecionar veículos"
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div>
              <label
                htmlFor="qr-search"
                className="mb-1 block text-sm font-semibold"
              >
                Buscar veículo
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"
                />
                <input
                  id="qr-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Modelo, placa, chassi ou código"
                  className="form-control pl-10"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="qr-branch"
                className="mb-1 block text-sm font-semibold"
              >
                Unidade
              </label>
              <select
                id="qr-branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="form-control"
              >
                <option value="ALL">Todas as unidades</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <p role="status" className="text-sm text-slate-600">
              {filtered.length} encontrado(s) ·{" "}
              <strong>{selected.size} selecionado(s)</strong>
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSelected(new Set(filtered.slice(0, 40).map((v) => v.id)));
                  setError(null);
                }}
                className="min-h-11 text-sm font-semibold text-[#0B3B70]"
              >
                Selecionar até 40 exibidos
              </button>
              <button
                type="button"
                disabled={busy || !selected.size}
                onClick={() => setSelected(new Set())}
                className="min-h-11 text-sm font-semibold text-slate-600 disabled:opacity-50"
              >
                Limpar seleção
              </button>
            </div>
          </div>
          <fieldset
            disabled={busy}
            className="grid max-h-[480px] gap-3 overflow-y-auto sm:grid-cols-2"
          >
            <legend className="sr-only">
              Veículos disponíveis para etiquetar
            </legend>
            {filtered.map((v) => (
              <label
                key={v.id}
                className={`flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border p-4 ${selected.has(v.id) ? "border-[#1684D8] bg-[#EAF3FC]" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(v.id)}
                  onChange={() => toggle(v.id)}
                  className="h-5 w-5 shrink-0 accent-[#1684D8]"
                  aria-label={`Selecionar ${v.internalCode}`}
                />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-bold">
                    {v.internalCode} · {v.brand} {v.model}
                  </p>
                  <p className="break-all text-xs text-slate-600">
                    {v.color} · {v.plate || v.vin}
                  </p>
                  <StockStatusBadge status={v.stockStatus} />
                </div>
              </label>
            ))}
          </fieldset>
          {filtered.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-600">
                Nenhum carro corresponde à busca.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setBranch("ALL");
                }}
                className="min-h-11 text-sm font-semibold text-[#0B3B70]"
              >
                Limpar filtros
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">
              O mesmo carro mantém seu QR Code ao reimprimir a etiqueta.
            </p>
            <button
              type="button"
              onClick={generate}
              disabled={busy || !selected.size}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1684D8] px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              {busy
                ? "Gerando etiquetas…"
                : `Gerar ${selected.size || ""} etiqueta(s)`}
            </button>
          </div>
        </section>
      )}
      {labels.length > 0 && (
        <section className="space-y-4" aria-label="Etiquetas geradas">
          <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div
              role="status"
              className="flex items-center gap-2 text-sm font-semibold text-emerald-900"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              {labels.length} etiqueta(s) pronta(s). Confira os carros antes de
              imprimir.
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0B3B70] px-5 text-sm font-bold text-white"
            >
              <Printer className="h-4 w-4" />
              Imprimir etiquetas
            </button>
          </div>
          <div className="qr-print-area qr-label-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {labels.map((label) => {
              const vehicle = vehicles.find((v) => v.id === label.vehicleId);
              return vehicle ? (
                <VehicleQrLabel
                  key={label.vehicleId}
                  vehicle={vehicle}
                  label={label}
                />
              ) : null;
            })}
          </div>
        </section>
      )}
    </div>
  );
}
