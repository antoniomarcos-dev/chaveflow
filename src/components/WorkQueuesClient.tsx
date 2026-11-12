"use client";

import type { listDealsForOrg } from "@/application/deal-service";
import {
  DealStatusBadge,
  DocumentStatusBadge,
  TaskStateBadge,
} from "@/components/StatusBadge";
import {
  AREA_LABELS,
  Deal,
  DealDocument,
  DocumentStatus,
  ResponsibleArea,
  RoleCode,
  TaskInstance,
  TaskState,
  Vehicle,
} from "@/domain/types";
import { formatDateTimeBr } from "@/lib/format";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileCheck2,
  KeyRound,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type DealSummary = Awaited<ReturnType<typeof listDealsForOrg>>[number]["summary"];

export interface WorkQueueDealItem {
  deal: Deal;
  vehicle: Vehicle;
  customer: {
    id: string;
    fullName: string;
    documentNumber: string;
  };
  sellerName: string;
  summary: DealSummary;
}

export interface WorkQueueDocItem {
  doc: DealDocument;
  deal: Deal;
  vehicle: Vehicle;
  customerName: string;
}

export interface WorkQueueFormalTaskItem {
  task: TaskInstance;
  deal: Deal;
  vehicle: Vehicle;
  customerName: string;
}

type ScopeFilter = "MINE" | "MY_AREA" | "TEAM";
type ActivityTypeFilter =
  | "ALL"
  | "TASK"
  | "DOCUMENT"
  | "APPROVAL"
  | "MILESTONE";
type SituationFilter =
  | "AVAILABLE_NOW"
  | "WAITING_PREVIOUS"
  | "COMPLETED"
  | "ALL";
type DeadlineFilter = "ALL" | "OVERDUE" | "ON_TIME";

interface UnifiedQueueItem {
  id: string;
  deal: Deal;
  vehicle: Vehicle;
  customerName: string;
  activityType: "TASK" | "DOCUMENT" | "APPROVAL" | "MILESTONE";
  actionTitle: string;
  actionSubtitle: string;
  responsibleArea: ResponsibleArea;
  responsibleLabel: string;
  assigneeId: string | null;
  dueAt: string | null;
  isOverdue: boolean;
  isAvailableNow: boolean;
  isWaitingPrevious: boolean;
  isCompleted: boolean;
  actionButtonLabel: string;
  targetTab: "TASKS" | "DOCUMENTS" | "SALE_DATA";
  targetTaskCode?: string;
  targetDocId?: string;
  taskState?: TaskState;
  docStatus?: DocumentStatus;
}

export function WorkQueuesClient({
  deals,
  documents,
  formalTasks,
  allTasks,
  currentUser,
  defaultScope,
}: {
  deals: WorkQueueDealItem[];
  documents: WorkQueueDocItem[];
  formalTasks: WorkQueueFormalTaskItem[];
  allTasks?: WorkQueueFormalTaskItem[];
  currentUser?: {
    id: string;
    fullName: string;
    roles: RoleCode[];
    accessibleAreas: ResponsibleArea[];
    canSeeTeam: boolean;
  };
  defaultScope?: ScopeFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const canSeeTeam = currentUser?.canSeeTeam ?? true;
  const initialScopeParam = searchParams.get("scope") as ScopeFilter | null;
  const initialScope: ScopeFilter =
    initialScopeParam &&
    (["MINE", "MY_AREA", "TEAM"] as const).includes(initialScopeParam)
      ? !canSeeTeam && initialScopeParam === "TEAM"
        ? "MINE"
        : initialScopeParam
      : defaultScope || (canSeeTeam ? "MY_AREA" : "MINE");

  const [scope, setScope] = useState<ScopeFilter>(initialScope);
  const [activityType, setActivityType] = useState<ActivityTypeFilter>(
    (searchParams.get("type") as ActivityTypeFilter) || "ALL",
  );
  const [situation, setSituation] = useState<SituationFilter>(
    (searchParams.get("situation") as SituationFilter) || "AVAILABLE_NOW",
  );
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>(
    (searchParams.get("deadline") as DeadlineFilter) || "ALL",
  );
  const [areaFilter, setAreaFilter] = useState<ResponsibleArea | "ALL">(
    (searchParams.get("area") as ResponsibleArea | "ALL") || "ALL",
  );
  const [search, setSearch] = useState(searchParams.get("q") || "");

  function syncUrlParams(updates: {
    scope?: ScopeFilter;
    type?: ActivityTypeFilter;
    situation?: SituationFilter;
    deadline?: DeadlineFilter;
    area?: ResponsibleArea | "ALL";
    q?: string;
  }) {
    const nextScope = updates.scope ?? scope;
    const nextType = updates.type ?? activityType;
    const nextSituation = updates.situation ?? situation;
    const nextDeadline = updates.deadline ?? deadlineFilter;
    const nextArea = updates.area ?? areaFilter;
    const nextQ = updates.q ?? search;

    const params = new URLSearchParams();
    if (nextScope) params.set("scope", nextScope);
    if (nextType !== "ALL") params.set("type", nextType);
    if (nextSituation !== "AVAILABLE_NOW")
      params.set("situation", nextSituation);
    if (nextDeadline !== "ALL") params.set("deadline", nextDeadline);
    if (nextArea !== "ALL") params.set("area", nextArea);
    if (nextQ.trim()) params.set("q", nextQ.trim());

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const currentQueueUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("scope", scope);
    if (activityType !== "ALL") params.set("type", activityType);
    if (situation !== "AVAILABLE_NOW") params.set("situation", situation);
    if (deadlineFilter !== "ALL") params.set("deadline", deadlineFilter);
    if (areaFilter !== "ALL") params.set("area", areaFilter);
    if (search.trim()) params.set("q", search.trim());
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, scope, activityType, situation, deadlineFilter, areaFilter, search]);

  // Constrói a lista unificada de pendências (Documentos, Tarefas, Aprovações Formais e Marcos de Faturamento/Autorização/Entrega)
  const unifiedItems = useMemo<UnifiedQueueItem[]>(() => {
    const items: UnifiedQueueItem[] = [];
    const nowMs = Date.now();
    const taskSource = allTasks ?? formalTasks;

    // 1. Documentos da negociação
    for (const { doc, deal, vehicle, customerName } of documents) {
      if (deal.status === "DRAFT" || deal.status === "CANCELLED") continue;

      const isCompleted = doc.status === "APPROVED";
      const isPendingReview = doc.status === "UPLOADED_PENDING_REVIEW";
      const isNeedsUpload =
        doc.status === "REQUESTED" ||
        doc.status === "REJECTED" ||
        doc.status === "CORRECTION_REQUESTED" ||
        doc.status === "OUTDATED";

      const responsibleArea: ResponsibleArea = isNeedsUpload
        ? "COMMERCIAL"
        : doc.responsibleArea;
      const responsibleLabel = isNeedsUpload
        ? "Comercial / Vendedor"
        : AREA_LABELS[doc.responsibleArea];

      items.push({
        id: `doc-${doc.id}`,
        deal,
        vehicle,
        customerName,
        activityType: "DOCUMENT",
        actionTitle: isPendingReview
          ? `Conferir documento: ${doc.title}`
          : isNeedsUpload
            ? `Enviar documento: ${doc.title}`
            : `Documento aprovado: ${doc.title}`,
        actionSubtitle:
          doc.customerRejectionGuidance ||
          doc.rejectionReason ||
          doc.whyRequired,
        responsibleArea,
        responsibleLabel,
        assigneeId: isNeedsUpload ? deal.sellerId : null,
        dueAt: null,
        isOverdue: false,
        isAvailableNow: !isCompleted && (isPendingReview || isNeedsUpload),
        isWaitingPrevious: false,
        isCompleted,
        actionButtonLabel: isPendingReview
          ? "Conferir documento"
          : isNeedsUpload
            ? "Enviar arquivo"
            : "Ver documento",
        targetTab: "DOCUMENTS",
        targetDocId: doc.id,
        docStatus: doc.status,
      });
    }

    // 2. Tarefas operacionais, aprovações formais e marcos (Faturamento, Liberação, Entrega)
    for (const { task, deal, vehicle, customerName } of taskSource) {
      if (deal.status === "DRAFT" || deal.status === "CANCELLED") continue;
      if (task.state === "WAIVED_BY_RULE" || task.state === "CANCELLED")
        continue;

      const isMilestone =
        task.code === "TASK_BILLING_INVOICE" ||
        task.code === "TASK_RELEASE_AUTH" ||
        task.code === "TASK_CONFIRM_DELIVERY";

      const isFormalApproval = task.requiresFormalApproval && !isMilestone;

      const isCompleted =
        task.state === "COMPLETED" &&
        (!task.requiresFormalApproval || task.approvalStatus === "APPROVED");

      const isWaitingPrevious = task.state === "WAITING_PREREQUISITE";
      const isAvailableNow = !isCompleted && !isWaitingPrevious;

      // Tarefas bloqueadas (WAITING_PREREQUISITE) nunca contam como atrasadas
      const isOverdue =
        isAvailableNow &&
        task.dueAt !== null &&
        new Date(task.dueAt).getTime() < nowMs;

      const activityType: UnifiedQueueItem["activityType"] = isMilestone
        ? "MILESTONE"
        : isFormalApproval
          ? "APPROVAL"
          : "TASK";

      const actionButtonLabel = isCompleted
        ? "Ver registro"
        : isMilestone
          ? task.code === "TASK_BILLING_INVOICE"
            ? "Registrar faturamento"
            : task.code === "TASK_RELEASE_AUTH"
              ? "Autorizar entrega"
              : "Confirmar entrega"
          : isFormalApproval
            ? "Analisar e aprovar"
            : "Executar atividade";

      items.push({
        id: `task-${task.id}`,
        deal,
        vehicle,
        customerName,
        activityType,
        actionTitle: task.title,
        actionSubtitle: task.pendingReason || task.description,
        responsibleArea: task.responsibleArea,
        responsibleLabel: AREA_LABELS[task.responsibleArea],
        assigneeId: task.assigneeId,
        dueAt: isWaitingPrevious ? null : task.dueAt,
        isOverdue,
        isAvailableNow,
        isWaitingPrevious,
        isCompleted,
        actionButtonLabel,
        targetTab: isMilestone ? "SALE_DATA" : "TASKS",
        targetTaskCode: task.code,
        taskState: task.state,
      });
    }

    // Ordenar priorizando:
    // 1. Disponíveis agora + em atraso
    // 2. Disponíveis agora (por prazo mais próximo)
    // 3. Aguardando etapa anterior
    // 4. Concluídas
    return items.sort((a, b) => {
      if (a.isAvailableNow !== b.isAvailableNow) {
        return a.isAvailableNow ? -1 : 1;
      }
      if (a.isOverdue !== b.isOverdue) {
        return a.isOverdue ? -1 : 1;
      }
      if (a.isWaitingPrevious !== b.isWaitingPrevious) {
        return a.isWaitingPrevious ? -1 : 1;
      }
      const dueA = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const dueB = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return dueA - dueB;
    });
  }, [documents, allTasks, formalTasks]);

  const normalizedQuery = search.trim().toLowerCase();

  // Filtragem unificada
  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      // 1. Escopo (Minha responsabilidade / Minha área / Toda a equipe)
      if (currentUser) {
        if (scope === "MINE") {
          const isAssignedToMe = item.assigneeId === currentUser.id;
          const isMyDealAsSeller =
            item.deal.sellerId === currentUser.id &&
            item.responsibleArea === "COMMERCIAL";
          const isMyAreaWithoutAssignee =
            !item.assigneeId &&
            currentUser.accessibleAreas.includes(item.responsibleArea);
          if (
            !isAssignedToMe &&
            !isMyDealAsSeller &&
            !isMyAreaWithoutAssignee
          ) {
            return false;
          }
        } else if (scope === "MY_AREA") {
          const inMyArea = currentUser.accessibleAreas.includes(
            item.responsibleArea,
          );
          const isAssignedToMe = item.assigneeId === currentUser.id;
          if (!inMyArea && !isAssignedToMe) {
            return false;
          }
        }
      }

      // 2. Tipo de atividade
      if (activityType !== "ALL" && item.activityType !== activityType) {
        return false;
      }

      // 3. Área específica
      if (areaFilter !== "ALL" && item.responsibleArea !== areaFilter) {
        return false;
      }

      // 4. Situação
      if (situation === "AVAILABLE_NOW" && !item.isAvailableNow) {
        return false;
      }
      if (situation === "WAITING_PREVIOUS" && !item.isWaitingPrevious) {
        return false;
      }
      if (situation === "COMPLETED" && !item.isCompleted) {
        return false;
      }

      // 5. Prazo
      if (deadlineFilter === "OVERDUE" && !item.isOverdue) {
        return false;
      }
      if (deadlineFilter === "ON_TIME" && item.isOverdue) {
        return false;
      }

      // 6. Busca textual
      if (normalizedQuery) {
        const hay = `${item.deal.dealNumber} ${item.customerName} ${item.vehicle.brand} ${item.vehicle.model} ${item.vehicle.internalCode} ${item.vehicle.vin} ${item.actionTitle} ${item.responsibleLabel}`.toLowerCase();
        if (!hay.includes(normalizedQuery)) return false;
      }

      return true;
    });
  }, [
    unifiedItems,
    currentUser,
    scope,
    activityType,
    areaFilter,
    situation,
    deadlineFilter,
    normalizedQuery,
  ]);

  // Contadores rápidos sobre o conjunto de itens disponíveis
  const stats = useMemo(() => {
    const availableNow = unifiedItems.filter((i) => i.isAvailableNow).length;
    const overdue = unifiedItems.filter((i) => i.isOverdue).length;
    const readyForReleaseDeals = deals.filter(
      (d) => d.deal.status === "ELIGIBLE_FOR_AUTHORIZATION",
    ).length;
    return { availableNow, overdue, readyForReleaseDeals };
  }, [unifiedItems, deals]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho de Pendências Unificadas */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#172B3A]">
            Pendências
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Atividades operacionais, conferências de documentos, aprovações e
            liberações priorizadas pelo que pode ser executado agora.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="rounded-xl bg-[#EAF3FC] border border-[#1684D8]/30 px-3.5 py-2 text-xs">
            <span className="text-[#0B3B70] font-semibold block">
              Disponíveis agora
            </span>
            <strong className="text-base font-extrabold text-[#0B3B70]">
              {stats.availableNow}
            </strong>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2 text-xs">
            <span className="text-red-700 font-semibold block">Em atraso</span>
            <strong className="text-base font-extrabold text-red-900">
              {stats.overdue}
            </strong>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs">
            <span className="text-amber-800 font-semibold block">
              Prontas p/ autorizar
            </span>
            <strong className="text-base font-extrabold text-amber-950">
              {stats.readyForReleaseDeals}
            </strong>
          </div>
        </div>
      </div>

      {/* Painel de Filtros Unificados */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Linha 1: Escopo (Minha responsabilidade / Minha área / Toda a equipe) + Situação */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1">
              Responsabilidade:
            </span>
            {(
              [
                { id: "MINE" as const, label: "Minha responsabilidade" },
                { id: "MY_AREA" as const, label: "Minha área" },
                ...(canSeeTeam
                  ? [{ id: "TEAM" as const, label: "Toda a equipe" }]
                  : []),
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setScope(s.id);
                  syncUrlParams({ scope: s.id });
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  scope === s.id
                    ? "bg-[#0B3B70] text-white"
                    : "bg-[#F4F7FA] text-slate-700 hover:bg-[#EAF3FC] hover:text-[#0B3B70]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1">
              Situação:
            </span>
            {(
              [
                { id: "AVAILABLE_NOW" as const, label: "Disponíveis agora" },
                {
                  id: "WAITING_PREVIOUS" as const,
                  label: "Etapas futuras",
                },
                { id: "COMPLETED" as const, label: "Concluídas" },
                { id: "ALL" as const, label: "Todas" },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setSituation(st.id);
                  syncUrlParams({ situation: st.id });
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  situation === st.id
                    ? "bg-[#1684D8] text-white"
                    : "bg-[#F4F7FA] text-slate-700 hover:bg-[#EAF3FC] hover:text-[#0B3B70]"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Linha 2: Busca, Tipo de atividade, Área e Prazo */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-5 relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              aria-label="Buscar pendência por negociação, veículo, cliente ou atividade"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                syncUrlParams({ q: e.target.value });
              }}
              placeholder="Buscar por negociação, veículo, cliente ou atividade..."
              className="w-full rounded-xl border border-slate-300 bg-[#F4F7FA]/60 focus:bg-white pl-9 pr-3 py-2 text-xs text-[#172B3A]"
            />
          </div>

          <div className="lg:col-span-3">
            <select
              aria-label="Filtrar por tipo de atividade"
              value={activityType}
              onChange={(e) => {
                const next = e.target.value as ActivityTypeFilter;
                setActivityType(next);
                syncUrlParams({ type: next });
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-[#172B3A]"
            >
              <option value="ALL">Todos os tipos de atividade</option>
              <option value="DOCUMENT">Documentos e conferência</option>
              <option value="APPROVAL">Aprovações formais</option>
              <option value="TASK">Atividades operacionais</option>
              <option value="MILESTONE">
                Faturamento, autorização e entrega
              </option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filtrar por área"
              value={areaFilter}
              onChange={(e) => {
                const next = e.target.value as ResponsibleArea | "ALL";
                setAreaFilter(next);
                syncUrlParams({ area: next });
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-[#172B3A]"
            >
              <option value="ALL">Todas as áreas</option>
              {(Object.keys(AREA_LABELS) as ResponsibleArea[]).map((a) => (
                <option key={a} value={a}>
                  {AREA_LABELS[a]}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filtrar por prazo"
              value={deadlineFilter}
              onChange={(e) => {
                const next = e.target.value as DeadlineFilter;
                setDeadlineFilter(next);
                syncUrlParams({ deadline: next });
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-[#172B3A]"
            >
              <option value="ALL">Todos os prazos</option>
              <option value="OVERDUE">Em atraso</option>
              <option value="ON_TIME">No prazo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista Unificada de Pendências */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-[#F4F7FA]/60">
          <span className="text-xs font-bold text-[#172B3A]">
            Exibindo {filteredItems.length} item(ns) na fila
          </span>
          {(scope !== initialScope ||
            activityType !== "ALL" ||
            situation !== "AVAILABLE_NOW" ||
            deadlineFilter !== "ALL" ||
            areaFilter !== "ALL" ||
            search) && (
            <button
              type="button"
              onClick={() => {
                const resetScope = canSeeTeam ? "TEAM" : "MINE";
                setScope(resetScope);
                setActivityType("ALL");
                setSituation("AVAILABLE_NOW");
                setDeadlineFilter("ALL");
                setAreaFilter("ALL");
                setSearch("");
                router.replace(pathname, { scroll: false });
              }}
              className="text-xs font-bold text-[#1684D8] hover:underline"
            >
              Mostrar todas as disponíveis agora
            </button>
          )}
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-bold text-[#172B3A]">
              Nenhuma pendência encontrada com os filtros atuais.
            </p>
            <p className="text-xs text-slate-500">
              Você pode alternar para &ldquo;Toda a equipe&rdquo; ou &ldquo;Todas
              as situações&rdquo; para consultar outras etapas.
            </p>
            {canSeeTeam && scope !== "TEAM" && (
              <button
                type="button"
                onClick={() => {
                  setScope("TEAM");
                  syncUrlParams({ scope: "TEAM" });
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#EAF3FC] px-3.5 py-2 text-xs font-bold text-[#0B3B70] hover:bg-[#1684D8] hover:text-white transition"
              >
                Ver fila de toda a equipe
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F4F7FA] text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 pl-5 pr-3">Negociação</th>
                  <th className="py-3 px-3">Veículo</th>
                  <th className="py-3 px-3">Ação necessária</th>
                  <th className="py-3 px-3">Responsável</th>
                  <th className="py-3 px-3">Prazo</th>
                  <th className="py-3 px-3">Situação</th>
                  <th className="py-3 pl-3 pr-5 text-right">Executar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.map((item) => {
                  const hrefParams = new URLSearchParams();
                  hrefParams.set("tab", item.targetTab);
                  if (item.targetTaskCode) {
                    hrefParams.set("taskCode", item.targetTaskCode);
                  }
                  if (item.targetDocId) {
                    hrefParams.set("docId", item.targetDocId);
                  }
                  hrefParams.set("from", currentQueueUrl);

                  const targetHref = `/app/negociacoes/${item.deal.id}?${hrefParams.toString()}`;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#F4F7FA]/70 transition ${
                        item.isOverdue ? "bg-red-50/30" : ""
                      }`}
                    >
                      {/* Negociação + Cliente */}
                      <td className="py-3.5 pl-5 pr-3">
                        <span className="font-mono font-extrabold text-[#0B3B70] block">
                          {item.deal.dealNumber}
                        </span>
                        <span className="text-[11px] text-slate-600 font-medium block truncate max-w-[10rem]">
                          {item.customerName}
                        </span>
                      </td>

                      {/* Veículo */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-[#172B3A]">
                          {item.vehicle.brand} {item.vehicle.model}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.vehicle.internalCode} • {item.vehicle.color}
                        </div>
                      </td>

                      {/* Ação necessária */}
                      <td className="py-3.5 px-3 max-w-xs">
                        <div className="font-bold text-[#172B3A] flex items-center gap-1.5">
                          {item.activityType === "DOCUMENT" ? (
                            <FileCheck2 className="h-3.5 w-3.5 text-[#1684D8] shrink-0" />
                          ) : item.activityType === "MILESTONE" ? (
                            <KeyRound className="h-3.5 w-3.5 text-[#1684D8] shrink-0" />
                          ) : (
                            <ClipboardCheck className="h-3.5 w-3.5 text-[#1684D8] shrink-0" />
                          )}
                          <span>{item.actionTitle}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {item.actionSubtitle}
                        </p>
                      </td>

                      {/* Responsável */}
                      <td className="py-3.5 px-3">
                        <span className="inline-block rounded bg-[#EAF3FC] px-2 py-0.5 text-[11px] font-bold text-[#0B3B70]">
                          {AREA_LABELS[item.responsibleArea]}
                        </span>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          {item.responsibleLabel}
                        </div>
                      </td>

                      {/* Prazo */}
                      <td className="py-3.5 px-3">
                        {item.isWaitingPrevious ? (
                          <span className="text-[11px] text-slate-500">
                            Inicia após etapa anterior
                          </span>
                        ) : item.dueAt ? (
                          <div className="space-y-0.5">
                            <span className="text-[#172B3A] font-medium flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                              {formatDateTimeBr(item.dueAt)}
                            </span>
                            {item.isOverdue && (
                              <span className="inline-flex items-center gap-1 rounded bg-red-100 text-red-900 px-1.5 py-0.5 text-[10px] font-bold">
                                <AlertTriangle className="h-3 w-3 text-red-600" />
                                Em atraso
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            Imediato
                          </span>
                        )}
                      </td>

                      {/* Situação */}
                      <td className="py-3.5 px-3">
                        {item.docStatus ? (
                          <DocumentStatusBadge status={item.docStatus} />
                        ) : item.taskState ? (
                          <TaskStateBadge state={item.taskState} />
                        ) : (
                          <DealStatusBadge status={item.deal.status} />
                        )}
                      </td>

                      {/* Ação direta */}
                      <td className="py-3.5 pl-3 pr-5 text-right">
                        <Link
                          href={targetHref}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3B70] hover:bg-[#1684D8] px-3.5 py-2 text-xs font-bold text-white transition whitespace-nowrap"
                        >
                          <span>{item.actionButtonLabel}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
