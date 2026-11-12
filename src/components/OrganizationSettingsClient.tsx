"use client";

import { ROLE_PERMISSION_MAP } from "@/domain/permissions";
import {
  AuditEvent,
  Branch,
  Organization,
  PERMISSION_LABELS,
  ProcedureSection,
  ResponsibleArea,
  ROLE_LABELS,
  RoleCode,
} from "@/domain/types";
import { formatDateTimeBr } from "@/lib/format";
import {
  AlertCircle,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  History,
  Lock,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import {
  ActivationLinkCard,
  type AccountActivation,
} from "./ActivationLinkCard";
import { ProceduresAdminClient } from "./ProceduresAdminClient";
import { TaskDefaultsClient, type TaskDefault } from "./TaskDefaultsClient";

export type AdminTab = "USERS" | "GENERAL" | "PROCEDURES" | "DEFAULTS" | "AUDIT";

const HUMAN_AUDIT_ACTION_MAP: Record<string, string> = {
  DEAL_CREATED_OR_UPDATED: "Abertura ou atualização da negociação",
  TASK_STATE_CHANGED: "Atualização de atividade",
  TASK_ASSIGNED: "Atribuição de responsável",
  DOCUMENT_UPLOADED: "Envio de documento",
  APPROVED_DOCUMENT_REPLACED: "Substituição de documento aprovado",
  DOCUMENT_REVIEWED: "Conferência de documento",
  ADDITIONAL_DOCUMENT_REQUESTED: "Solicitação de documento adicional",
  FORMAL_APPROVAL_RECORDED: "Decisão de aprovação formal",
  BILLING_REGISTERED: "Faturamento registrado",
  BILLING_ATTEMPT_BLOCKED: "Tentativa de faturamento bloqueada",
  RELEASE_AUTHORIZED: "Autorização de liberação emitida",
  RELEASE_AUTHORIZATION_BLOCKED: "Tentativa de autorização bloqueada",
  DELIVERY_CONFIRMED: "Entrega física confirmada",
  DELIVERY_ATTEMPT_BLOCKED: "Tentativa de entrega bloqueada",
  POST_DELIVERY_ADDENDUM: "Adendo pós-entrega registrado",
  CUSTOMER_ACCESS_GENERATED: "Acesso do cliente gerado",
  CUSTOMER_ACCESS_REVOKED: "Acesso do cliente revogado",
  CUSTOMER_DOCUMENT_UPLOADED: "Documento enviado pelo cliente",
  COLLABORATOR_INVITED: "Convite de novo colaborador",
  COLLABORATOR_UPDATED: "Atualização de dados de colaborador",
  COLLABORATOR_ACCESS_REISSUED: "Reemissão de link de acesso",
  COLLABORATOR_ACCESS_REVOKED: "Acesso de colaborador revogado",
  COLLABORATOR_ACCESS_ENABLED: "Acesso de colaborador ativado",
  COLLABORATOR_ACCESS_DISABLED: "Acesso de colaborador desativado",
  PROCEDURE_PUBLISHED: "Procedimento publicado",
  PROCEDURE_VERSION_CREATED: "Nova versão de procedimento",
  SLA_UPDATED: "Prazo padrão ou responsável atualizado",
  VEHICLE_CREATED: "Veículo cadastrado no estoque",
  VEHICLE_UPDATED: "Cadastro de veículo atualizado",
  VEHICLE_CSV_IMPORTED: "Importação de estoque via CSV",
  PASSWORD_RESET_REQUESTED: "Solicitação de recuperação de senha",
  PASSWORD_RESET_COMPLETED: "Senha redefinida com sucesso",
};

interface EnrichedProcedure {
  id: string;
  code: string;
  title: string;
  responsibleArea: ResponsibleArea;
  areaLabel: string;
  activeVersionId: string | null;
  publishedVersion: {
    id: string;
    versionNumber: number;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    content: string;
    sections: ProcedureSection[];
    authorName: string;
    publishedAt: string | null;
  } | null;
  allVersions: Array<{
    id: string;
    versionNumber: number;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    title: string;
    content: string;
    sections: ProcedureSection[];
    authorName: string;
    publishedAt: string | null;
    createdAt: string;
  }>;
}

export function OrganizationSettingsClient({
  organization,
  branches,
  members,
  auditEvents,
  procedures = [],
  taskTemplates = [],
  internalStaff = [],
  dealNumbersById = {},
  canManageUsers,
  canManageProcedures = false,
  currentUserId,
  initialTab = "USERS",
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
  procedures?: EnrichedProcedure[];
  taskTemplates?: TaskDefault[];
  internalStaff?: Array<{ id: string; fullName: string; roles: RoleCode[] }>;
  dealNumbersById?: Record<string, string>;
  canManageUsers: boolean;
  canManageProcedures?: boolean;
  currentUserId: string;
  initialTab?: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>(
    (initialTab as AdminTab) || "USERS",
  );

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [activation, setActivation] = useState<AccountActivation | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [selectedRoles, setSelectedRoles] = useState<RoleCode[]>(["SELLER"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtros de Usuários
  const [userSearch, setUserSearch] = useState("");

  // Filtros de Auditoria
  const [auditSearch, setAuditSearch] = useState("");
  const [auditPeriod, setAuditPeriod] = useState<"ALL" | "TODAY" | "7DAYS" | "30DAYS">("ALL");
  const [auditActor, setAuditActor] = useState<string>("ALL");
  const [auditCategory, setAuditCategory] = useState<string>("ALL");

  const actorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const ev of auditEvents) {
      if (ev.actorName) set.add(ev.actorName);
    }
    return Array.from(set).sort();
  }, [auditEvents]);

  const filteredMembers = members.filter((m) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.trim().toLowerCase();
    const roleLabels = m.roles.map((r) => ROLE_LABELS[r]).join(" ");
    return `${m.fullName} ${m.email} ${m.branchName} ${roleLabels}`
      .toLowerCase()
      .includes(q);
  });

  const filteredAudit = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    return auditEvents.filter((ev) => {
      // Filtro de período
      if (auditPeriod !== "ALL") {
        const evTime = new Date(ev.createdAt).getTime();
        const diff = now - evTime;
        if (auditPeriod === "TODAY" && diff > oneDayMs) return false;
        if (auditPeriod === "7DAYS" && diff > 7 * oneDayMs) return false;
        if (auditPeriod === "30DAYS" && diff > 30 * oneDayMs) return false;
      }

      // Filtro de pessoa
      if (auditActor !== "ALL" && ev.actorName !== auditActor) {
        return false;
      }

      // Filtro de categoria de evento
      if (auditCategory !== "ALL") {
        if (auditCategory === "DEALS" && !ev.action.startsWith("DEAL_")) return false;
        if (auditCategory === "DOCUMENTS" && !ev.action.includes("DOCUMENT")) return false;
        if (
          auditCategory === "APPROVALS_RELEASE" &&
          !ev.action.includes("APPROVAL") &&
          !ev.action.includes("BILLING") &&
          !ev.action.includes("RELEASE") &&
          !ev.action.includes("DELIVERY")
        )
          return false;
        if (auditCategory === "USERS" && !ev.action.includes("COLLABORATOR") && !ev.action.includes("CUSTOMER_ACCESS") && !ev.action.includes("PASSWORD")) return false;
        if (auditCategory === "PROCEDURES" && !ev.action.includes("PROCEDURE") && !ev.action.includes("SLA")) return false;
      }

      // Busca textual
      if (auditSearch.trim()) {
        const q = auditSearch.trim().toLowerCase();
        const actionLabel = HUMAN_AUDIT_ACTION_MAP[ev.action] || ev.action;
        const dealNum = ev.dealId ? dealNumbersById[ev.dealId] || "" : "";
        const hay = `${actionLabel} ${ev.actorName} ${ev.actorRole} ${ev.summary} ${dealNum}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [auditEvents, auditPeriod, auditActor, auditCategory, auditSearch, dealNumbersById]);

  function toggleRole(r: RoleCode) {
    setSelectedRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  }

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
            : "Novo link de acesso gerado.",
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
        setError(data.error || "Não foi possível cadastrar o colaborador.");
        return;
      }
      setSuccess(
        `Colaborador '${fullName}' cadastrado! O link individual de acesso foi gerado.`,
      );
      setActivation(data);
      setShowInviteForm(false);
      setEmail("");
      setFullName("");
      setPhone("");
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
      {/* Cabeçalho */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#172B3A]">
            Configurações e Administração
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Gestão de usuários, unidades, procedimentos operacionais, prazos e
            trilha de auditoria.
          </p>
        </div>

        {canManageUsers && activeTab === "USERS" && (
          <button
            type="button"
            onClick={() => setShowInviteForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            <span>+ Novo Usuário</span>
          </button>
        )}
      </div>

      {/* 5 Abas Oficiais da Administração (Iniciando em Usuários) */}
      <div
        role="tablist"
        aria-label="Seções de administração"
        className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex flex-wrap gap-1.5"
      >
        {[
          { id: "USERS" as const, label: "Usuários", Icon: Users },
          { id: "GENERAL" as const, label: "Geral e unidades", Icon: Building2 },
          { id: "PROCEDURES" as const, label: "Procedimentos", Icon: BookOpen },
          { id: "DEFAULTS" as const, label: "Prazos e responsáveis", Icon: Clock },
          { id: "AUDIT" as const, label: "Auditoria", Icon: History },
        ].map((tab) => {
          const Icon = tab.Icon;
          const isAct = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isAct}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition ${
                isAct
                  ? "bg-[#0B3B70] text-white shadow-xs"
                  : "text-slate-700 hover:bg-[#F4F7FA] hover:text-[#0B3B70]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-300 p-4 text-xs text-red-900 flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          role="alert"
          className="rounded-xl bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-950 flex items-center gap-2"
        >
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

      {/* SEÇÃO 1: USUÁRIOS */}
      {activeTab === "USERS" && (
        <div className="space-y-5">
          {showInviteForm && canManageUsers && (
            <form
              onSubmit={handleInvite}
              className="bg-white rounded-2xl border-2 border-[#1684D8] p-5 sm:p-6 shadow-md space-y-4 text-xs"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#172B3A]">
                  Cadastrar Novo Usuário da Concessionária
                </h2>
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="text-xs font-semibold text-slate-500 hover:underline"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="invite-name" className="font-semibold text-slate-700 block">
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
                  <label htmlFor="invite-email" className="font-semibold text-slate-700 block">
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
                  <label htmlFor="invite-branch" className="font-semibold text-slate-700 block">
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
                  Funções Autorizadas:
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

              <div className="flex justify-end gap-2 pt-2">
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
                  Cadastrar e Gerar Link de Acesso
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
              <span className="text-xs text-slate-500">
                {filteredMembers.length} usuário(s) listado(s)
              </span>
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
                        <div className="font-bold text-[#172B3A]">
                          {m.fullName}
                        </div>
                        <div className="text-slate-500">
                          {m.email} {m.phone ? `• ${m.phone}` : ""} •{" "}
                          {m.branchName}
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
                          <div className="flex items-center gap-1.5 ml-2">
                            <button
                              type="button"
                              disabled={loading || !m.isActive}
                              onClick={() =>
                                manageAccess(m.profileId, "REISSUE")
                              }
                              className="rounded-lg border border-slate-200 hover:bg-slate-50 px-2.5 py-1 font-semibold text-[#172B3A] disabled:opacity-40"
                            >
                              Reemitir link
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
                              className="rounded-lg border border-slate-200 hover:bg-slate-50 px-2.5 py-1 font-semibold text-slate-600"
                            >
                              {m.isActive ? "Desativar" : "Reativar"}
                            </button>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Matriz de Permissões */}
            <details className="rounded-xl border border-slate-200 p-4 space-y-3">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[#0B3B70] flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[#1684D8]" />
                <span>
                  Perfis e matriz de permissões (o que cada perfil pode fazer)
                </span>
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
          </div>
        </div>
      )}

      {/* SEÇÃO 2: GERAL E UNIDADES */}
      {activeTab === "GENERAL" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#1684D8]" />
            <h2 className="text-base font-bold text-[#172B3A]">
              Identificação da Organização e Unidades
            </h2>
          </div>

          <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-4 text-xs space-y-1">
            <div className="font-extrabold text-[#172B3A] text-sm">
              {organization.name}
            </div>
            <div className="text-slate-600">
              CNPJ: <code className="font-mono">{organization.cnpj}</code>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="font-bold text-slate-700">
              Unidades Operacionais ({branches.length}):
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {branches.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-slate-200 p-3.5 space-y-1 bg-white"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#172B3A]">
                      {b.code} — {b.name}
                    </span>
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                      Ativa
                    </span>
                  </div>
                  <p className="text-slate-500">
                    {b.address} • {b.city}/{b.state}
                  </p>
                  {b.phone && (
                    <p className="text-slate-500">Telefone: {b.phone}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO 3: PROCEDIMENTOS */}
      {activeTab === "PROCEDURES" && (
        <div>
          <ProceduresAdminClient
            procedures={procedures}
            taskTemplates={taskTemplates}
            internalStaff={internalStaff}
            canManageProcedures={canManageProcedures}
          />
        </div>
      )}

      {/* SEÇÃO 4: PRAZOS E RESPONSÁVEIS */}
      {activeTab === "DEFAULTS" && (
        <div>
          <TaskDefaultsClient
            tasks={taskTemplates}
            staff={internalStaff}
          />
        </div>
      )}

      {/* SEÇÃO 5: AUDITORIA */}
      {activeTab === "AUDIT" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
                <History className="h-5 w-5 text-[#1684D8]" />
                <span>Trilha de Auditoria da Organização</span>
              </h2>
              <p className="text-xs text-slate-500">
                Registro cronológico e imutável de todas as decisões, eventos e
                bloqueios operacionais.
              </p>
            </div>
          </div>

          {/* Painel de Filtros de Auditoria */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#F4F7FA] p-3.5 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Período:
              </label>
              <select
                value={auditPeriod}
                onChange={(e) =>
                  setAuditPeriod(e.target.value as typeof auditPeriod)
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-[#172B3A] bg-white"
              >
                <option value="ALL">Todo o período</option>
                <option value="TODAY">Hoje</option>
                <option value="7DAYS">Últimos 7 dias</option>
                <option value="30DAYS">Últimos 30 dias</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Pessoa / Responsável:
              </label>
              <select
                value={auditActor}
                onChange={(e) => setAuditActor(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-[#172B3A] bg-white"
              >
                <option value="ALL">Todas as pessoas</option>
                {actorOptions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Tipo de Evento:
              </label>
              <select
                value={auditCategory}
                onChange={(e) => setAuditCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-[#172B3A] bg-white"
              >
                <option value="ALL">Todos os tipos de evento</option>
                <option value="DEALS">Negociações</option>
                <option value="DOCUMENTS">Documentos e conferência</option>
                <option value="APPROVALS_RELEASE">
                  Aprovações, faturamento e entrega
                </option>
                <option value="USERS">Usuários e acessos</option>
                <option value="PROCEDURES">Procedimentos e prazos</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Busca livre:
              </label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Buscar texto ou nº..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2.5 py-1.5 text-xs text-[#172B3A]"
                />
              </div>
            </div>
          </div>

          {/* Lista de Eventos de Auditoria */}
          {filteredAudit.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhum evento de auditoria encontrado com os filtros aplicados.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
              {filteredAudit.map((ev) => {
                const actionLabel =
                  HUMAN_AUDIT_ACTION_MAP[ev.action] || ev.action;
                const dealNumber = ev.dealId
                  ? dealNumbersById[ev.dealId] || null
                  : null;

                return (
                  <div
                    key={ev.id}
                    className="p-4 hover:bg-[#F4F7FA]/60 space-y-1.5 transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#0B3B70] bg-[#EAF3FC] border border-[#1684D8]/30 px-2 py-0.5 rounded text-[11px]">
                          {actionLabel}
                        </span>
                        <span className="font-bold text-[#172B3A]">
                          {ev.actorName} ({ev.actorRole})
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {formatDateTimeBr(ev.createdAt)}
                      </span>
                    </div>

                    <p className="text-slate-700 leading-relaxed">
                      {ev.summary}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div>
                        {dealNumber && ev.dealId && (
                          <Link
                            href={`/app/negociacoes/${ev.dealId}`}
                            className="inline-flex items-center gap-1 font-bold text-[#1684D8] hover:underline"
                          >
                            <span>Abrir Passaporte ({dealNumber})</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>

                      {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                        <details className="text-[11px] text-slate-500">
                          <summary className="cursor-pointer hover:text-[#0B3B70] font-semibold">
                            Detalhes técnicos do evento
                          </summary>
                          <pre className="mt-1 p-2 bg-slate-100 rounded-lg overflow-x-auto text-[10px] font-mono text-slate-800">
                            {JSON.stringify(ev.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
