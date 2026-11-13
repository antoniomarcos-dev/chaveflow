"use client";

import type { VehicleWithDealStatus } from "@/application/vehicle-service";
import { Branch, Deal } from "@/domain/types";
import { formatDateBr, formatDateTimeBr } from "@/lib/format";
import { apiRequest } from "@/lib/api-client";
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
import { useSearchParams } from "next/navigation";
import { VehicleQrLabel, type GeneratedVehicleQr } from "./VehicleQrLabel";
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
  const [qrLabel, setQrLabel] = useState<GeneratedVehicleQr | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrAttempt, setQrAttempt] = useState(0);
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setQrError(null);
    setQrLabel(null);
    apiRequest<GeneratedVehicleQr>("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "GENERATE_QR_SVG",
        vehicleId: vehicle.id,
      }),
      signal: controller.signal,
    })
      .then((d) => {
        if (active) setQrLabel(d);
      })
      .catch((reason) => {
        if (active)
          setQrError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível gerar o QR Code.",
          );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [vehicle.id, qrAttempt]);

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
        <VehicleFormClient
          branches={branches}
          existingVehicle={vehicle}
          lockedIdentity={Boolean(vehicle.activeDeal)}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {searchParams.get("saved") === "1" && (
        <div
          role="status"
          className="no-print rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          <strong>Veículo salvo com sucesso.</strong> Confira a foto e os dados.{" "}
          {qrLabel
            ? "A etiqueta QR Code está pronta para imprimir."
            : "A etiqueta QR Code aparecerá ao lado do cadastro."}
        </div>
      )}
      {/* Navegação Superior */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app/veiculos"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#172B3A]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Veículos e Estoque</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          {canManageVehicles && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-[#172B3A]"
            >
              <Edit3 className="h-3.5 w-3.5 text-[#1684D8]" />
              <span>Editar Cadastro</span>
            </button>
          )}
          <button
            type="button"
            disabled={!qrLabel}
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B3B70] hover:bg-[#1684D8] px-3.5 py-2 text-xs font-bold text-white transition"
          >
            <Printer className="h-3.5 w-3.5 text-[#7CC4FA]" />
            <span>Imprimir Etiqueta QR Code</span>
          </button>
        </div>
      </div>

      {/* Card Principal do Veículo + Etiqueta QR Code */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="no-print lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-[#0B3B70] text-white px-2.5 py-1 rounded">
                {vehicle.internalCode}
              </span>
              <span className="text-xs font-bold bg-[#EAF3FC] text-[#0B3B70] border border-[#1684D8]/30 px-2.5 py-1 rounded">
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
              <h1 className="text-2xl font-extrabold text-[#172B3A]">
                {vehicle.brand} {vehicle.model}
              </h1>
              <p className="text-sm font-medium text-slate-600">
                {vehicle.trim} • Cor: <strong>{vehicle.color}</strong>
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="rounded-lg bg-[#F4F7FA] p-2.5 border border-slate-200">
                  <span className="text-slate-500 block">Chassi (VIN):</span>
                  <code className="font-mono font-bold text-[#172B3A]">
                    {vehicle.vin}
                  </code>
                </div>
                <div className="rounded-lg bg-[#F4F7FA] p-2.5 border border-slate-200">
                  <span className="text-slate-500 block">Ano Fab/Mod:</span>
                  <strong className="text-[#172B3A]">
                    {vehicle.manufacturingYear}/{vehicle.modelYear}
                  </strong>
                </div>
                <div className="rounded-lg bg-[#F4F7FA] p-2.5 border border-slate-200">
                  <span className="text-slate-500 block">Placa:</span>
                  <strong className="font-mono text-[#172B3A]">
                    {vehicle.plate || "Sem placa (0km)"}
                  </strong>
                </div>
                <div className="rounded-lg bg-[#F4F7FA] p-2.5 border border-slate-200">
                  <span className="text-slate-500 block">Entrada Estoque:</span>
                  <strong className="text-[#172B3A]">
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
              <div className="rounded-xl bg-[#EAF3FC] border border-[#1684D8]/30 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#0B3B70] flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-[#1684D8]" />
                    <span>
                      Negociação Ativa Vinculada:{" "}
                      {vehicle.activeDeal.dealNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 mt-0.5">
                    Consulte as próximas etapas e pendências desta negociação.
                  </p>
                </div>
                {vehicle.canAccessActiveDeal ? (
                  <Link
                    href={`/app/negociacoes/${vehicle.activeDeal.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white shrink-0 transition"
                  >
                    <span>Abrir Passaporte Digital</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <p className="text-xs text-slate-600">
                    Negociação sob responsabilidade de outro vendedor.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#172B3A]">
                    Veículo sem negociação ativa no momento
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {vehicle.stockStatus === "AVAILABLE"
                      ? "Disponível para iniciar uma negociação."
                      : "Consulte a situação no estoque antes de iniciar uma venda."}
                  </p>
                </div>
                {canCreateDeal && vehicle.stockStatus === "AVAILABLE" && (
                  <Link
                    href={`/app/negociacoes/nova?vehicleId=${vehicle.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white shrink-0 transition"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>Iniciar Abertura Guiada</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="qr-print-area lg:col-span-4 space-y-3">
          {qrLabel ? (
            <VehicleQrLabel vehicle={vehicle} label={qrLabel} />
          ) : (
            <div
              role="status"
              className="no-print rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
            >
              {qrError || "Gerando QR Code…"}
            </div>
          )}
          {qrError && (
            <button
              type="button"
              onClick={() => setQrAttempt((v) => v + 1)}
              className="no-print min-h-11 text-sm font-semibold text-[#0B3B70]"
            >
              Tentar gerar novamente
            </button>
          )}
          {canManageVehicles && (
            <Link
              href={`/app/qr-codes?vehicleId=${vehicle.id}`}
              className="no-print inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#0B3B70]"
            >
              <QrCode className="h-4 w-4" />
              Gerar etiquetas de outros carros
            </Link>
          )}
        </aside>
      </div>

      {/* Histórico Permanente de Negociações do Veículo */}
      <section className="no-print bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-[#1684D8]" />
          <div>
            <h2 className="text-base font-bold text-[#172B3A]">
              Histórico de Negociações deste Veículo ({dealHistory.length})
            </h2>
            <p className="text-xs text-slate-500">
              Cada negociação mantém seu próprio passaporte, documentos e
              histórico imutável.
            </p>
          </div>
        </div>

        {dealHistory.length === 0 ? (
          <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-6 text-center text-xs text-slate-500">
            Nenhuma negociação registrada para este veículo até o momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
            {dealHistory.map((dh) => (
              <div
                key={dh.id}
                className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F4F7FA]/70"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#0B3B70]">
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B3B70] hover:bg-[#1684D8] px-3.5 py-2 text-xs font-bold text-white transition"
                >
                  <span>Consultar Passaporte</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#7CC4FA]" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
