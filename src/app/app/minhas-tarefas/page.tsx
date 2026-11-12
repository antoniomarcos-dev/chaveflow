import { TaskStateBadge } from "@/components/StatusBadge";
import { canActOnArea } from "@/domain/permissions";
import { AREA_LABELS, ROLE_LABELS } from "@/domain/types";
import { recalculateTaskStates } from "@/domain/workflow-engine";
import { loadDatabaseState } from "@/infrastructure/database";
import { formatDateTimeBr } from "@/lib/format";
import { requireInternalSession } from "@/lib/server-session";
import { AlertTriangle, ArrowRight, CheckSquare, Clock } from "lucide-react";
import Link from "next/link";

export default async function MinhasTarefasPage() {
  const ctx = await requireInternalSession();
  const db = await loadDatabaseState();

  const orgDeals = db.deals.filter(
    (d) =>
      d.organizationId === ctx.organization.id &&
      d.status !== "DRAFT" &&
      d.status !== "CANCELLED",
  );

  const enrichedTasks = orgDeals.flatMap((deal) => {
    const vehicle = db.vehicles.find((v) => v.id === deal.vehicleId)!;
    const customer = db.customers.find((c) => c.id === deal.customerId)!;
    const rawTasks = db.taskInstances.filter((t) => t.dealId === deal.id);
    const docs = db.documents.filter((d) => d.dealId === deal.id);
    const recalculated = recalculateTaskStates(rawTasks, docs);

    return recalculated
      .filter(
        (t) =>
          t.state !== "WAIVED_BY_RULE" &&
          t.state !== "CANCELLED" &&
          (t.assigneeId === ctx.profile.id ||
            canActOnArea(ctx, t.responsibleArea)),
      )
      .map((task) => ({
        task,
        deal,
        vehicle,
        customerName: customer.fullName,
        isOverdue:
          task.state !== "COMPLETED" &&
          task.dueAt !== null &&
          new Date(task.dueAt).getTime() < Date.now(),
      }));
  });

  const openTasks = enrichedTasks.filter((t) => t.task.state !== "COMPLETED");
  const overdueTasks = openTasks.filter((t) => t.isOverdue);
  const dueTodayOrFutureTasks = openTasks.filter((t) => !t.isOverdue);
  const completedTasks = enrichedTasks.filter(
    (t) => t.task.state === "COMPLETED",
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="eyebrow">
            Fila Individual e por Área Autorizada
          </span>
          <h1 className="text-2xl font-extrabold text-[#172B3A] mt-1">
            Minhas Tarefas ({openTasks.length} abertas)
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Exibindo tarefas atribuídas a{" "}
            <strong>{ctx.profile.fullName}</strong> ou às áreas das funções{" "}
            <strong>{ctx.roles.map((r) => ROLE_LABELS[r]).join(", ")}</strong>.
          </p>
        </div>

        {/* Contadores rápidos por situação (4.10 Minhas tarefas) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2 text-xs">
            <span className="text-red-700 font-semibold block">Vencidas</span>
            <strong className="text-base font-extrabold text-red-900">
              {overdueTasks.length}
            </strong>
          </div>
          <div className="rounded-xl bg-[#EAF3FC] border border-[#1684D8]/30 px-3.5 py-2 text-xs">
            <span className="text-[#0B3B70] font-semibold block">
              Para hoje / Futuras
            </span>
            <strong className="text-base font-extrabold text-[#0B3B70]">
              {dueTodayOrFutureTasks.length}
            </strong>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs">
            <span className="text-emerald-700 font-semibold block">
              Concluídas
            </span>
            <strong className="text-base font-extrabold text-emerald-900">
              {completedTasks.length}
            </strong>
          </div>
        </div>
      </div>

      {/* Tarefas em Aberto */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-[#1684D8]" />
          <span>Tarefas Abertas / Aguardando Ação ({openTasks.length})</span>
        </h2>

        {openTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            Nenhuma tarefa pendente para o seu perfil neste momento.
          </div>
        ) : (
          <div className="space-y-3">
            {openTasks.map(
              ({ task, deal, vehicle, customerName, isOverdue }) => (
                <div
                  key={task.id}
                  className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 ${
                    isOverdue ? "border-red-300" : "border-slate-200/90"
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-[#EAF3FC] text-[#0B3B70] border border-[#1684D8]/30 px-2.5 py-0.5 rounded">
                        {deal.dealNumber}
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#172B3A]">
                        {vehicle.internalCode} ({vehicle.brand} {vehicle.model})
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                        Área: {AREA_LABELS[task.responsibleArea]}
                      </span>
                      <TaskStateBadge state={task.state} />
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 rounded bg-red-100 text-red-900 border border-red-200 px-2 py-0.5 text-xs font-bold">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                          Prazo Ultrapassado
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-extrabold text-[#172B3A]">
                      {task.title}
                    </h3>
                    <p className="text-xs text-slate-600">{task.description}</p>

                    {task.pendingReason && (
                      <p className="text-xs text-amber-900 font-medium bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                        Situação: {task.pendingReason}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                      <span>Comprador: <strong>{customerName}</strong></span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-[#1684D8]" />
                        Prazo: {formatDateTimeBr(task.dueAt)}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/app/negociacoes/${deal.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white shrink-0 transition"
                  >
                    <span>Executar no Passaporte</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      {/* Tarefas Concluídas */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[#172B3A]">
          Tarefas Concluídas Recentemente ({completedTasks.length})
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {completedTasks.map(({ task, deal, vehicle }) => (
            <div
              key={task.id}
              className="bg-white rounded-xl border border-slate-200/90 p-4 flex items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="font-bold text-[#172B3A]">
                  {deal.dealNumber} • {task.title}
                </div>
                <div className="text-slate-500 mt-0.5">
                  {vehicle.internalCode} — Concluída em{" "}
                  {formatDateTimeBr(task.completedAt)}
                </div>
              </div>
              <Link
                href={`/app/negociacoes/${deal.id}`}
                className="text-[#1684D8] font-bold hover:underline shrink-0"
              >
                Abrir →
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
