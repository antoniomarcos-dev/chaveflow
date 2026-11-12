import { listDealsForOrg } from "@/application/deal-service";
import { listVehiclesForOrg } from "@/application/vehicle-service";
import { DealStatusBadge, StockStatusBadge } from "@/components/StatusBadge";
import { WORKFLOW_STAGES } from "@/domain/types";
import { computeUserNextAction } from "@/domain/workflow-engine";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";
import {
  AlertTriangle,
  ArrowRight,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  Plus,
  QrCode,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";

export default async function OperationalHomePage() {
  const ctx = await requireInternalSession();
  const deals = await listDealsForOrg({ ctx });
  const vehicles = await listVehiclesForOrg({ ctx });
  const db = await loadDatabaseState();
  const isAdmin = ctx.roles.includes("ADMIN");
  const isSeller = ctx.roles.includes("SELLER") && !isAdmin;

  const activeDeals = deals.filter(
    (d) =>
      d.deal.status === "ACTIVE" ||
      d.deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      d.deal.status === "DELIVERY_AUTHORIZED",
  );

  const dealsWithPendencies = activeDeals.filter(
    (d) => d.summary.deliveryBlockers.length > 0,
  );

  const awaitingReleaseOrAuth = deals.filter(
    (d) =>
      d.deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      d.deal.status === "DELIVERY_AUTHORIZED" ||
      (d.summary.deliveryEligible && d.deal.status === "ACTIVE"),
  );

  const deliveredDeals = deals.filter((d) => d.deal.status === "DELIVERED");

  const availableVehicles = vehicles.filter(
    (v) => v.stockStatus === "AVAILABLE" && !v.activeDeal,
  );

  const enrichedDeals = deals
    .map((item) => {
      const dealTasks = db.taskInstances.filter(
        (t) => t.dealId === item.deal.id,
      );
      const dealDocs = db.documents.filter((d) => d.dealId === item.deal.id);
      const nextAction = computeUserNextAction(
        ctx,
        item.deal,
        dealTasks,
        dealDocs,
        item.summary,
      );
      const stageObj = WORKFLOW_STAGES.find(
        (s) => s.code === item.summary.currentStage,
      );
      return {
        ...item,
        nextAction,
        stageName: stageObj?.name ?? item.summary.currentStage,
      };
    })
    .sort((a, b) => {
      // Priorizar itens que exigem ação direta do usuário ou possuem pendências ativas
      if (a.nextAction.hasDirectAction !== b.nextAction.hasDirectAction) {
        return a.nextAction.hasDirectAction ? -1 : 1;
      }
      const aActive = a.deal.status !== "DELIVERED";
      const bActive = b.deal.status !== "DELIVERED";
      if (aActive !== bActive) return aActive ? -1 : 1;
      return b.summary.deliveryBlockers.length - a.summary.deliveryBlockers.length;
    });

  return (
    <div className="space-y-6">
      {/* Cabeçalho Direto da Página */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="eyebrow">
            {isAdmin
              ? "Visão Operacional da Unidade"
              : isSeller
                ? "Painel de Vendas"
                : "Central Operacional"}{" "}
            • {ctx.branch?.name}
          </span>
          <h1 className="text-2xl font-extrabold text-[#172B3A] mt-1">
            Painel Operacional
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Acompanhe as negociações, próximas ações, pendências impeditivas e o
            fluxo de liberação de veículos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/app/escanear"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-[#172B3A] transition"
          >
            <QrCode className="h-4 w-4 text-[#0B3B70]" />
            <span>Identificar Veículo (QR)</span>
          </Link>
          <Link
            href="/app/negociacoes/nova"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Negociação</span>
          </Link>
        </div>
      </div>

      {/* Indicadores Principais no Topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/app/negociacoes"
          className="group bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-[#1684D8]/50 transition flex items-center gap-3.5"
        >
          <div className="h-11 w-11 rounded-xl bg-[#EAF3FC] text-[#0B3B70] flex items-center justify-center shrink-0">
            <FileSpreadsheet className="h-5 w-5 text-[#1684D8]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-extrabold text-[#172B3A] leading-none">
              {activeDeals.length}
            </div>
            <div className="text-xs font-bold text-[#172B3A] mt-1 truncate">
              Negociações ativas
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              Em acompanhamento
            </div>
          </div>
        </Link>

        <Link
          href="/app/negociacoes?filtro=PENDENTES"
          className="group bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-amber-400 transition flex items-center gap-3.5"
        >
          <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-extrabold text-amber-800 leading-none">
              {dealsWithPendencies.length}
            </div>
            <div className="text-xs font-bold text-[#172B3A] mt-1 truncate">
              Com pendências
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              Exigem ação ou conferência
            </div>
          </div>
        </Link>

        <Link
          href="/app/aprovacoes"
          className="group bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-emerald-400 transition flex items-center gap-3.5"
        >
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-extrabold text-emerald-800 leading-none">
              {awaitingReleaseOrAuth.length}
            </div>
            <div className="text-xs font-bold text-[#172B3A] mt-1 truncate">
              Prontas / Autorizadas
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              Elegíveis para liberação
            </div>
          </div>
        </Link>

        <Link
          href="/app/veiculos"
          className="group bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-[#1684D8]/50 transition flex items-center gap-3.5"
        >
          <div className="h-11 w-11 rounded-xl bg-[#EAF3FC] text-[#0B3B70] flex items-center justify-center shrink-0">
            <Car className="h-5 w-5 text-[#1684D8]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-extrabold text-[#172B3A] leading-none">
              {availableVehicles.length}
            </div>
            <div className="text-xs font-bold text-[#172B3A] mt-1 truncate">
              Veículos disponíveis
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {deliveredDeals.length} entrega(s) concluída(s)
            </div>
          </div>
        </Link>
      </div>

      {/* Atalhos Operacionais Compactos */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Link
          href="/app/minhas-tarefas"
          className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-2xs hover:border-[#1684D8] transition flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-[#EAF3FC] text-[#0B3B70] flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-4 w-4 text-[#1684D8]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#172B3A] truncate">
                Minhas Tarefas
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Prazos e pendências da sua área
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-[#1684D8] shrink-0" />
        </Link>

        <Link
          href="/app/aprovacoes"
          className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-2xs hover:border-[#1684D8] transition flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-[#EAF3FC] text-[#0B3B70] flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4 text-[#1684D8]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#172B3A] truncate">
                Faturamento, Docs e Liberações
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Conferências e autorizações formais
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-[#1684D8] shrink-0" />
        </Link>

        <Link
          href={isAdmin ? "/app/configuracoes" : "/app/clientes"}
          className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-2xs hover:border-[#1684D8] transition flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-[#EAF3FC] text-[#0B3B70] flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-[#1684D8]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#172B3A] truncate">
                {isAdmin ? "Equipe e Acessos" : "Clientes e Acessos"}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {isAdmin
                  ? "Gerenciar usuários e permissões"
                  : "Preparar acesso individual do comprador"}
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-[#1684D8] shrink-0" />
        </Link>
      </div>

      {/* Negociações em Acompanhamento (Priorizando pendências e próximas ações) */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[#172B3A]">
              {isSeller
                ? "Minhas negociações em andamento"
                : "Negociações em andamento"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Priorizadas por pendências e próximas ações atribuídas ao seu
              perfil.
            </p>
          </div>
          <Link
            href="/app/negociacoes"
            className="text-xs font-bold text-[#1684D8] hover:underline inline-flex items-center gap-1"
          >
            <span>Ver todas ({deals.length})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {enrichedDeals.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <FileSpreadsheet className="mx-auto h-9 w-9 text-[#1684D8]" />
            <h3 className="text-sm font-bold text-[#172B3A]">
              Nenhuma negociação registrada no momento
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Inicie uma nova negociação guiada para gerar o Passaporte Digital
              e acompanhar documentos, aprovações e liberação.
            </p>
            <div className="pt-2">
              <Link
                href="/app/negociacoes/nova"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1684D8] px-4 py-2 text-xs font-bold text-white"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Negociação</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Tabela Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Negociação & Veículo</th>
                    <th className="py-3 px-4">Cliente & Responsável</th>
                    <th className="py-3 px-4">Etapa Atual & Próxima Ação</th>
                    <th className="py-3 px-4">Situação</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {enrichedDeals.map(
                    ({
                      deal,
                      vehicle,
                      customer,
                      sellerName,
                      summary,
                      nextAction,
                      stageName,
                    }) => (
                      <tr
                        key={deal.id}
                        className="hover:bg-[#F4F7FA]/70 transition"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                vehicle.photos[0] || "/vehicle-placeholder.svg"
                              }
                              alt={`${vehicle.brand} ${vehicle.model}`}
                              className="h-11 w-16 rounded-lg border border-slate-200 object-cover bg-slate-900 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[11px] font-bold text-[#0B3B70] bg-[#EAF3FC] px-2 py-0.5 rounded">
                                  {deal.dealNumber}
                                </span>
                                <span className="font-mono text-[11px] text-slate-500">
                                  {vehicle.internalCode}
                                </span>
                              </div>
                              <div className="font-bold text-[#172B3A] text-sm mt-0.5 truncate">
                                {vehicle.brand} {vehicle.model}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {vehicle.modelYear} • {vehicle.color} • Chassi{" "}
                                <code className="font-mono">{vehicle.vin}</code>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 font-bold text-[#172B3A]">
                            <User className="h-3.5 w-3.5 text-[#1684D8] shrink-0" />
                            <span>{customer.fullName}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 pl-5">
                            {deal.buyerType} • Vendedor: {sellerName}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-sm">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-[#172B3A]">
                              Etapa: {stageName}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              Área: {nextAction.responsibleAreaLabel}
                            </span>
                          </div>
                          <div
                            className={`mt-1 text-xs font-semibold truncate ${
                              nextAction.hasDirectAction
                                ? "text-[#0B3B70]"
                                : "text-slate-700"
                            }`}
                          >
                            {nextAction.headline}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {nextAction.description}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <DealStatusBadge status={deal.status} />
                            {summary.deliveryBlockers.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                {summary.deliveryBlockers.length} pendência(s)
                                impeditiva(s)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                Requisitos em dia (
                                {summary.completedApplicableTasksCount}/
                                {summary.applicableTasksCount})
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/app/negociacoes/${deal.id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3B70] hover:bg-[#1684D8] px-3.5 py-2 text-xs font-bold text-white transition"
                          >
                            <span>Ver detalhes</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {/* Cards Responsivos Mobile / Tablet */}
            <div className="lg:hidden divide-y divide-slate-200">
              {enrichedDeals.map(
                ({
                  deal,
                  vehicle,
                  customer,
                  sellerName,
                  summary,
                  nextAction,
                  stageName,
                }) => (
                  <div key={deal.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-[#0B3B70] bg-[#EAF3FC] px-2 py-0.5 rounded">
                            {deal.dealNumber}
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            {vehicle.internalCode}
                          </span>
                        </div>
                        <h3 className="text-sm font-extrabold text-[#172B3A] mt-1">
                          {vehicle.brand} {vehicle.model} ({vehicle.color})
                        </h3>
                        <p className="text-xs text-slate-600">
                          Cliente: <strong>{customer.fullName}</strong> •
                          Vendedor: {sellerName}
                        </p>
                      </div>
                      <DealStatusBadge status={deal.status} />
                    </div>

                    <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-[#0B3B70]">
                        <span>Etapa: {stageName}</span>
                        <span>{nextAction.responsibleAreaLabel}</span>
                      </div>
                      <p className="font-semibold text-[#172B3A]">
                        {nextAction.headline}
                      </p>
                      <p className="text-slate-600">{nextAction.description}</p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="text-xs">
                        {summary.deliveryBlockers.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {summary.deliveryBlockers.length} pendência(s)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Sem bloqueios
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/app/negociacoes/${deal.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#1684D8] px-3.5 py-2 text-xs font-bold text-white"
                      >
                        <span>Abrir Passaporte</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ),
              )}
            </div>
          </>
        )}
      </section>

      {/* Visão Rápida do Estoque da Unidade */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-[#172B3A]">
              Estoque da Unidade ({vehicles.length} veículos)
            </h2>
            <p className="text-xs text-slate-500">
              Situação física do veículo separada do passaporte da negociação.
            </p>
          </div>
          <Link
            href="/app/veiculos"
            className="text-xs font-bold text-[#1684D8] hover:underline inline-flex items-center gap-1"
          >
            <span>Ver estoque completo</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.slice(0, 6).map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-3 hover:border-[#1684D8]/40 transition"
            >
              <div className="flex items-start gap-3">
                <img
                  src={v.photos[0] || "/vehicle-placeholder.svg"}
                  alt={`${v.brand} ${v.model}`}
                  className="h-14 w-20 rounded-xl border border-slate-200 object-cover bg-slate-900 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[11px] font-bold text-[#0B3B70] bg-[#EAF3FC] px-2 py-0.5 rounded">
                      {v.internalCode}
                    </span>
                    <StockStatusBadge status={v.stockStatus} />
                  </div>
                  <h3 className="text-sm font-extrabold text-[#172B3A] mt-1.5 truncate">
                    {v.brand} {v.model}
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    {v.modelYear} • {v.color}
                  </p>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <Link
                  href={`/app/veiculos/${v.id}`}
                  className="font-semibold text-slate-600 hover:text-[#0B3B70] hover:underline"
                >
                  Ficha & QR Code
                </Link>
                {v.activeDeal ? (
                  <Link
                    href={`/app/negociacoes/${v.activeDeal.id}`}
                    className="font-bold text-[#1684D8] hover:underline"
                  >
                    Passaporte {v.activeDeal.dealNumber} →
                  </Link>
                ) : (
                  <Link
                    href={`/app/negociacoes/nova?vehicleId=${v.id}`}
                    className="font-bold text-emerald-700 hover:underline"
                  >
                    + Nova negociação
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
