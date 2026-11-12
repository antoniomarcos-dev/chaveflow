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
  ResponsibleArea,
  TaskInstance,
  Vehicle,
  WORKFLOW_STAGES,
} from "@/domain/types";
import { formatDateTimeBr } from "@/lib/format";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Lock,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
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

type MainTab =
  | "OVERVIEW"
  | "BILLING"
  | "DOCUMENTS"
  | "RELEASES"
  | "FORMAL_APPROVALS";

export function WorkQueuesClient({
  deals,
  documents,
  formalTasks,
}: {
  deals: WorkQueueDealItem[];
  documents: WorkQueueDocItem[];
  formalTasks: WorkQueueFormalTaskItem[];
}) {
  const [activeTab, setActiveTab] = useState<MainTab>("OVERVIEW");
  const [search, setSearch] = useState("");
  const [docSubFilter, setDocSubFilter] = useState<
    "ALL" | "PENDING" | "IN_REVIEW" | "CORRECTION" | "APPROVED"
  >("ALL");
  const [releaseSubFilter, setReleaseSubFilter] = useState<
    "ALL" | "BLOCKED" | "ELIGIBLE" | "AUTHORIZED" | "DELIVERED"
  >("ALL");
  const [billingSubFilter, setBillingSubFilter] = useState<
    "ALL" | "ELIGIBLE" | "PENDING_REQ" | "BILLED"
  >("ALL");
  const [areaFilter, setAreaFilter] = useState<ResponsibleArea | "ALL">("ALL");

  const normalizedQuery = search.trim().toLowerCase();

  // Filtro global por busca para cada conjunto
  const filteredDeals = useMemo(() => {
    return deals.filter((item) => {
      if (item.deal.status === "DRAFT" || item.deal.status === "CANCELLED") {
        return false;
      }
      if (!normalizedQuery) return true;
      const hay = `${item.deal.dealNumber} ${item.vehicle.internalCode} ${item.vehicle.brand} ${item.vehicle.model} ${item.vehicle.vin} ${item.customer.fullName}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [deals, normalizedQuery]);

  const filteredDocs = useMemo(() => {
    return documents.filter((item) => {
      if (docSubFilter === "PENDING" && item.doc.status !== "REQUESTED") {
        return false;
      }
      if (
        docSubFilter === "IN_REVIEW" &&
        item.doc.status !== "UPLOADED_PENDING_REVIEW"
      ) {
        return false;
      }
      if (
        docSubFilter === "CORRECTION" &&
        item.doc.status !== "REJECTED" &&
        item.doc.status !== "CORRECTION_REQUESTED" &&
        item.doc.status !== "OUTDATED"
      ) {
        return false;
      }
      if (docSubFilter === "APPROVED" && item.doc.status !== "APPROVED") {
        return false;
      }
      if (!normalizedQuery) return true;
      const hay = `${item.deal.dealNumber} ${item.doc.title} ${item.customerName} ${item.vehicle.internalCode} ${item.vehicle.model}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [documents, docSubFilter, normalizedQuery]);

  const filteredFormalTasks = useMemo(() => {
    return formalTasks.filter((item) => {
      if (areaFilter !== "ALL" && item.task.responsibleArea !== areaFilter) {
        return false;
      }
      if (!normalizedQuery) return true;
      const hay = `${item.deal.dealNumber} ${item.task.title} ${item.customerName} ${item.vehicle.internalCode} ${item.vehicle.model}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [formalTasks, areaFilter, normalizedQuery]);

  const billingDeals = useMemo(() => {
    return filteredDeals.filter((item) => {
      if (billingSubFilter === "BILLED") return item.summary.billingRegistered;
      if (billingSubFilter === "ELIGIBLE")
        return item.summary.billingEligible && !item.summary.billingRegistered;
      if (billingSubFilter === "PENDING_REQ")
        return !item.summary.billingEligible && !item.summary.billingRegistered;
      return true;
    });
  }, [filteredDeals, billingSubFilter]);

  const releaseDeals = useMemo(() => {
    return filteredDeals.filter((item) => {
      if (releaseSubFilter === "DELIVERED")
        return item.deal.status === "DELIVERED";
      if (releaseSubFilter === "AUTHORIZED")
        return item.deal.status === "DELIVERY_AUTHORIZED";
      if (releaseSubFilter === "ELIGIBLE")
        return (
          item.deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
          (item.summary.deliveryEligible &&
            !item.summary.deliveryAuthorized &&
            item.deal.status !== "DELIVERED")
        );
      if (releaseSubFilter === "BLOCKED")
        return (
          item.deal.status === "ACTIVE" &&
          !item.summary.deliveryEligible &&
          !item.summary.deliveryAuthorized
        );
      return true;
    });
  }, [filteredDeals, releaseSubFilter]);

  const pendingDocsActionCount = documents.filter(
    (d) =>
      d.doc.status === "UPLOADED_PENDING_REVIEW" ||
      d.doc.status === "OUTDATED" ||
      d.doc.status === "REQUESTED" ||
      d.doc.status === "REJECTED" ||
      d.doc.status === "CORRECTION_REQUESTED",
  ).length;

  const billingActionCount = deals.filter(
    (d) =>
      d.deal.status !== "DRAFT" &&
      d.deal.status !== "CANCELLED" &&
      !d.summary.billingRegistered,
  ).length;

  const releaseActionCount = deals.filter(
    (d) =>
      d.deal.status === "ACTIVE" ||
      d.deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      d.deal.status === "DELIVERY_AUTHORIZED",
  ).length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Central */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="eyebrow">
            Caixas de Trabalho Operacionais ( Faturamento • Documentos • Liberações )
          </span>
          <h1 className="text-2xl font-extrabold text-[#172B3A] mt-1">
            Aprovações, Faturamento, Documentos e Liberações
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Controle formal por área responsável. O status visual reflete os bloqueios reais do processo e exige registro formal no Passaporte Digital.
          </p>
        </div>

        {/* Navegação de Módulos (Telas 6, 7, 8 e 4.11) */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#F4F7FA] p-1.5 rounded-xl border border-slate-200">
          {(
            [
              {
                id: "OVERVIEW",
                label: "Visão Geral",
                count: formalTasks.length + pendingDocsActionCount,
              },
              {
                id: "BILLING",
                label: "Faturamento",
                count: billingActionCount,
              },
              {
                id: "DOCUMENTS",
                label: "Documentos",
                count: pendingDocsActionCount,
              },
              {
                id: "RELEASES",
                label: "Liberações",
                count: releaseActionCount,
              },
              {
                id: "FORMAL_APPROVALS",
                label: "Aprovações Formais",
                count: formalTasks.length,
              },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  active
                    ? "bg-[#1684D8] text-white shadow-xs"
                    : "text-slate-600 hover:bg-white hover:text-[#172B3A]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-200/80 text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de Busca Unificada */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nº da negociação, cliente, veículo, chassi ou documento..."
            className="w-full rounded-xl border border-slate-300 bg-[#F4F7FA]/60 focus:bg-white pl-10 pr-4 py-2 text-xs sm:text-sm text-[#172B3A]"
          />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-xs font-bold text-[#1684D8] hover:underline shrink-0"
          >
            Limpar busca
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MÓDULO 6: FATURAMENTO (4.7) */}
      {/* ===================================================================== */}
      {(activeTab === "BILLING" || activeTab === "OVERVIEW") && (
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#EAF3FC] flex items-center justify-center text-[#1684D8]">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#172B3A]">
                  Faturamento — Controle do Processo de Emissão de NF ({billingDeals.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Evidencia requisitos financeiros/documentais pendentes e responsável atual antes do registro formal da Nota Fiscal.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "ALL", label: "Todas" },
                  { id: "ELIGIBLE", label: "Elegíveis p/ NF" },
                  { id: "PENDING_REQ", label: "Aguardando requisitos" },
                  { id: "BILLED", label: "NF Registrada" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setBillingSubFilter(f.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    billingSubFilter === f.id
                      ? "bg-[#EAF3FC] text-[#0B3B70] border border-[#1684D8]/30"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {billingDeals.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhuma negociação encontrada para o filtro de faturamento selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F4F7FA] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 pl-6 pr-3">Nº Negociação</th>
                    <th className="py-3 px-3">Veículo</th>
                    <th className="py-3 px-3">Cliente</th>
                    <th className="py-3 px-3">Requisitos & Responsável Atual</th>
                    <th className="py-3 px-3">Situação do Faturamento</th>
                    <th className="py-3 pl-3 pr-6 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {billingDeals.map(({ deal, vehicle, customer, summary }) => (
                    <tr key={deal.id} className="hover:bg-[#F4F7FA]/60 transition">
                      <td className="py-3.5 pl-6 pr-3 font-mono font-extrabold text-[#0B3B70]">
                        {deal.dealNumber}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-[#172B3A]">
                          {vehicle.brand} {vehicle.model}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {vehicle.internalCode} • {vehicle.color}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-[#172B3A]">
                        {customer.fullName}
                      </td>
                      <td className="py-3.5 px-3">
                        {summary.billingRegistered ? (
                          <span className="text-emerald-800 font-semibold">
                            NF {deal.invoiceNumber} registrada em{" "}
                            {formatDateTimeBr(deal.billingRegisteredAt)}
                          </span>
                        ) : summary.billingEligible ? (
                          <span className="text-[#0B3B70] font-semibold">
                            Requisitos financeiros e documentais aprovados • Responsável:{" "}
                            <strong>Faturamento</strong>
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-amber-800 font-semibold block">
                              Aguardando pré-requisitos obrigatórios:
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Financeiro: {summary.pillars.financial.status === "OK" ? "OK" : "Pendente"} • Documental:{" "}
                              {summary.pillars.documentation.status === "OK" ? "OK" : "Pendente"}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        {summary.billingRegistered ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-900">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Faturado (NF {deal.invoiceNumber})
                          </span>
                        ) : summary.billingEligible ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF3FC] border border-[#1684D8]/30 px-2.5 py-1 text-[11px] font-bold text-[#0B3B70]">
                            Pronto p/ Emitir NF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                            Pendente de Requisitos
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 pl-3 pr-6 text-right">
                        <Link
                          href={`/app/negociacoes/${deal.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#0B3B70] hover:bg-[#1684D8] px-3 py-1.5 text-xs font-bold text-white transition"
                        >
                          <span>Ver Passaporte</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* MÓDULO 7: DOCUMENTOS (4.8) */}
      {/* ===================================================================== */}
      {(activeTab === "DOCUMENTS" || activeTab === "OVERVIEW") && (
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#EAF3FC] flex items-center justify-center text-[#1684D8]">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#172B3A]">
                  Documentos — Gestão e Conferência Documental ({filteredDocs.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Agrupados por negociação e cliente, diferenciando documentos solicitados, em análise, com necessidade de correção e aprovados.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "ALL", label: "Todos" },
                  { id: "IN_REVIEW", label: "Em análise" },
                  { id: "PENDING", label: "Pendentes / Solicitados" },
                  { id: "CORRECTION", label: "Correção / Reenvio" },
                  { id: "APPROVED", label: "Aprovados" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDocSubFilter(f.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    docSubFilter === f.id
                      ? "bg-[#EAF3FC] text-[#0B3B70] border border-[#1684D8]/30"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhum documento encontrado para o filtro selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F4F7FA] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 pl-6 pr-3">Negociação</th>
                    <th className="py-3 px-3">Documento & Versão</th>
                    <th className="py-3 px-3">Cliente</th>
                    <th className="py-3 px-3">Responsável & Orientação</th>
                    <th className="py-3 px-3">Estado da Conferência</th>
                    <th className="py-3 pl-3 pr-6 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredDocs.map(({ doc, deal, vehicle, customerName }) => {
                    return (
                      <tr key={doc.id} className="hover:bg-[#F4F7FA]/60 transition">
                        <td className="py-3.5 pl-6 pr-3">
                          <span className="font-mono font-extrabold text-[#0B3B70] block">
                            {deal.dealNumber}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {vehicle.brand} {vehicle.model}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-[#172B3A] flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-[#1684D8] shrink-0" />
                            <span>
                              {doc.title}{" "}
                              {doc.currentVersionNumber > 0
                                ? `(v${doc.currentVersionNumber})`
                                : ""}
                            </span>
                          </div>
                          {doc.currentVersionNumber > 0 && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Atualizado em {formatDateTimeBr(doc.updatedAt)}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-[#172B3A]">
                          {customerName}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-slate-700">
                            Setor: {AREA_LABELS[doc.responsibleArea]}
                          </div>
                          {doc.rejectionReason && (
                            <div className="text-[11px] text-amber-800 mt-0.5">
                              Orientação: {doc.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <DocumentStatusBadge status={doc.status} />
                        </td>
                        <td className="py-3.5 pl-3 pr-6 text-right">
                          <Link
                            href={`/app/negociacoes/${deal.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#0B3B70] hover:bg-[#1684D8] px-3 py-1.5 text-xs font-bold text-white transition"
                          >
                            <span>Conferir</span>
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
      )}

      {/* ===================================================================== */}
      {/* MÓDULO 8: LIBERAÇÕES E ENTREGAS (4.9) */}
      {/* ===================================================================== */}
      {(activeTab === "RELEASES" || activeTab === "OVERVIEW") && (
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#EAF3FC] flex items-center justify-center text-[#1684D8]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#172B3A]">
                  Liberações e Entregas — Controle de Autorização e Entrega Física ({releaseDeals.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Diferencia veículos com requisitos pendentes, prontos para liberar, com entrega autorizada e entregues.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "ALL", label: "Todas" },
                  { id: "BLOCKED", label: "A liberar (Com pendências)" },
                  { id: "ELIGIBLE", label: "Pronto p/ Autorizar" },
                  { id: "AUTHORIZED", label: "Autorizados (Aguardando entrega)" },
                  { id: "DELIVERED", label: "Entregues" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setReleaseSubFilter(f.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    releaseSubFilter === f.id
                      ? "bg-[#EAF3FC] text-[#0B3B70] border border-[#1684D8]/30"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {releaseDeals.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhuma negociação encontrada para o filtro de liberação selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F4F7FA] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 pl-6 pr-3">Negociação</th>
                    <th className="py-3 px-3">Veículo</th>
                    <th className="py-3 px-3">Cliente</th>
                    <th className="py-3 px-3">Requisitos Obrigatórios & Bloqueios</th>
                    <th className="py-3 px-3">Situação da Autorização</th>
                    <th className="py-3 pl-3 pr-6 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {releaseDeals.map(({ deal, vehicle, customer, summary }) => {
                    const stageLabel =
                      WORKFLOW_STAGES.find((s) => s.code === deal.currentStage)
                        ?.name ?? deal.currentStage;
                    return (
                      <tr key={deal.id} className="hover:bg-[#F4F7FA]/60 transition">
                        <td className="py-3.5 pl-6 pr-3 font-mono font-extrabold text-[#0B3B70]">
                          {deal.dealNumber}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-[#172B3A]">
                            {vehicle.brand} {vehicle.model} ({vehicle.color})
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {vehicle.internalCode} • {vehicle.vin}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-[#172B3A]">
                          {customer.fullName}
                        </td>
                        <td className="py-3.5 px-3">
                          {summary.deliveryBlockers.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              Todos os requisitos obrigatórios cumpridos (100%)
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-red-700 font-bold">
                                <Lock className="h-3.5 w-3.5 shrink-0" />
                                Bloqueado ({summary.deliveryBlockers.length} requisito(s) pendente(s))
                              </span>
                              <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                Etapa: {stageLabel} • {summary.deliveryBlockers[0]?.title}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <DealStatusBadge status={deal.status} />
                        </td>
                        <td className="py-3.5 pl-3 pr-6 text-right">
                          <Link
                            href={`/app/negociacoes/${deal.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-3 py-1.5 text-xs font-bold text-white transition"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            <span>Abrir Passaporte</span>
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
      )}

      {/* ===================================================================== */}
      {/* MÓDULO 4.11: CAIXAS DE APROVAÇÃO FORMAL POR ÁREA */}
      {/* ===================================================================== */}
      {(activeTab === "FORMAL_APPROVALS" || activeTab === "OVERVIEW") && (
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#EAF3FC] flex items-center justify-center text-[#1684D8]">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#172B3A]">
                  Controle de Aprovações Formais por Área ({filteredFormalTasks.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Itens aguardando decisão formal (Financeiro, Documental, Operação). Exige justificativa e evidências no Passaporte Digital.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <select
                aria-label="Filtrar aprovações por área responsável"
                value={areaFilter}
                onChange={(e) =>
                  setAreaFilter(e.target.value as ResponsibleArea | "ALL")
                }
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-[#172B3A]"
              >
                <option value="ALL">Todas as áreas responsáveis</option>
                {(Object.keys(AREA_LABELS) as ResponsibleArea[]).map((a) => (
                  <option key={a} value={a}>
                    {AREA_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredFormalTasks.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhuma etapa aguardando aprovação formal para os filtros selecionados.
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4 p-5 sm:p-6 bg-[#F4F7FA]/40">
              {filteredFormalTasks.map(
                ({ task, deal, vehicle, customerName }) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[#0B3B70] bg-[#EAF3FC] border border-[#1684D8]/30 px-2.5 py-0.5 rounded">
                          {deal.dealNumber} • {AREA_LABELS[task.responsibleArea]}
                        </span>
                        <TaskStateBadge state={task.state} />
                      </div>
                      <h3 className="text-sm font-extrabold text-[#172B3A]">
                        {task.title}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Veículo: <strong>{vehicle.brand} {vehicle.model}</strong> ({vehicle.internalCode}) • Comprador: <strong>{customerName}</strong>
                      </p>
                      {task.pendingReason && (
                        <p className="text-xs text-amber-900 font-medium bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          <span>{task.pendingReason}</span>
                        </p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        Requer decisão formal com justificativa
                      </span>
                      <Link
                        href={`/app/negociacoes/${deal.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B3B70] hover:bg-[#1684D8] px-3.5 py-1.5 text-xs font-bold text-white transition"
                      >
                        <span>Registrar Aprovação</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
