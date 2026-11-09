"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  Car,
  CheckSquare,
  ClipboardCheck,
  FileSpreadsheet,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  RefreshCw,
  Settings,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { NotificationItem, ROLE_LABELS, RoleCode } from "@/domain/types";
import { formatDateTimeBr } from "@/lib/format";

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
  isDemoMode: boolean;
  demoPersonas: Array<{
    profileId: string;
    fullName: string;
    email: string;
    roles: RoleCode[];
    isCustomerOnly: boolean;
  }>;
  notifications: NotificationItem[];
}

export function AppShell({
  children,
  user,
  organizationName,
  branchName,
  roles,
  isDemoMode,
  demoPersonas,
  notifications,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [switchingPersona, setSwitchingPersona] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function handleSwitchPersona(targetProfileId: string) {
    setSwitchingPersona(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SWITCH_DEMO_PERSONA",
          targetProfileId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.profile.isCustomerOnly) {
          router.push("/cliente");
        } else if (pathname.startsWith("/cliente")) {
          router.push("/app");
        } else {
          router.refresh();
        }
      }
    } finally {
      setSwitchingPersona(false);
    }
  }

  async function handleResetDemo() {
    if (
      !window.confirm(
        "Deseja restaurar o banco de dados demonstrativo para o estado inicial do Roteiro de 15 Passos?"
      )
    ) {
      return;
    }
    setSwitchingPersona(true);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESET_DEMO_DB" }),
      });
      router.refresh();
    } finally {
      setSwitchingPersona(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "LOGOUT" }),
    });
    router.push("/login");
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
      label: "Visão Operacional",
      Icon: LayoutDashboard,
      exact: true,
    },
    {
      href: "/app/escanear",
      label: "Escanear Veículo",
      Icon: QrCode,
      highlight: true,
    },
    {
      href: "/app/negociacoes",
      label: "Passaportes / Negociações",
      Icon: FileSpreadsheet,
    },
    {
      href: "/app/veiculos",
      label: "Veículos e Estoque",
      Icon: Car,
    },
    {
      href: "/app/minhas-tarefas",
      label: "Minhas Tarefas",
      Icon: CheckSquare,
    },
    {
      href: "/app/aprovacoes",
      label: "Caixas de Aprovação",
      Icon: ClipboardCheck,
    },
    {
      href: "/app/procedimentos",
      label: "Procedimentos e Regras",
      Icon: BookOpen,
    },
    {
      href: "/app/relatorios",
      label: "Painel Gerencial",
      Icon: BarChart3,
    },
    {
      href: "/app/configuracoes",
      label: "Administração e Auditoria",
      Icon: Settings,
    },
    {
      href: "/cliente",
      label: "Visão Área do Cliente",
      Icon: Users,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Banner explícito de Ambiente Demonstrativo */}
      {isDemoMode && (
        <div className="no-print bg-slate-900 text-slate-100 border-b border-slate-700 px-3 py-2 text-xs">
          <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                <ShieldAlert className="h-3.5 w-3.5" />
                AMBIENTE DEMONSTRATIVO LOCAL
              </span>
              <span className="text-slate-300 hidden sm:inline">
                Concessionária fictícia piloto:{" "}
                <strong className="text-white">Pinauto BYD — Ceres/GO</strong>{" "}
                (Produto independente ChaveFlow, sem vínculo oficial ou homologação pela BYD).
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="demo-persona-select"
                className="flex items-center gap-1.5 text-slate-300 font-medium"
              >
                <UserCheck className="h-3.5 w-3.5 text-teal-400" />
                <span>Alternar Persona (Demo):</span>
              </label>
              <select
                id="demo-persona-select"
                disabled={switchingPersona}
                value={user.id}
                onChange={(e) => handleSwitchPersona(e.target.value)}
                className="rounded bg-slate-800 border border-slate-600 px-2.5 py-1 text-xs font-medium text-white focus:border-teal-400"
              >
                {demoPersonas.map((p) => (
                  <option key={p.profileId} value={p.profileId}>
                    {p.fullName} [{p.roles.map((r) => ROLE_LABELS[r]).join(", ")}]
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleResetDemo}
                disabled={switchingPersona}
                title="Restaurar dados iniciais do roteiro de 15 passos"
                className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 transition"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    switchingPersona ? "animate-spin" : ""
                  }`}
                />
                <span>Restaurar Roteiro</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex">
        {/* Navegação Lateral Desktop */}
        <aside className="no-print hidden lg:flex lg:w-68 lg:flex-col bg-[#0f172a] text-slate-100 border-r border-slate-800 shrink-0">
          <div className="p-5 border-b border-slate-800">
            <Link href="/app" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-sm">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight text-white">
                  ChaveFlow
                </div>
                <div className="text-[11px] text-teal-400 font-medium">
                  Passaporte Digital & Liberação
                </div>
              </div>
            </Link>
            <div className="mt-4 rounded-lg bg-slate-800/80 border border-slate-700 p-2.5 text-xs">
              <div className="font-semibold text-slate-200 truncate">
                {organizationName}
              </div>
              <div className="text-slate-400 truncate mt-0.5">{branchName}</div>
            </div>
          </div>

          <nav
            aria-label="Menu principal"
            className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
          >
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
              const Icon = item.Icon;

              if (item.highlight) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition my-2 shadow-sm ${
                      isActive
                        ? "bg-teal-500 text-slate-950"
                        : "bg-teal-600 hover:bg-teal-500 text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-800 text-white border-l-4 border-teal-400"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {user.fullName}
                </div>
                <div className="text-[11px] text-teal-400 truncate">
                  {roles.map((r) => ROLE_LABELS[r]).join(" • ")}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Encerrar sessão"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Área Principal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header Superior */}
          <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden rounded-lg p-2 text-slate-700 hover:bg-slate-100"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 hidden sm:block">
                  Escaneou o carro • Entendeu o próximo passo • Acompanhou até a entrega
                </p>
                <p className="text-sm font-bold text-slate-900 sm:hidden">
                  ChaveFlow • Pinauto Ceres
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/app/escanear"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition"
              >
                <QrCode className="h-4 w-4" />
                <span>Escanear Veículo</span>
              </Link>

              {/* Notificações Internas */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 transition"
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
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white shadow-xl border border-slate-200 z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Notificações Internas ({unreadCount} não lidas)
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-xs text-teal-300 hover:underline font-medium"
                        >
                          Marcar todas como lidas
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          Nenhuma notificação para o perfil atual.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-3.5 text-xs ${
                              n.isRead ? "bg-white" : "bg-teal-50/50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold text-slate-900">
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
                                className="inline-block mt-2 text-teal-700 font-semibold hover:underline"
                              >
                                Abrir Passaporte →
                              </Link>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 text-[11px] text-slate-500">
                      Adaptadores externos (E-mail/WhatsApp): Modo simulado (sem provedor configurado no MVP).
                    </div>
                  </div>
                )}
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
              <div className="relative w-72 max-w-full bg-[#0f172a] text-white flex flex-col z-10">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-teal-400" />
                    <span className="font-bold">ChaveFlow</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                  {navItems.map((item) => {
                    const Icon = item.Icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
                      >
                        <Icon className="h-4 w-4 text-teal-400" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
                <div className="p-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white"
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
