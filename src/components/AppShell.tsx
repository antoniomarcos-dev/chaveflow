"use client";

import { NotificationItem, ROLE_LABELS, RoleCode } from "@/domain/types";
import { formatDateTimeBr } from "@/lib/format";
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Car,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Settings,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useState } from "react";

export interface AppShellProps {
  children: React.ReactNode;
  user: {
    id: string;
    fullName: string;
    email: string;
    isCustomerOnly: boolean;
  };
  organizationName: string;
  branchName: string;
  roles: RoleCode[];
  notifications: NotificationItem[];
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AF";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AppShell({
  children,
  user,
  organizationName,
  branchName,
  roles,
  notifications,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const isAdmin = roles.includes("ADMIN"),
    isManager = isAdmin || roles.includes("MANAGER");
  const canManageCustomers = isManager || roles.includes("SELLER");
  const userInitials = getInitials(user.fullName);

  async function handleLogout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "LOGOUT" }),
    });
    router.push("/");
    router.refresh();
  }

  async function handleMarkAllRead() {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "MARK_NOTIFICATION_READ",
        markAll: true,
      }),
    });
    router.refresh();
  }

  const navItems = [
    {
      href: "/app",
      label: "Painel Operacional",
      Icon: LayoutDashboard,
      exact: true,
      group: "OPERATIONAL" as const,
    },
    {
      href: "/app/negociacoes",
      label: "Negociações",
      Icon: FileSpreadsheet,
      group: "OPERATIONAL" as const,
    },
    {
      href: "/app/veiculos",
      label: "Veículos e Estoque",
      Icon: Car,
      group: "OPERATIONAL" as const,
    },
    {
      href: "/app/clientes",
      label: "Clientes e Acessos",
      Icon: Users,
      group: "OPERATIONAL" as const,
    },
    {
      href: "/app/aprovacoes",
      label: "Faturamento, Docs e Liberações",
      Icon: ClipboardCheck,
      group: "OPERATIONAL" as const,
    },
    {
      href: "/app/minhas-tarefas",
      label: "Minhas Tarefas",
      Icon: CheckSquare,
      group: "OPERATIONAL" as const,
    },
    {
      href: "/app/escanear",
      label: "Escanear Veículo",
      Icon: QrCode,
      group: "OPERATIONAL" as const,
    },
    {
      href: "/app/procedimentos",
      label: "Procedimentos e Regras",
      Icon: BookOpen,
      group: "MANAGEMENT" as const,
    },
    {
      href: "/app/relatorios",
      label: "Relatórios e Indicadores",
      Icon: BarChart3,
      group: "MANAGEMENT" as const,
    },
    {
      href: "/app/configuracoes",
      label: "Configurações e Usuários",
      Icon: Settings,
      group: "MANAGEMENT" as const,
    },
  ].filter((item) =>
    item.href === "/app/configuracoes"
      ? isAdmin
      : item.href === "/app/relatorios"
        ? isManager || roles.includes("RELEASE_OFFICER")
        : item.href === "/app/clientes"
          ? canManageCustomers
          : item.href === "/app/aprovacoes"
            ? !roles.every((r) => r === "SELLER")
            : true,
  );

  const operationalItems = navItems.filter((i) => i.group === "OPERATIONAL");
  const managementItems = navItems.filter((i) => i.group === "MANAGEMENT");

  const activeNavItem =
    navItems.find((item) =>
      item.exact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) || navItems[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FA] text-[#172B3A]">
      <div className="flex-1 flex">
        {/* Navegação Lateral Desktop — Azul Principal #0B3B70 */}
        <aside
          className={`no-print hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col bg-[#0B3B70] text-white border-r border-[#082B54] shrink-0 transition-all duration-200 ${
            sidebarCollapsed ? "lg:w-20" : "lg:w-68"
          }`}
        >
          {/* Marca do Produto AUTOFLOW separada da Unidade/Empresa Piloto */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/app"
                className="flex items-center gap-2.5 min-w-0"
                title="AUTOFLOW — Sua operação conectada do início ao fim."
              >
                <div className="h-9 w-9 rounded-lg bg-[#1684D8] flex items-center justify-center text-white font-black text-sm tracking-tighter shadow-xs shrink-0">
                  //
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="text-lg font-extrabold tracking-tight text-white leading-none">
                      AUTOFLOW
                    </div>
                    <div className="text-[10px] text-[#EAF3FC]/85 font-medium mt-1 leading-tight">
                      Sua operação conectada do início ao fim.
                    </div>
                  </div>
                )}
              </Link>

              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                aria-label={
                  sidebarCollapsed
                    ? "Expandir menu lateral"
                    : "Recolher menu lateral"
                }
                title={
                  sidebarCollapsed
                    ? "Expandir menu lateral"
                    : "Recolher menu lateral"
                }
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition shrink-0"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Identificação separada da Empresa Piloto / Unidade */}
            {!sidebarCollapsed ? (
              <div className="mt-3.5 rounded-xl bg-[#082B54]/90 border border-white/12 px-3 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-[#1684D8] shrink-0" />
                  <span className="font-bold text-white tracking-wide truncate">
                    {organizationName}
                  </span>
                </div>
                <div className="text-[11px] text-[#EAF3FC]/75 truncate mt-0.5 pl-5">
                  Unidade: {branchName}
                </div>
              </div>
            ) : (
              <div
                className="mt-3 flex justify-center"
                title={`${organizationName} — ${branchName}`}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#082B54] border border-white/12 text-[10px] font-bold text-[#EAF3FC]">
                  BYD
                </span>
              </div>
            )}
          </div>

          <nav
            aria-label="Menu principal"
            className="flex-1 px-3 py-4 space-y-5 overflow-y-auto"
          >
            {/* Grupo Operacional */}
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#EAF3FC]/60">
                  Operação Conectada
                </div>
              )}
              {operationalItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                const Icon = item.Icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-medium transition ${
                      sidebarCollapsed ? "justify-center" : ""
                    } ${
                      isActive
                        ? "bg-[#1684D8] text-white font-semibold shadow-xs"
                        : "text-[#EAF3FC]/85 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-white" : "text-[#EAF3FC]/75"
                      }`}
                    />
                    {!sidebarCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Grupo Gestão, Regras e Configurações */}
            {managementItems.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-white/10">
                {!sidebarCollapsed && (
                  <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#EAF3FC]/60">
                    Gestão e Governança
                  </div>
                )}
                {managementItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const Icon = item.Icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-medium transition ${
                        sidebarCollapsed ? "justify-center" : ""
                      } ${
                        isActive
                          ? "bg-[#1684D8] text-white font-semibold shadow-xs"
                          : "text-[#EAF3FC]/85 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isActive ? "text-white" : "text-[#EAF3FC]/75"
                        }`}
                      />
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="pt-2 border-t border-white/10">
              <Link
                href="/"
                title="Página inicial institucional"
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-[#EAF3FC]/70 hover:bg-white/10 hover:text-white transition ${
                  sidebarCollapsed ? "justify-center" : ""
                }`}
              >
                <Home className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span>Apresentação do Produto</span>}
              </Link>
            </div>
          </nav>

          {/* Identificação do Usuário e Ação de Sair na Parte Inferior */}
          <div className="p-3.5 border-t border-white/12 bg-[#082B54]/80">
            <div
              className={`flex items-center ${
                sidebarCollapsed ? "flex-col gap-2" : "justify-between gap-2.5"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-full bg-[#1684D8] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {userInitials}
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {user.fullName}
                    </div>
                    <div className="text-[11px] text-[#EAF3FC]/80 truncate">
                      {roles.map((r) => ROLE_LABELS[r]).join(" • ")}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair da conta"
                aria-label="Sair da conta"
                className="rounded-lg p-2 text-[#EAF3FC]/75 hover:bg-white/10 hover:text-white transition shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Área Principal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Cabeçalho Global Consistente */}
          <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-8 h-16 flex items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden rounded-lg p-2 text-[#172B3A] hover:bg-slate-100"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <span className="font-bold text-[#0B3B70]">AUTOFLOW</span>
                  <span>•</span>
                  <span className="truncate">{branchName}</span>
                </div>
                <p className="text-sm font-extrabold text-[#172B3A] truncate">
                  {activeNavItem?.label || "Painel Operacional"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <Link
                href="/app/escanear"
                className="inline-flex items-center gap-2 rounded-xl bg-[#EAF3FC] hover:bg-[#d8eafb] border border-[#1684D8]/30 px-3.5 py-2 text-xs font-bold text-[#0B3B70] transition"
              >
                <QrCode className="h-4 w-4 text-[#1684D8]" />
                <span className="hidden sm:inline">Identificar Veículo</span>
                <span className="sm:hidden">QR</span>
              </Link>

              {/* Notificações Internas */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative rounded-xl border border-slate-200 bg-white p-2 text-[#172B3A] hover:bg-slate-50 transition"
                  aria-label="Abrir notificações internas"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-xl border border-slate-200 z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-[#0B3B70] text-white">
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Notificações ({unreadCount} não lidas)
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-xs text-[#EAF3FC] hover:underline font-semibold"
                        >
                          Marcar todas como lidas
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          Nenhuma notificação pendente para o seu perfil.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-3.5 text-xs ${
                              n.isRead ? "bg-white" : "bg-[#EAF3FC]/55"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-[#172B3A]">
                                {n.title}
                              </span>
                              <span className="text-[11px] text-slate-400 shrink-0">
                                {formatDateTimeBr(n.createdAt)}
                              </span>
                            </div>
                            <p className="text-slate-600 mt-1">{n.message}</p>
                            {n.dealId && (
                              <Link
                                href={`/app/negociacoes/${n.dealId}`}
                                onClick={() => setNotifOpen(false)}
                                className="inline-block mt-2 text-[#1684D8] font-bold hover:underline"
                              >
                                Abrir Passaporte Digital →
                              </Link>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 text-[11px] text-slate-500">
                      Alertas operacionais de {organizationName}.
                    </div>
                  </div>
                )}
              </div>

              {/* Crachá do Usuário Consistente no Topo */}
              <div
                className="flex items-center gap-2 pl-1"
                title={`${user.fullName} (${roles.map((r) => ROLE_LABELS[r]).join(", ")})`}
              >
                <div className="h-9 w-9 rounded-full bg-[#1684D8] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {userInitials}
                </div>
              </div>
            </div>
          </header>

          {/* Menu Gaveta Mobile */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex">
              <div
                className="fixed inset-0 bg-slate-950/60"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="relative w-72 max-w-full bg-[#0B3B70] text-white flex flex-col z-10">
                <div className="p-4 border-b border-white/12 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-lg bg-[#1684D8] flex items-center justify-center text-white font-black text-xs">
                      //
                    </span>
                    <div>
                      <span className="font-extrabold tracking-tight block leading-none">
                        AUTOFLOW
                      </span>
                      <span className="text-[10px] text-[#EAF3FC]/80 block mt-0.5">
                        {organizationName}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 text-white/75 hover:text-white"
                    aria-label="Fechar menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                  {navItems.map((item) => {
                    const Icon = item.Icon;
                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                          isActive
                            ? "bg-[#1684D8] text-white font-semibold"
                            : "text-[#EAF3FC]/90 hover:bg-white/10"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
                <div className="p-4 border-t border-white/12 bg-[#082B54]">
                  <div className="mb-3 flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-[#1684D8] text-white font-bold text-xs flex items-center justify-center">
                      {userInitials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {user.fullName}
                      </div>
                      <div className="text-[11px] text-[#EAF3FC]/75 truncate">
                        {roles.map((r) => ROLE_LABELS[r]).join(" • ")}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-xs font-bold text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sair da conta</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Conteúdo Principal */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
