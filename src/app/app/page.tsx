import { listDealsForOrg } from "@/application/deal-service";
import { DealStatusBadge } from "@/components/StatusBadge";
import { hasPermission } from "@/domain/permissions";
import { AREA_LABELS, ROLE_LABELS } from "@/domain/types";
import { computeUserNextAction } from "@/domain/workflow-engine";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  KeyRound,
  Plus,
} from "lucide-react";
import Link from "next/link";

export default async function OperationalHomePage() {
  const ctx = await requireInternalSession();
  const deals = await listDealsForOrg({ ctx });
  const db = await loadDatabaseState();

  const canCreateDeal = hasPermission(ctx, "deal:create");
  const canViewReports = hasPermission(ctx, "report:view");
  const isSellerOnly =
    ctx.roles.includes("SELLER") &&
    !ctx.roles.includes("ADMIN") &&
    !ctx.roles.includes("MANAGER");

  const activeDeals = deals.filter(
    (d) =>
      d.deal.status === "ACTIVE" ||
      d.deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      d.deal.status === "DELIVERY_AUTHORIZED",
  );

  // Negociações que exigem ação (com bloqueios ou aguardando autorização/entrega)
  const dealsRequiringAction = activeDeals.filter(
    (d) =>
      d.summary.deliveryBlockers.length > 0 ||
      d.deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      d.deal.status === "DELIVERY_AUTHORIZED",
  );

  // Prontas para autorização (distinto de já autorizadas!)
  const eligibleForAuthDeals = activeDeals.filter(
    (d) =>
      d.deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      (d.summary.deliveryEligible && d.deal.status === "ACTIVE"),
  );

  // Entregas autorizadas aguardando entrega física
  const authorizedForDeliveryDeals = activeDeals.filter(
    (d) => d.deal.status === "DELIVERY_AUTHORIZED",
  );

  const enrichedDeals = deals
    .filter((d) => d.deal.status !== "DELIVERED" && d.deal.status !== "CANCELLED")
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

      // Identificar o responsável nominal da próxima ação quando disponível
      let actionResponsibleName = nextAction.responsibleAreaLabel;
      if (nextAction.targetTaskCode) {
        const targetTask = dealTasks.find(
          (t) => t.code === nextAction.targetTaskCode,
        );
        if (targetTask?.assigneeId) {
          const assignee = db.profiles.find(
            (p) => p.id === targetTask.assigneeId,
          );
          if (assignee) {
            actionResponsibleName = `${assignee.fullName} (${AREA_LABELS[targetTask.responsibleArea]})`;
          }
        }
      } else if (nextAction.responsibleAreaLabel === "Comercial") {
        actionResponsibleName = `${item.sellerName} (Comercial)`;
      }

      const directHref = nextAction.targetDocumentId
        ? `/app/negociacoes/${item.deal.id}?tab=DOCUMENTS&docId=${encodeURIComponent(
            nextAction.targetDocumentId,
          )}`
        : nextAction.targetTaskCode
          ? `/app/negociacoes/${item.deal.id}?tab=TASKS&taskCode=${encodeURIComponent(
              nextAction.targetTaskCode,
            )}`
          : `/app/negociacoes/${item.deal.id}`;

      return {
        ...item,
        nextAction,
        actionResponsibleName,
        directHref,
      };
    })
    .sort((a, b) => {
      if (a.nextAction.hasDirectAction !== b.nextAction.hasDirectAction) {
        return a.nextAction.hasDirectAction ? -1 : 1;
      }
      return b.summary.deliveryBlockers.length - a.summary.deliveryBlockers.length;
    });

  // Resumo rápido da equipe para gestores
  const nowMs = Date.now();
  const activeDealIds = new Set(activeDeals.map((d) => d.deal.id));
  const activeOrgTasks = db.taskInstances.filter(
    (t) =>
      t.organizationId === ctx.organization.id && activeDealIds.has(t.dealId),
  );
  const executableNowCount = activeOrgTasks.filter(
    (t) =>
      t.state === "AVAILABLE" ||
      t.state === "IN_PROGRESS" ||
      t.state === "IN_REVIEW",
  ).length;
  const overdueExecutableCount = activeOrgTasks.filter(
    (t) =>
      t.state !== "WAITING_PREREQUISITE" &&
      t.state !== "COMPLETED" &&
      t.state !== "WAIVED_BY_RULE" &&
      t.state !== "CANCELLED" &&
      t.dueAt !== null &&
      new Date(t.dueAt).getTime() < nowMs,
  ).length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho Curto e Objetivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#172B3A]">Painel</h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            {isSellerOnly
              ? `Suas negociações em andamento (${ctx.profile.fullName})`
              : `${ctx.roles.map((r) => ROLE_LABELS[r]).join(" • ")} — ${ctx.branch?.name}`}
          </p>
        </div>

        {canCreateDeal && (
          <div className="flex items-center gap-2.5">
            <Link
              href="/app/negociacoes/nova"
              className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#0B3B70] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition"
            >
              <Plus className="h-4 w-4" />
              <span>Nova negociação</span>
            </Link>
          </div>
        )}
      </div>

      {/* Indicadores Essenciais (Distinguindo Prontas para Autorização de Entregas Autorizadas) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Link
          href="/app/negociacoes?status=EM_ANDAMENTO"
          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:border-[#1684D8] transition flex items-center gap-3.5"
        >
          <div className="h-10 w-10 rounded-xl bg-[#EAF3FC] text-[#0B3B70] flex items-center justify-center shrink-0">
            <FileSpreadsheet className="h-5 w-5 text-[#1684D8]" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold text-[#172B3A] leading-none">
              {activeDeals.length}
            </div>
            <div className="text-xs font-bold text-[#172B3A] mt-1">
              Negociações ativas
            </div>
          </div>
        </Link>

        <Link
          href="/app/negociacoes?status=EXIGINDO_ACAO"
          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:border-amber-400 transition flex items-center gap-3.5"
        >
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold text-amber-800 leading-none">
              {dealsRequiringAction.length}
            </div>
            <div className="text-xs font-bold text-[#172B3A] mt-1">
              Exigem ação
            </div>
          </div>
        </Link>

        <Link
          href="/app/negociacoes?status=PRONTA_AUTORIZACAO"
          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:border-[#1684D8] transition flex items-center gap-3.5"
        >
          <div className="h-10 w-10 rounded-xl bg-[#EAF3FC] text-[#0B3B70] border border-[#1684D8]/30 flex items-center justify-center shrink-0">
            <ClipboardCheck className="h-5 w-5 text-[#1684D8]" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold text-[#0B3B70] leading-none">
              {eligibleForAuthDeals.length}
            </div>
            <div className="text-xs font-bold text-[#172B3A] mt-1">
              Prontas para autorização
            </div>
          </div>
        </Link>

        <Link
          href="/app/negociacoes?status=AUTORIZADA_ENTREGA"
          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:border-emerald-400 transition flex items-center gap-3.5"
        >
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold text-emerald-800 leading-none">
              {authorizedForDeliveryDeals.length}
            </div>
            <div className="text-xs font-bold text-[#172B3A] mt-1">
              Entregas autorizadas
            </div>
          </div>
        </Link>
      </div>

      {/* Panorama da Equipe para Gestores e Responsáveis pela Liberação */}
      {canViewReports && (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="font-bold text-[#0B3B70] inline-flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-[#1684D8]" />
              Panorama da equipe:
            </span>
            <span className="text-slate-700">
              <strong className="text-[#172B3A]">{executableNowCount}</strong>{" "}
              atividade(s) disponível(is) agora
            </span>
            <span className="text-slate-300">•</span>
            <span
              className={
                overdueExecutableCount > 0
                  ? "font-semibold text-red-700"
                  : "text-slate-700"
              }
            >
              <strong>{overdueExecutableCount}</strong> atividade(s) com prazo
              vencido
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/app/pendencias?escopo=EQUIPE"
              className="text-xs font-semibold text-slate-700 hover:text-[#0B3B70] hover:underline"
            >
              Ver fila da equipe
            </Link>
            <Link
              href="/app/relatorios"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAF3FC] px-3 py-1.5 text-xs font-bold text-[#0B3B70] hover:bg-[#d8eafb] transition"
            >
              <span>Visão gerencial</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Fila de Trabalho Relevante ao Usuário */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[#172B3A]">
              {isSellerOnly
                ? "Fila de trabalho — Minhas negociações"
                : "Fila de trabalho prioritária"}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Atividades disponíveis para a sua área aparecem primeiro.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <Link
              href="/app/pendencias"
              className="text-[#0B3B70] hover:text-[#1684D8] hover:underline"
            >
              Abrir pendências
            </Link>
            <Link
              href="/app/negociacoes"
              className="text-[#1684D8] hover:underline inline-flex items-center gap-1"
            >
              <span>Todas as negociações ({deals.length})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {enrichedDeals.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
            <h3 className="text-sm font-bold text-[#172B3A]">
              Nenhuma negociação ativa pendente
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Todas as negociações foram concluídas ou ainda não há vendas em
              andamento para o seu perfil.
            </p>
          </div>
        ) : (
          <>
            {/* Tabela Compacta Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">Negociação</th>
                    <th className="py-3 px-4">Veículo</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Próxima ação</th>
                    <th className="py-3 px-4">Responsável</th>
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
                      nextAction,
                      actionResponsibleName,
                      directHref,
                    }) => (
                      <tr
                        key={deal.id}
                        className={`hover:bg-[#F4F7FA]/80 transition ${
                          nextAction.hasDirectAction ? "bg-[#EAF3FC]/25" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Link
                            href={`/app/negociacoes/${deal.id}`}
                            className="font-mono text-xs font-bold text-[#0B3B70] bg-[#EAF3FC] px-2.5 py-1 rounded-md hover:underline"
                          >
                            {deal.dealNumber}
                          </Link>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#172B3A] text-xs">
                            {vehicle.brand} {vehicle.model}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            {vehicle.color} • {vehicle.modelYear}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#172B3A]">
                            {customer.fullName}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-bold text-[#172B3A] truncate">
                            {nextAction.headline}
                          </div>
                          {nextAction.hasDirectAction && (
                            <span className="inline-block mt-0.5 text-[11px] font-semibold text-[#1684D8]">
                              Disponível para você agora
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="text-xs font-medium text-slate-700">
                            {actionResponsibleName}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <DealStatusBadge status={deal.status} />
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Link
                            href={directHref}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition ${
                              nextAction.hasDirectAction
                                ? "bg-[#1684D8] hover:bg-[#0B3B70]"
                                : "bg-[#0B3B70] hover:bg-[#1684D8]"
                            }`}
                          >
                            <span>
                              {nextAction.hasDirectAction
                                ? "Executar ação"
                                : "Abrir passaporte"}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {/* Lista Compacta para Celular */}
            <div className="lg:hidden divide-y divide-slate-200">
              {enrichedDeals.map(
                ({
                  deal,
                  vehicle,
                  customer,
                  nextAction,
                  actionResponsibleName,
                  directHref,
                }) => (
                  <div key={deal.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#0B3B70] bg-[#EAF3FC] px-2 py-0.5 rounded">
                          {deal.dealNumber}
                        </span>
                        <h3 className="text-sm font-extrabold text-[#172B3A] mt-1">
                          {vehicle.brand} {vehicle.model} ({vehicle.color})
                        </h3>
                        <p className="text-xs text-slate-600">
                          Cliente: <strong>{customer.fullName}</strong>
                        </p>
                      </div>
                      <DealStatusBadge status={deal.status} />
                    </div>

                    <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3 text-xs space-y-1">
                      <p className="font-bold text-[#172B3A]">
                        Próxima ação: {nextAction.headline}
                      </p>
                      <p className="text-slate-600">
                        Responsável: <strong>{actionResponsibleName}</strong>
                      </p>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Link
                        href={directHref}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1684D8] px-4 py-2.5 text-xs font-bold text-white"
                      >
                        <span>
                          {nextAction.hasDirectAction
                            ? "Executar ação"
                            : "Abrir passaporte"}
                        </span>
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
    </div>
  );
}
