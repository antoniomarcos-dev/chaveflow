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
  BookOpen,
  Building2,
  CheckCircle2,
  History,
  Lock,
  Search,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import {
  ActivationLinkCard,
  type AccountActivation,
} from "./ActivationLinkCard";

export function OrganizationSettingsClient({
  organization,
  branches,
  members,
  auditEvents,
  canManageUsers,
  currentUserId,
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
  currentUserId: string;
}) {
  const router = useRouter();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [activation, setActivation] = useState<AccountActivation | null>(null);
  async function manageAccess(profileId: string, accessAction: string) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MANAGE_COLLABORATOR",
          profileId,
          accessAction,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (data.activationPath) setActivation(data);
      setSuccess(
        accessAction === "DISABLE"
          ? "Acesso desativado."
          : accessAction === "ENABLE"
            ? "Acesso reativado."
            : "Novo link gerado.",
      );
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível atualizar o acesso.",
      );
    } finally {
      setLoading(false);
    }
  }
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [selectedRoles, setSelectedRoles] = useState<RoleCode[]>(["SELLER"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [activeTheme, setActiveTheme] = useState<
    "ALL" | "USERS" | "GENERAL" | "ROLES" | "AUDIT"
  >("ALL");

  const filteredMembers = members.filter((m) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.trim().toLowerCase();
    const roleLabels = m.roles.map((r) => ROLE_LABELS[r]).join(" ");
    return `${m.fullName} ${m.email} ${m.branchName} ${roleLabels}`
      .toLowerCase()
      .includes(q);
  });

  const filteredAudit = auditEvents.filter((ev) => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.trim().toLowerCase();
    return `${ev.action} ${ev.actorName} ${ev.actorRole} ${ev.summary} ${ev.entityType}`
      .toLowerCase()
      .includes(q);
  });

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
      setActivation(data);
      setShowInviteForm(false);
      setEmail("");
      setFullName("");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Falha de conexão. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho (4.14 Administração, configurações e auditoria — Telas 11 e 12) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="eyebrow">
            Administração, Configurações e Auditoria
          </span>
          <h1 className="text-2xl font-extrabold text-[#172B3A] mt-1">
            Gestão de Usuários, Configurações e Auditoria
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Gerencie os usuários, perfis, unidades da concessionária e consulte a trilha de auditoria pesquisável.
          </p>
        </div>

        {canManageUsers && (
          <button
            type="button"
            onClick={() => setShowInviteForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            <span>+ Novo Usuário / Colaborador</span>
          </button>
        )}
      </div>

      {/* Agrupamento por tema (Tela 11 da prancha) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "ALL", label: "Visão Completa", icon: Settings },
              { id: "USERS", label: "Usuários e Acessos", icon: Users },
              { id: "GENERAL", label: "Geral e Unidades", icon: Building2 },
              { id: "ROLES", label: "Perfis e Permissões", icon: Lock },
              { id: "AUDIT", label: "Trilha de Auditoria", icon: History },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTheme === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTheme(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  active
                    ? "bg-[#EAF3FC] text-[#0B3B70] border border-[#1684D8]/30"
                    : "text-slate-600 hover:bg-slate-100 hover:text-[#172B3A]"
                }`}
              >
                <Icon className="h-3.5 w-3.5 text-[#1684D8]" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <Link
          href="/app/procedimentos"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4F7FA] hover:bg-[#EAF3FC] border border-slate-200 px-3 py-2 text-xs font-bold text-[#0B3B70] transition"
        >
          <BookOpen className="h-3.5 w-3.5 text-[#1684D8]" />
          <span>Etapas, Procedimentos e Regras →</span>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Vendedores ativos",
            value: members.filter(
              (m) => m.roles.includes("SELLER") && m.isActive,
            ).length,
          },
          {
            label: "Equipe interna ativa",
            value: members.filter(
              (m) => !m.roles.includes("CUSTOMER") && m.isActive,
            ).length,
          },
          {
            label: "Clientes com conta",
            value: members.filter(
              (m) => m.roles.includes("CUSTOMER") && m.isActive,
            ).length,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs"
          >
            <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#0B3B70]">
              {stat.value}
            </p>
          </div>
        ))}
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

      {activation && (
        <ActivationLinkCard
          key={activation.activationPath}
          access={activation}
          onClose={() => setActivation(null)}
        />
      )}
      {/* Formulário de Convite de Colaborador */}
      {showInviteForm && canManageUsers && (
        <form
          onSubmit={handleInvite}
          className="bg-white rounded-2xl border-2 border-[#1684D8] p-6 shadow-md space-y-4 text-xs"
        >
          <h2 className="text-base font-bold text-[#172B3A]">
            Novo acesso da equipe
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="invite-name"
                className="font-semibold text-slate-700 block"
              >
                Nome Completo *
              </label>
              <input
                id="invite-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[#172B3A]"
              />
            </div>
            <div>
              <label
                htmlFor="invite-email"
                className="font-semibold text-slate-700 block"
              >
                E-mail Corporativo *
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[#172B3A]"
              />
            </div>
            <div>
              <label
                htmlFor="invite-branch"
                className="font-semibold text-slate-700 block"
              >
                Unidade *
              </label>
              <select
                id="invite-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[#172B3A]"
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
                        ? "bg-[#1684D8] text-white border-[#1684D8]"
                        : "bg-slate-50 text-slate-700 border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                      className="sr-only"
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
              className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || selectedRoles.length === 0}
              className="rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-5 py-2 font-bold text-white transition"
            >
              Cadastrar e gerar link de acesso
            </button>
          </div>
        </form>
      )}

      {/* Identidade da Organização e Unidades */}
      {(activeTheme === "ALL" || activeTheme === "GENERAL") && (
        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#1684D8]" />
            <h2 className="text-base font-bold text-[#172B3A]">
              Unidade e Organização ({organization.name})
            </h2>
          </div>
          <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3.5 text-xs space-y-1">
            <div className="font-extrabold text-[#172B3A] text-sm">
              {organization.name}
            </div>
            <div className="text-slate-600">
              CNPJ: <code className="font-mono">{organization.cnpj}</code>
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
                  <div className="font-bold text-[#172B3A]">
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
      )}

      {/* Usuários e Acessos (Tela 12 da prancha) */}
      {(activeTheme === "ALL" ||
        activeTheme === "USERS" ||
        activeTheme === "ROLES") && (
        <section className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#1684D8]" />
              <h2 className="text-base font-bold text-[#172B3A]">
                Usuários e Acessos ({filteredMembers.length})
              </h2>
            </div>

            <div className="relative sm:w-80">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar por nome, e-mail ou perfil..."
                className="w-full rounded-xl border border-slate-300 bg-[#F4F7FA]/60 focus:bg-white pl-9 pr-3 py-1.5 text-xs text-[#172B3A]"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
            {filteredMembers.map((m) => {
              const initials = m.fullName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase())
                .join("");
              return (
                <div
                  key={m.membershipId}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F4F7FA]/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#1684D8] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div>
                      <div className="font-bold text-[#172B3A]">{m.fullName}</div>
                      <div className="text-slate-500">
                        {m.email} {m.phone ? `• ${m.phone}` : ""} • {m.branchName}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {m.roles.map((r) => (
                      <span
                        key={r}
                        className="rounded-md bg-[#EAF3FC] border border-[#1684D8]/30 px-2.5 py-1 font-bold text-[#0B3B70]"
                      >
                        {ROLE_LABELS[r]}
                      </span>
                    ))}
                    <span
                      className={`rounded-md px-2.5 py-1 font-bold ${
                        m.isActive
                          ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {m.isActive ? "Ativo" : "Desativado"}
                    </span>
                    {canManageUsers &&
                      m.profileId !== currentUserId &&
                      !m.roles.includes("CUSTOMER") && (
                        <>
                          <button
                            type="button"
                            disabled={loading || !m.isActive}
                            onClick={() => manageAccess(m.profileId, "REISSUE")}
                            className="rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-1.5 font-semibold text-[#172B3A] disabled:opacity-40"
                          >
                            Gerar link de acesso
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() =>
                              manageAccess(
                                m.profileId,
                                m.isActive ? "DISABLE" : "ENABLE",
                              )
                            }
                            className="rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-1.5 font-semibold text-slate-600"
                          >
                            {m.isActive ? "Desativar" : "Reativar"}
                          </button>
                        </>
                      )}
                  </div>
                </div>
              );
            })}
          </div>

          <details
            open={activeTheme === "ROLES"}
            className="rounded-xl border border-slate-200 p-4 space-y-3"
          >
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[#0B3B70] flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-[#1684D8]" />
              <span>Perfis e Matriz de Permissões (O que cada perfil pode fazer)</span>
            </summary>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs pt-2">
              {(Object.keys(ROLE_PERMISSION_MAP) as RoleCode[]).map((role) => (
                <div
                  key={role}
                  className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3 space-y-1"
                >
                  <div className="font-bold text-[#172B3A]">
                    {ROLE_LABELS[role]}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {ROLE_PERMISSION_MAP[role]
                      .map((p) => PERMISSION_LABELS[p])
                      .join(" • ")}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}

      {/* Auditoria Completa e Pesquisável da Organização */}
      {(activeTheme === "ALL" || activeTheme === "AUDIT") && (
        <section className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-[#1684D8]" />
              <div>
                <h2 className="text-base font-bold text-[#172B3A]">
                  Trilha de Auditoria da Organização ({filteredAudit.length} eventos)
                </h2>
                <p className="text-xs text-slate-500">
                  Registro cronológico imutável e pesquisável de todas as ações relevantes (criações, aprovações, bloqueios, substituições e entregas).
                </p>
              </div>
            </div>

            <div className="relative sm:w-80">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                aria-label="Pesquisar registros de auditoria"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Pesquisar evento, usuário ou ação..."
                className="w-full rounded-xl border border-slate-300 bg-[#F4F7FA]/60 focus:bg-white pl-9 pr-3 py-1.5 text-xs text-[#172B3A]"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs max-h-96 overflow-y-auto">
            {filteredAudit.map((ev) => (
              <div key={ev.id} className="p-3.5 hover:bg-[#F4F7FA]/60 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-[#172B3A]">
                    <code className="bg-[#EAF3FC] text-[#0B3B70] border border-[#1684D8]/30 px-1.5 py-0.5 rounded mr-2 font-mono">
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
      )}
    </div>
  );
}
