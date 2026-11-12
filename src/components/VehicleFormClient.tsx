"use client";

import {
  Branch,
  VEHICLE_STOCK_STATUS_LABELS,
  Vehicle,
  VehicleStockStatus,
} from "@/domain/types";
import { AlertCircle, ArrowLeft, Car, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export function VehicleFormClient({
  branches,
  existingVehicle,
}: {
  branches: Branch[];
  existingVehicle?: Vehicle;
}) {
  const router = useRouter();
  const [internalCode, setInternalCode] = useState(
    existingVehicle?.internalCode || "",
  );
  const [vin, setVin] = useState(existingVehicle?.vin || "");
  const [brand, setBrand] = useState(existingVehicle?.brand || "");
  const [model, setModel] = useState(existingVehicle?.model || "");
  const [trim, setTrim] = useState(existingVehicle?.trim || "");
  const [manufacturingYear, setManufacturingYear] = useState(
    existingVehicle?.manufacturingYear || new Date().getFullYear(),
  );
  const [modelYear, setModelYear] = useState(
    existingVehicle?.modelYear || new Date().getFullYear(),
  );
  const [color, setColor] = useState(existingVehicle?.color || "");
  const [plate, setPlate] = useState(existingVehicle?.plate || "");
  const [condition, setCondition] = useState<"NEW" | "USED">(
    existingVehicle?.condition || "NEW",
  );
  const [branchId, setBranchId] = useState(
    existingVehicle?.branchId || branches[0]?.id || "",
  );
  const [stockStatus, setStockStatus] = useState<VehicleStockStatus>(
    existingVehicle?.stockStatus || "AVAILABLE",
  );
  const [entryDate, setEntryDate] = useState(
    existingVehicle?.entryDate || new Date().toLocaleDateString("en-CA"),
  );
  const [internalNotes, setInternalNotes] = useState(
    existingVehicle?.internalNotes || "",
  );

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_OR_UPDATE",
          vehicleId: existingVehicle?.id,
          input: {
            internalCode,
            vin,
            brand,
            model,
            trim,
            manufacturingYear,
            modelYear,
            color,
            plate: plate.trim() || null,
            condition,
            branchId,
            photos: existingVehicle?.photos || ["/vehicle-placeholder.svg"],
            stockStatus,
            entryDate,
            internalNotes: internalNotes.trim() || null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        // Preserva todos os dados preenchidos no estado do formulário em caso de erro
        setError(data.error || "Não foi possível salvar o veículo.");
        return;
      }
      router.push(`/app/veiculos/${data.vehicle.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/app/veiculos"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Veículos e Estoque</span>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <div className="h-10 w-10 rounded-xl bg-[#0B3B70] flex items-center justify-center text-white">
            <Car className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#172B3A]">
              {existingVehicle
                ? `Editar Veículo ${existingVehicle.internalCode}`
                : "Novo Cadastro de Veículo no Estoque"}
            </h1>
            <p className="text-xs text-slate-500">
              Os atributos são recuperados do cadastro da concessionária (sem
              tentar deduzir atributos pelo chassi).
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-300 p-4 text-xs text-red-900 flex items-start gap-2.5"
          >
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Não foi possível salvar o cadastro</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Identificador Interno *
              </label>
              <input
                type="text"
                required
                value={internalCode}
                onChange={(e) => setInternalCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Chassi (VIN — único na organização) *
              </label>
              <input
                type="text"
                required
                maxLength={17}
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                placeholder="Ex: 9BWSU19F08B309999"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Marca *
              </label>
              <input
                type="text"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Modelo *
              </label>
              <input
                type="text"
                required
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Versão / Motorização *
              </label>
              <input
                type="text"
                required
                value={trim}
                onChange={(e) => setTrim(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Ano de Fabricação *
              </label>
              <input
                type="number"
                required
                value={manufacturingYear}
                onChange={(e) => setManufacturingYear(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Ano do Modelo *
              </label>
              <input
                type="number"
                required
                value={modelYear}
                onChange={(e) => setModelYear(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Cor *
              </label>
              <input
                type="text"
                required
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Placa (quando aplicável)
              </label>
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="Deixe vazio se 0km sem emplacamento"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Condição *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as "NEW" | "USED")}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="NEW">Novo (0km)</option>
                <option value="USED">Usado / Seminovo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Unidade *
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Situação no Estoque *
              </label>
              <select
                value={stockStatus}
                onChange={(e) =>
                  setStockStatus(e.target.value as VehicleStockStatus)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                {(
                  Object.keys(
                    VEHICLE_STOCK_STATUS_LABELS,
                  ) as VehicleStockStatus[]
                ).map((st) => (
                  <option key={st} value={st}>
                    {VEHICLE_STOCK_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Data de Entrada no Estoque *
              </label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Observações Internas (Restritas à equipe da concessionária)
              </label>
              <textarea
                rows={3}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <Link
              href="/app/veiculos"
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition"
            >
              <Save className="h-4 w-4" />
              <span>
                {saving
                  ? "Salvando..."
                  : existingVehicle
                    ? "Salvar Alterações"
                    : "Cadastrar Veículo e Gerar QR Code"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
