"use client";

import { canActOnArea } from "@/domain/permissions";
import type { RoleCode, TaskTemplate } from "@/domain/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type TaskDefault = Pick<
  TaskTemplate,
  "id" | "title" | "slaHours" | "defaultAssigneeId" | "responsibleArea"
>;
type StaffMember = { id: string; fullName: string; roles: RoleCode[] };

function TaskDefaultRow({
  task,
  staff,
}: {
  task: TaskDefault;
  staff: StaffMember[];
}) {
  const router = useRouter();
  const [hours, setHours] = useState(String(task.slaHours));
  const [assignee, setAssignee] = useState(task.defaultAssigneeId || "");
  const [saved, setSaved] = useState({
    hours: String(task.slaHours),
    assignee: task.defaultAssigneeId || "",
  });
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const changed = hours !== saved.hours || assignee !== saved.assignee;
  const eligibleStaff = staff.filter((person) =>
    canActOnArea({ roles: person.roles }, task.responsibleArea),
  );

  return (
    <form
      aria-label={`Configurar ${task.title}`}
      className="border-t border-slate-100 px-4 py-4 sm:px-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setMessage("");
        setError(false);
        const value = Number(hours);
        if (!Number.isInteger(value) || value < 1 || value > 720) {
          setError(true);
          setMessage("Informe um prazo de 1 a 720 horas.");
          return;
        }
        setBusy(true);
        try {
          const response = await fetch("/api/admin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "UPDATE_SLA",
              taskTemplateId: task.id,
              slaHours: value,
              defaultAssigneeId: assignee || null,
            }),
          });
          const result = await response.json();
          if (!response.ok || !result.ok)
            throw new Error(result.error || "Não foi possível salvar.");
          const updatedHours = String(result.template.slaHours),
            updatedAssignee = result.template.defaultAssigneeId || "";
          setHours(updatedHours);
          setAssignee(updatedAssignee);
          setSaved({ hours: updatedHours, assignee: updatedAssignee });
          setMessage("Salvo.");
          router.refresh();
        } catch (reason) {
          setError(true);
          setMessage(
            reason instanceof Error
              ? reason.message
              : "Falha de conexão. Tente novamente.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_100px_minmax(160px,220px)_80px]">
        <h3 className="text-sm font-medium leading-relaxed text-slate-800">
          {task.title}
        </h3>
        <label className="block text-xs text-slate-500">
          <span className="mb-1 block sm:sr-only">Prazo em horas</span>
          <input
            aria-label={`Prazo em horas — ${task.title}`}
            type="number"
            min={1}
            max={720}
            step={1}
            required
            disabled={busy}
            value={hours}
            onChange={(event) => {
              setHours(event.target.value);
              setMessage("");
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="block text-xs text-slate-500">
          <span className="mb-1 block sm:sr-only">Responsável</span>
          <select
            aria-label={`Responsável — ${task.title}`}
            disabled={busy}
            value={assignee}
            onChange={(event) => {
              setAssignee(event.target.value);
              setMessage("");
            }}
            className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">Definir na negociação</option>
            {assignee &&
              !eligibleStaff.some((person) => person.id === assignee) && (
                <option value={assignee} disabled>
                  Responsável indisponível
                </option>
              )}
            {eligibleStaff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={busy || !changed}
          type="submit"
          className="rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-3 py-2 text-sm font-bold text-white transition disabled:bg-slate-100 disabled:text-slate-400"
        >
          {busy ? "Salvando…" : "Salvar"}
        </button>
      </div>
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={`mt-2 text-xs ${error ? "text-red-700" : "text-emerald-700"}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}

export function TaskDefaultsClient({
  tasks,
  staff,
}: {
  tasks: TaskDefault[];
  staff: StaffMember[];
}) {
  return (
    <details className="rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-800">
        Ajustar prazos e responsáveis
      </summary>
      <p className="px-5 pb-4 text-sm text-slate-500">
        Opcional. As alterações valem apenas para novas negociações.
      </p>
      <div className="hidden grid-cols-[minmax(0,1fr)_100px_minmax(160px,220px)_80px] gap-3 border-t border-slate-100 bg-slate-50 px-5 py-2 text-xs font-medium text-slate-500 sm:grid">
        <span>Tarefa</span>
        <span>Prazo (horas)</span>
        <span>Responsável</span>
        <span />
      </div>
      {tasks.length ? (
        tasks.map((task) => (
          <TaskDefaultRow key={task.id} task={task} staff={staff} />
        ))
      ) : (
        <p className="px-5 pb-5 text-sm text-slate-500">
          Nenhuma tarefa configurada.
        </p>
      )}
    </details>
  );
}
