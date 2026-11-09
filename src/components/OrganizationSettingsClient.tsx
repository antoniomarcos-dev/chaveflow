"use client";

import { ROLE_PERMISSION_MAP } from "@/domain/permissions";
import {
  AuditEvent,
  Branch,
  Organization,
  PERMISSION_LABELS,
  ROLE_LABELS,
  RoleCode,
} from "@/domain/types";
import { formatDateTimeBr } from "@/lib/format";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  History,
  Lock,
  UserPlus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export function OrganizationSettingsClient({
  organization,
  branches,
  members,
  auditEvents,
  canManageUsers,
}: {
  organization: Organization;
  branches: Branch[];
  members: Array<{
    membershipId: string;
    profileId: string;
    fullName: string;
    email: string;
    phone: string;
    branchName: string;
    roles: RoleCode[];
    isActive: boolean;
  }>;
  auditEvents: AuditEvent[];
  canManageUsers: boolean;
}) {
  const router = useRouter();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [selectedRoles, setSelectedRoles] = useState<RoleCode[]>(["SELLER"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function toggleRole(r: RoleCode) {
    setSelectedRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "INVITE_COLLABORATOR",
          email,
          fullName,
          phone,
          branchId,
          roles: selectedRoles,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Não foi possível convidar o colaborador.");
        return;
      }
      setSuccess(
        `Colaborador '${fullName}' convidado e vinculado à organização com sucesso!`,
      );
      setShowInviteForm(false);
      setEmail("");
      setFullName("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
            Governança Multi-Tenant, RBAC e Rastreabilidade
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
            Administração, Funções e Auditoria
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Controle de organização, unidades, convite de colaboradores, matriz
            de permissões e trilha de auditoria imutável.
          </p>
        </div>

        {canManageUsers && (
          <button
            type="button"
            onClick={() => setShowInviteForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            <span>Convidar Colaborador</span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-300 p-4 text-xs text-red-900 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Formulário de Convite de Colaborador */}
      {showInviteForm && canManageUsers && (
        <form
          onSubmit={handleInvite}
          className="bg-white rounded-2xl border-2 border-teal-500 p-6 shadow-md space-y-4 text-xs"
        >
          <h2 className="text-base font-bold text-slate-900">
            Convidar Novo Colaborador para {organization.name}
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block">
                E-mail Corporativo *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block">
                Unidade *
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="font-semibold text-slate-700 block mb-2">
              Funções Autorizadas (Um usuário pode acumular múltiplas funções):
            </span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ROLE_LABELS) as RoleCode[])
                .filter((r) => r !== "CUSTOMER")
                .map((role) => (
                  <label
                    key={role}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 font-semibold transition ${
                      selectedRoles.includes(role)
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-slate-50 text-slate-700 border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                      className="hidden"
                    />
                    <span>{ROLE_LABELS[role]}</span>
                  </label>
                ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowInviteForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || selectedRoles.length === 0}
              className="rounded-lg bg-teal-600 px-5 py-2 font-bold text-white"
            >
              Enviar Convite e Atribuir Funções
            </button>
          </div>
        </form>
      )}

      {/* Identidade da Organização e Unidades */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">
              Identidade da Organização e Unidades
            </h2>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1">
            <div className="font-extrabold text-slate-900 text-sm">
              {organization.name}
            </div>
            <div className="text-slate-600">
              CNPJ: <code>{organization.cnpj}</code> • Slug:{" "}
              <code>{organization.slug}</code>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-bold text-slate-700">
              Unidades Cadastradas ({branches.length}):
            </div>
            {branches.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    {b.code} — {b.name}
                  </div>
                  <div className="text-slate-500">
                    {b.address} • {b.city}/{b.state} • {b.phone}
                  </div>
                </div>
                <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                  Ativa
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Estado Explícito de Integrações e Adaptadores */}
      </div>

      {/* Usuários e Matriz de Permissões */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-teal-600" />
          <h2 className="text-base font-bold text-slate-900">
            Usuários e Funções na Organização ({members.length})
          </h2>
        </div>

        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
          {members.map((m) => (
            <div
              key={m.membershipId}
              className="p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <div className="font-bold text-slate-900">{m.fullName}</div>
                <div className="text-slate-500">
                  {m.email} • {m.phone} • {m.branchName}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {m.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-md bg-teal-50 border border-teal-200 px-2.5 py-1 font-bold text-teal-900"
                  >
                    {ROLE_LABELS[r]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            <span>
              Matriz de Permissões Verificadas no Servidor por Função:
            </span>
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {(Object.keys(ROLE_PERMISSION_MAP) as RoleCode[]).map((role) => (
              <div
                key={role}
                className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1"
              >
                <div className="font-bold text-slate-900">
                  {ROLE_LABELS[role]} ({role})
                </div>
                <div className="text-[11px] text-slate-600">
                  {ROLE_PERMISSION_MAP[role]
                    .map((p) => PERMISSION_LABELS[p])
                    .join(" • ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Auditoria Completa da Organização */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-teal-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Trilha de Auditoria da Organização ({auditEvents.length} eventos)
            </h2>
            <p className="text-xs text-slate-500">
              Registro cronológico imutável de todas as ações relevantes
              (criações, aprovações, bloqueios, substituições e entregas).
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs max-h-96 overflow-y-auto">
          {auditEvents.map((ev) => (
            <div key={ev.id} className="p-3.5 hover:bg-slate-50 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-900">
                  <code className="bg-slate-100 px-1.5 py-0.5 rounded mr-2">
                    {ev.action}
                  </code>
                  {ev.actorName} ({ev.actorRole})
                </span>
                <span className="text-[11px] text-slate-500">
                  {formatDateTimeBr(ev.createdAt)}
                </span>
              </div>
              <p className="text-slate-700">{ev.summary}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
