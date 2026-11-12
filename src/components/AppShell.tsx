"use client";

import { NotificationItem, ROLE_LABELS, RoleCode } from "@/domain/types";
import { formatDateTimeBr } from "@/lib/format";
import {
  Bell,
  Building2,
  Car,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

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
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeDrawerButtonRef = useRef<HTMLButtonElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const isAdmin = roles.includes("ADMIN");
  const isManager = isAdmin || roles.includes("MANAGER");
  const canAccessSettingsOrProcedures =
    isAdmin ||
    isManager ||
    roles.includes("DOCUMENTATION") ||
    roles.includes("FINANCE") ||
    roles.includes("RELEASE_OFFICER");
  const userInitials = getInitials(user.fullName);

  useEffect(() => {
    if (!mobileMenuOpen && !notifOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (mobileMenuOpen) {
          setMobileMenuOpen(false);
          menuButtonRef.current?.focus();
        }
        if (notifOpen) {
          setNotifOpen(false);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen, notifOpen]);

  useEffect(() => {
    if (mobileMenuOpen) {
      closeDrawerButtonRef.current?.focus();
    }
  }, [mobileMenuOpen]);

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
      label: "Painel",
      Icon: LayoutDashboard,
      exact: true,
      matchPrefixes: ["/app/relatorios"],
      visible: true,
    },
    {
      href: "/app/negociacoes",
      label: "Negociações",
      Icon: FileSpreadsheet,
      exact: false,
      matchPrefixes: ["/app/negociacoes", "/app/clientes"],
      visible: true,
    },
    {
      href: "/app/veiculos",
      label: "Veículos",
      Icon: Car,
      exact: false,
      matchPrefixes: ["/app/veiculos"],
      visible: true,
    },
    {
      href: "/app/pendencias",
      label: "Pendências",
      Icon: ClipboardCheck,
      exact: false,
      matchPrefixes: [
        "/app/pendencias",
        "/app/aprovacoes",
        "/app/minhas-tarefas",
      ],
      visible: true,
    },
    {
      href: "/app/configuracoes",
      label: "Configurações",
      Icon: Settings,
      exact: false,
      matchPrefixes: ["/app/configuracoes", "/app/procedimentos"],
      visible: canAccessSettingsOrProcedures,
    },
  ].filter((item) => item.visible);

  function isNavItemActive(item: (typeof navItems)[number]) {
    if (item.exact) {
      return (
        pathname === item.href ||
        item.matchPrefixes.some(
          (p) => pathname === p || pathname.startsWith(`${p}/`),
        )
      );
    }
    return item.matchPrefixes.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
  }

  const pageTitle = pathname.startsWith("/app/escanear")
    ? "Escanear veículo"
    : pathname.startsWith("/app/relatorios")
      ? "Visão gerencial e indicadores"
      : pathname.startsWith("/app/clientes")
        ? "Clientes e acessos"
        : pathname.startsWith("/app/procedimentos")
          ? "Procedimentos operacionais"
          : (navItems.find((i) => isNavItemActive(i))?.label ?? "Painel");

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
            className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto"
          >
            {navItems.map((item) => {
              const isActive = isNavItemActive(item);
              const Icon = item.Icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                    sidebarCollapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-[#1684D8] text-white font-semibold shadow-xs"
                      : "text-[#EAF3FC]/90 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? "text-white" : "text-[#EAF3FC]/80"
                    }`}
                  />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );
            })}
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
                ref={menuButtonRef}
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden rounded-lg p-2 text-[#172B3A] hover:bg-slate-100"
                aria-label="Abrir menu de navegação"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-drawer"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                  <span className="font-bold text-[#0B3B70]">AUTOFLOW</span>
                  <span>•</span>
                  <span className="truncate">{branchName}</span>
                </div>
                <p className="text-sm font-extrabold text-[#172B3A] truncate">
                  {pageTitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <Link
                href="/app/escanear"
                className="inline-flex items-center gap-2 rounded-xl bg-[#EAF3FC] hover:bg-[#d8eafb] border border-[#1684D8]/30 px-3.5 py-2 text-xs font-bold text-[#0B3B70] transition"
              >
                <QrCode className="h-4 w-4 text-[#1684D8]" />
                <span>Escanear veículo</span>
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
            <div
              id="mobile-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Menu principal"
              className="fixed inset-0 z-50 lg:hidden flex"
            >
              <div
                className="fixed inset-0 bg-slate-950/60"
                onClick={() => {
                  setMobileMenuOpen(false);
                  menuButtonRef.current?.focus();
                }}
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
                    ref={closeDrawerButtonRef}
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      menuButtonRef.current?.focus();
                    }}
                    className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                    aria-label="Fechar menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav
                  aria-label="Menu principal móvel"
                  className="flex-1 p-3 space-y-1 overflow-y-auto"
                >
                  {navItems.map((item) => {
                    const Icon = item.Icon;
                    const isActive = isNavItemActive(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
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
                  <div className="pt-2 mt-2 border-t border-white/10">
                    <Link
                      href="/app/escanear"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#7CC4FA] hover:bg-white/10"
                    >
                      <QrCode className="h-4 w-4 shrink-0" />
                      <span>Escanear veículo</span>
                    </Link>
                  </div>
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
