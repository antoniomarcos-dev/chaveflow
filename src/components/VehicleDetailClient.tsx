"use client";

import type { VehicleWithDealStatus } from "@/application/vehicle-service";
import { Branch, Deal } from "@/domain/types";
import { formatDateBr, formatDateTimeBr } from "@/lib/format";
import {
  ArrowLeft,
  ArrowRight,
  Edit3,
  FileSpreadsheet,
  History,
  PlusCircle,
  Printer,
  QrCode,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DealStatusBadge, StockStatusBadge } from "./StatusBadge";
import { VehicleFormClient } from "./VehicleFormClient";

export function VehicleDetailClient({
  vehicle,
  dealHistory,
  branches,
  canManageVehicles,
  canCreateDeal,
}: {
  vehicle: VehicleWithDealStatus;
  dealHistory: Array<{
    id: string;
    dealNumber: string;
    status: Deal["status"];
    currentStage: Deal["currentStage"];
    customerName: string;
    sellerName: string;
    createdAt: string;
    updatedAt: string;
  }>;
  branches: Branch[];
  canManageVehicles: boolean;
  canCreateDeal: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "GENERATE_QR_SVG",
        payload: `cf://v/${vehicle.qrToken}`,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (active && d.ok && d.svg) {
          setQrSvg(d.svg);
        }
      });
    return () => {
      active = false;
    };
  }, [vehicle.qrToken]);

  if (editing) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          ← Cancelar edição
        </button>
        <VehicleFormClient branches={branches} existingVehicle={vehicle} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Navegação Superior */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app/veiculos"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Veículos e Estoque</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          {canManageVehicles && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800"
            >
              <Edit3 className="h-3.5 w-3.5 text-teal-600" />
              <span>Editar Cadastro</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f172a] hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-white"
          >
            <Printer className="h-3.5 w-3.5 text-teal-400" />
            <span>Imprimir Etiqueta QR Code</span>
          </button>
        </div>
      </div>

      {/* Card Principal do Veículo + Etiqueta QR Code */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2.5 py-1 rounded">
                {vehicle.internalCode}
              </span>
              <span className="text-xs font-bold bg-teal-50 text-teal-900 border border-teal-200 px-2.5 py-1 rounded">
                {vehicle.condition === "NEW"
                  ? "Novo / 0km"
                  : "Usado / Seminovo"}
              </span>
            </div>
            <StockStatusBadge status={vehicle.stockStatus} />
          </div>

          <div className="grid sm:grid-cols-12 gap-5 items-center">
            <div className="sm:col-span-5">
              <img
                src={vehicle.photos[0] || "/vehicle-placeholder.svg"}
                alt={`${vehicle.brand} ${vehicle.model}`}
                className="w-full rounded-xl border border-slate-200"
              />
            </div>
            <div className="sm:col-span-7 space-y-2">
              <h1 className="text-2xl font-extrabold text-slate-900">
                {vehicle.brand} {vehicle.model}
              </h1>
              <p className="text-sm font-medium text-slate-600">
                {vehicle.trim} • Cor: <strong>{vehicle.color}</strong>
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                  <span className="text-slate-500 block">Chassi (VIN):</span>
                  <code className="font-mono font-bold text-slate-900">
                    {vehicle.vin}
                  </code>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                  <span className="text-slate-500 block">Ano Fab/Mod:</span>
                  <strong className="text-slate-900">
                    {vehicle.manufacturingYear}/{vehicle.modelYear}
                  </strong>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                  <span className="text-slate-500 block">Placa:</span>
                  <strong className="font-mono text-slate-900">
                    {vehicle.plate || "Sem placa (0km)"}
                  </strong>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                  <span className="text-slate-500 block">Entrada Estoque:</span>
                  <strong className="text-slate-900">
                    {formatDateBr(vehicle.entryDate)}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {vehicle.internalNotes && (
            <div className="no-print rounded-xl bg-amber-50/70 border border-amber-200 p-3.5 text-xs text-amber-950">
              <span className="font-bold block">
                Observações Internas do Estoque (Restritas):
              </span>
              <p className="mt-0.5">{vehicle.internalNotes}</p>
            </div>
          )}

          {/* Vínculo de Negociação Ativa */}
          <div className="no-print pt-3 border-t border-slate-200">
            {vehicle.activeDeal ? (
              <div className="rounded-xl bg-teal-50 border border-teal-300 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-teal-700" />
                    <span>
                      Negociação Ativa Vinculada:{" "}
                      {vehicle.activeDeal.dealNumber}
                    </span>
                  </div>
                  <p className="text-xs text-teal-800 mt-0.5">
                    Garantia do banco: o veículo não pode ter outra negociação
                    ativa simultânea.
                  </p>
                </div>
                <Link
                  href={`/app/negociacoes/${vehicle.activeDeal.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-xs font-bold text-white shrink-0"
                >
                  <span>Abrir Passaporte Digital</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Veículo sem negociação ativa no momento
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Disponível para iniciar um novo Passaporte Digital.
                  </p>
                </div>
                {canCreateDeal && (
                  <Link
                    href={`/app/negociacoes/nova?vehicleId=${vehicle.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-xs font-bold text-white shrink-0"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>Iniciar Abertura Guiada</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Etiqueta QR Code Interna para Impressão */}
        <div className="lg:col-span-4 bg-white rounded-2xl border-2 border-slate-900 p-6 shadow-xs flex flex-col items-center justify-between text-center space-y-3">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
              <QrCode className="h-3 w-3" />
              Etiqueta Interna ChaveFlow
            </span>
            <h2 className="text-base font-extrabold text-slate-900">
              {vehicle.internalCode}
            </h2>
            <p className="text-xs text-slate-600">
              {vehicle.brand} {vehicle.model} ({vehicle.color})
            </p>
          </div>

          {qrSvg ? (
            <div
              className="w-44 h-44 border border-slate-200 rounded-xl p-2"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : (
            <div className="w-44 h-44 flex items-center justify-center bg-slate-100 rounded-xl text-xs text-slate-500">
              Gerando QR Code...
            </div>
          )}

          <div className="space-y-1 text-[11px] text-slate-500">
            <div className="font-mono font-bold text-slate-800">
              cf://v/{vehicle.qrToken}
            </div>
            <p>
              Identificador opaco seguro. Não contém dados pessoais, documentos
              ou autorização.
            </p>
          </div>
        </div>
      </div>

      {/* Histórico Permanente de Negociações do Veículo */}
      <section className="no-print bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-teal-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Histórico de Negociações deste Veículo ({dealHistory.length})
            </h2>
            <p className="text-xs text-slate-500">
              Cada negociação mantém seu próprio passaporte, documentos e
              histórico imutável.
            </p>
          </div>
        </div>

        {dealHistory.length === 0 ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 text-center text-xs text-slate-500">
            Nenhuma negociação registrada para este veículo até o momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
            {dealHistory.map((dh) => (
              <div
                key={dh.id}
                className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {dh.dealNumber}
                    </span>
                    <DealStatusBadge status={dh.status} />
                  </div>
                  <p className="text-xs text-slate-600">
                    Comprador: <strong>{dh.customerName}</strong> • Vendedor:{" "}
                    {dh.sellerName}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Aberta em {formatDateTimeBr(dh.createdAt)} • Atualizada em{" "}
                    {formatDateTimeBr(dh.updatedAt)}
                  </p>
                </div>

                <Link
                  href={`/app/negociacoes/${dh.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white"
                >
                  <span>Consultar Passaporte</span>
                  <ArrowRight className="h-3.5 w-3.5 text-teal-400" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
