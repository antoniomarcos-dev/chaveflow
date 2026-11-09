import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Car,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  Play,
  PlusCircle,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { getServerSessionContext } from "@/lib/server-session";
import { listDealsForOrg } from "@/application/deal-service";
import { listVehiclesForOrg } from "@/application/vehicle-service";
import { AREA_LABELS, ROLE_LABELS, WORKFLOW_STAGES } from "@/domain/types";
import { DealStatusBadge, StockStatusBadge } from "@/components/StatusBadge";
import { computeUserNextAction } from "@/domain/workflow-engine";
import { loadDatabaseState } from "@/infrastructure/database";

export default async function OperationalHomePage() {
  const ctx = (await getServerSessionContext())!;
  const deals = listDealsForOrg({ ctx });
  const vehicles = listVehiclesForOrg({ ctx });
  const db = loadDatabaseState();

  const activeDeals = deals.filter(
    (d) =>
      d.deal.status === "ACTIVE" ||
      d.deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      d.deal.status === "DELIVERY_AUTHORIZED"
  );

  const availableVehicles = vehicles.filter(
    (v) => v.stockStatus === "AVAILABLE" && !v.activeDeal
  );

  return (
    <div className="space-y-8">
      {/* Cabeçalho Operacional */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700">
            <span>Central Operacional • {ctx.branch?.name}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
            Olá, {ctx.profile.fullName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Funções ativas nesta sessão:{" "}
            <strong className="text-slate-900">
              {ctx.roles.map((r) => ROLE_LABELS[r]).join(" • ")}
            </strong>
            . Todas as permissões são validadas na interface e no servidor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/app/escanear"
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition"
          >
            <QrCode className="h-4 w-4" />
            <span>Escanear Veículo (QR Code)</span>
          </Link>
          <Link
            href="/app/negociacoes/nova"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] hover:bg-slate-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition"
          >
            <PlusCircle className="h-4 w-4 text-teal-400" />
            <span>Nova Negociação Guiada</span>
          </Link>
        </div>
      </div>

      {/* Guia do Roteiro Demonstrativo Principal (15 Passos) */}
      <section
        aria-label="Roteiro Demonstrativo Principal"
        className="rounded-2xl bg-[#0f172a] text-white p-6 border border-slate-800 shadow-md"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-500/20 border border-teal-400/40 px-2.5 py-0.5 text-xs font-bold text-teal-300">
              <Play className="h-3.5 w-3.5" />
              ROTEIRO DEMONSTRATIVO PRINCIPAL (15 PASSOS)
            </span>
            <h2 className="text-lg font-bold text-white mt-2">
              História Guiada: Venda Financiada com Usado na Troca — BYD Song Plus DM-i (PIN-BYD-001)
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Execute a história completa de ponta a ponta alternando entre Vendedor, Documental, Financeiro, Faturamento, Responsável pela Liberação, Operação e Cliente no seletor superior.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/app/escanear?code=qr-pin-byd-001-songplus"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 hover:bg-teal-400 px-4 py-2 text-xs font-bold text-slate-950 transition"
            >
              <QrCode className="h-4 w-4" />
              <span>Passo 1: Escanear PIN-BYD-001</span>
            </Link>
            <Link
              href="/app/negociacoes/deal-001"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-white transition"
            >
              <span>Abrir Passaporte NEG-2026-0001</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
            <div className="font-bold text-teal-400">1 a 5 • Vendedor</div>
            <p className="text-slate-300 mt-1">
              Escaneia QR de <strong>PIN-BYD-001</strong>, confirma dados, abre o passaporte <strong>NEG-2026-0001</strong>, vê pendência do <em>Laudo do Usado na Troca</em> e envia o documento.
            </p>
          </div>
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
            <div className="font-bold text-teal-400">6 a 8 • Documental</div>
            <p className="text-slate-300 mt-1">
              Alterna para <strong>Patrícia (Documental)</strong>, confere o laudo enviado e aprova. O passaporte atualiza automaticamente o dossiê documental.
            </p>
          </div>
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
            <div className="font-bold text-teal-400">9 a 11 • Financeiro & NF</div>
            <p className="text-slate-300 mt-1">
              Tentativa prematura de liberar é bloqueada. <strong>Roberto (Financeiro)</strong> aprova a entrada PIX e <strong>Juliana (Faturamento)</strong> registra a Nota Fiscal.
            </p>
          </div>
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
            <div className="font-bold text-teal-400">12 e 13 • Liberação & Entrega</div>
            <p className="text-slate-300 mt-1">
              <strong>Marcos (Liberação)</strong> autoriza a entrega. <strong>Diego (Operação)</strong> reconfirma o chassi <code>9BWSU19F08B301001</code> e registra a entrega.
            </p>
          </div>
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
            <div className="font-bold text-teal-400">14 e 15 • Cliente & Auditoria</div>
            <p className="text-slate-300 mt-1">
              <strong>Helena (Cliente)</strong> visualiza a atualização permitida sem dados internos, e a linha de auditoria preserva todos os eventos.
            </p>
          </div>
        </div>
      </section>

      {/* Indicadores Rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Negociações Ativas</span>
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {activeDeals.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Com passaporte em acompanhamento
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Prontas para Autorização</span>
            <ClipboardCheck className="h-4 w-4 text-teal-600" />
          </div>
          <div className="text-2xl font-extrabold text-teal-700 mt-2">
            {
              deals.filter(
                (d) =>
                  d.deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
                  (d.summary.deliveryEligible && d.deal.status === "ACTIVE")
              ).length
            }
          </div>
          <div className="text-xs text-slate-500 mt-1">
            100% dos requisitos cumpridos
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Veículos Disponíveis</span>
            <Car className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {availableVehicles.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Sem negociação ativa vinculada
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Entregas Concluídas</span>
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {deals.filter((d) => d.deal.status === "DELIVERED").length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Com reconfirmação de chassi auditada
          </div>
        </div>
      </div>

      {/* Lista de Passaportes Digitais da Concessionária */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Passaportes Digitais da Unidade
            </h2>
            <p className="text-xs text-slate-500">
              Visão em tempo real do veículo, situação, próxima ação do seu perfil e bloqueios impeditivos.
            </p>
          </div>
          <Link
            href="/app/negociacoes"
            className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"
          >
            <span>Ver todas as negociações</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {deals.map(({ deal, vehicle, customer, sellerName, summary }) => {
            const dealTasks = db.taskInstances.filter(
              (t) => t.dealId === deal.id
            );
            const dealDocs = db.documents.filter((d) => d.dealId === deal.id);
            const nextAction = computeUserNextAction(
              ctx,
              deal,
              dealTasks,
              dealDocs,
              summary
            );
            const stageObj = WORKFLOW_STAGES.find(
              (s) => s.code === summary.currentStage
            );

            return (
              <div
                key={deal.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between gap-4 hover:border-slate-300 transition"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                          {deal.dealNumber}
                        </span>
                        <span className="font-mono text-xs font-semibold text-slate-600">
                          {vehicle.internalCode}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {vehicle.brand} {vehicle.model} {vehicle.trim} (
                        {vehicle.color})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Comprador: <strong>{customer.fullName}</strong> (
                        {deal.buyerType}) • Vendedor: {sellerName}
                      </p>
                    </div>
                    <DealStatusBadge status={deal.status} />
                  </div>

                  {/* Condições da Negociação */}
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      Etapa: {stageObj?.name ?? summary.currentStage}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      Financiamento: {deal.hasFinancing ? "Sim" : "Não"}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      Usado na troca: {deal.hasTradeIn ? "Sim" : "Não"}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      Procuração: {deal.hasPowerOfAttorney ? "Sim" : "Não"}
                    </span>
                  </div>

                  {/* Próxima Ação Recomendada para o Usuário Atual */}
                  <div
                    className={`rounded-xl p-3 border text-xs ${
                      nextAction.hasDirectAction
                        ? "bg-teal-50/70 border-teal-300 text-teal-950"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between gap-2">
                      <span>
                        {nextAction.hasDirectAction
                          ? "Sua próxima ação nesta negociação:"
                          : "Situação atual da fila:"}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200">
                        Área: {nextAction.responsibleAreaLabel}
                      </span>
                    </div>
                    <p className="font-semibold mt-1">{nextAction.headline}</p>
                    <p className="text-slate-600 mt-0.5">
                      {nextAction.description}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs">
                    {summary.deliveryBlockers.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {summary.deliveryBlockers.length} bloqueio(s) p/ entrega
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Sem bloqueios técnicos
                      </span>
                    )}
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600 font-medium">
                      Tarefas aplicáveis: {summary.completedApplicableTasksCount}/
                      {summary.applicableTasksCount}
                    </span>
                  </div>

                  <Link
                    href={`/app/negociacoes/${deal.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f172a] hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-white transition"
                  >
                    <span>Abrir Passaporte Digital</span>
                    <ArrowRight className="h-3.5 w-3.5 text-teal-400" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Veículos no Estoque Prontos para Escaneamento ou Nova Venda */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Estoque da Unidade ({vehicles.length} veículos)
            </h2>
            <p className="text-xs text-slate-500">
              Situação do estoque separada da situação da negociação. Clique para imprimir etiqueta QR Code ou iniciar negociação.
            </p>
          </div>
          <Link
            href="/app/veiculos"
            className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"
          >
            <span>Gerenciar estoque e importar CSV</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.slice(0, 6).map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                    {v.internalCode}
                  </span>
                  <StockStatusBadge status={v.stockStatus} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2">
                  {v.brand} {v.model} • {v.color}
                </h3>
                <p className="text-xs text-slate-500">
                  {v.trim} • {v.manufacturingYear}/{v.modelYear} • Chassi:{" "}
                  <code className="font-mono">{v.vin}</code>
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <Link
                  href={`/app/veiculos/${v.id}`}
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                >
                  Cadastro & Etiqueta QR
                </Link>
                {v.activeDeal ? (
                  <Link
                    href={`/app/negociacoes/${v.activeDeal.id}`}
                    className="text-xs font-bold text-teal-700 hover:underline"
                  >
                    Passaporte {v.activeDeal.dealNumber} →
                  </Link>
                ) : (
                  <Link
                    href={`/app/negociacoes/nova?vehicleId=${v.id}`}
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    + Iniciar Negociação
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
