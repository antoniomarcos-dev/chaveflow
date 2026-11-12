"use client";
import { CustomerAccessButton } from "./CustomerAccessButton";

import type { DealPassportView } from "@/application/deal-service";
import type { AssistantResponse } from "@/domain/contextual-assistant";
import {
  AREA_LABELS,
  PermissionCode,
  ResponsibleArea,
  ROLE_LABELS,
  RoleCode,
  TASK_APPROVAL_STATUS_LABELS,
  WORKFLOW_STAGES,
} from "@/domain/types";
import type { DealBlocker } from "@/domain/workflow-engine";
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from "@/lib/format";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  KeyRound,
  Lock,
  MessageSquare,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DealStatusBadge,
  DocumentStatusBadge,
  TaskStateBadge,
} from "./StatusBadge";

export function DealPassportClient({
  passport,
  userRoles,
  userPermissions,
  internalStaffList,
}: {
  passport: DealPassportView;
  userRoles: RoleCode[];
  userPermissions: PermissionCode[];
  internalStaffList: Array<{ id: string; fullName: string; roles: RoleCode[] }>;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "TASKS" | "DOCUMENTS" | "RELEASE" | "HISTORY" | "ASSISTANT"
  >("TASKS");

  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: "SUCCESS" | "ERROR";
    title: string;
    message: string;
    blockers?: DealBlocker[];
  } | null>(null);

  // Estado para Upload / Substituição de Documento
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [uploadNotes, setUploadNotes] = useState("");
  const [replacementReason, setReplacementReason] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Estado para Revisão de Documento
  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);
  const [reviewJustification, setReviewJustification] = useState("");

  // Estado para Solicitar Novo Documento
  const [showRequestDocModal, setShowRequestDocModal] = useState(false);
  const [reqDocTitle, setReqDocTitle] = useState("");
  const [reqDocWhy, setReqDocWhy] = useState("");
  const [reqDocArea, setReqDocArea] =
    useState<ResponsibleArea>("DOCUMENTATION");
  const [reqDocBlocksBilling, setReqDocBlocksBilling] = useState(true);
  const [reqDocBlocksDelivery, setReqDocBlocksDelivery] = useState(true);
  const [reqDocCustomerVisible, setReqDocCustomerVisible] = useState(true);

  // Estado para Aprovação Formal de Tarefa
  const [approvingTaskCode, setApprovingTaskCode] = useState<string | null>(
    null,
  );
  const [approvalJustification, setApprovalJustification] = useState("");

  // Estado para Faturamento, Autorização e Entrega
  const [invoiceNumber, setInvoiceNumber] = useState(
    passport.deal.invoiceNumber || "",
  );
  const [billingNotes, setBillingNotes] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [confirmedVinInput, setConfirmedVinInput] = useState("");
  const [recipientName, setRecipientName] = useState(
    passport.customer.fullName,
  );
  const [recipientDoc, setRecipientDoc] = useState(
    passport.customer.documentNumber,
  );
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [addendumNote, setAddendumNote] = useState("");

  // Estado do Assistente Contextual
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantReply, setAssistantReply] =
    useState<AssistantResponse | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);

  const hasPerm = (perm: PermissionCode) =>
    userRoles.includes("ADMIN") || userPermissions.includes(perm);

  async function callDealApi(
    payload: Record<string, unknown>,
    successMsg: string,
  ) {
    setFeedbackBanner(null);
    setActionLoading(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedbackBanner({
          type: "ERROR",
          title: "Operação bloqueada ou não concluída",
          message: data.error || "Não foi possível realizar a ação.",
          blockers: data.blockers,
        });
        router.refresh();
        return false;
      }
      setFeedbackBanner({
        type: "SUCCESS",
        title: "Operação registrada com sucesso",
        message: successMsg,
      });
      router.refresh();
      return true;
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRealFileUpload(docId: string) {
    if (!selectedFile) return;
    setFeedbackBanner(null);
    setActionLoading(true);
    try {
      if (selectedFile.size > 4 * 1024 * 1024)
        throw new Error("O arquivo deve ter até 4 MB.");
      const formData = new FormData();
      formData.append("dealId", passport.deal.id);
      formData.append("documentId", docId);
      formData.append("uploadNotes", uploadNotes);
      formData.append("replacementReason", replacementReason);
      formData.append("file", selectedFile);

      const res = await fetch("/api/deals", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedbackBanner({
          type: "ERROR",
          title: "Falha no envio do arquivo",
          message: data.error || "Erro ao validar o arquivo no servidor.",
        });
        return;
      }
      setUploadingDocId(null);
      setSelectedFile(null);
      setUploadNotes("");
      setReplacementReason("");
      setFeedbackBanner({
        type: "SUCCESS",
        title: "Arquivo armazenado em área privada",
        message:
          data.invalidatedApprovalsCount > 0
            ? `Nova versão v${data.version.versionNumber} registrada! Como o documento estava aprovado, ${data.invalidatedApprovalsCount} aprovação(ões) dependente(s) foram marcadas como desatualizadas e ${data.reopenedTasksCount} verificação(ões) reaberta(s).`
            : `Versão v${data.version.versionNumber} enviada com sucesso e encaminhada para conferência.`,
      });
      router.refresh();
    } catch (error) {
      setFeedbackBanner({
        type: "ERROR",
        title: "Falha no envio",
        message:
          error instanceof Error
            ? error.message
            : "Falha de conexão. Tente novamente.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function askAssistant(q: string) {
    if (!q.trim()) return;
    setAssistantLoading(true);
    setActiveTab("ASSISTANT");
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ASSISTANT_QUESTION",
          dealId: passport.deal.id,
          question: q,
        }),
      });
      const data = await res.json();
      if (data.ok && data.response) {
        setAssistantReply(data.response);
      }
    } finally {
      setAssistantLoading(false);
    }
  }

  const {
    deal,
    vehicle,
    tradeInVehicle,
    customer,
    seller,
    summary,
    userNextAction,
  } = passport;

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página do Passaporte Digital */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/app/negociacoes"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F4F7FA] hover:bg-[#EAF3FC] px-2.5 py-1 text-xs font-bold text-[#0B3B70] transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Negociações</span>
            </Link>
            <span className="rounded-lg bg-[#0B3B70] px-2.5 py-1 font-mono text-xs font-extrabold text-white">
              {deal.dealNumber}
            </span>
            <DealStatusBadge status={deal.status} />
            <span className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              Fluxo v{passport.workflowVersion.versionNumber}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#172B3A] pt-1">
            Passaporte Digital da Negociação
          </h1>
          <p className="text-xs text-slate-500">
            Última atualização registrada em{" "}
            <strong className="text-[#172B3A]">
              {formatDateTimeBr(deal.updatedAt)}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(userRoles.includes("ADMIN") ||
            userRoles.includes("MANAGER") ||
            userRoles.includes("SELLER")) &&
            deal.status !== "DRAFT" && (
              <CustomerAccessButton dealId={deal.id} compact />
            )}
          {passport.customerAccessToken && (
            <Link
              href={`/cliente?token=${encodeURIComponent(
                passport.customerAccessToken,
              )}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-[#172B3A] transition"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#1684D8]" />
              <span>Visão do Cliente</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() =>
              askAssistant("O que falta para entregar este carro?")
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3B70] hover:bg-[#1684D8] px-3.5 py-2 text-xs font-bold text-white transition"
          >
            <Bot className="h-3.5 w-3.5 text-[#EAF3FC]" />
            <span>Assistente Contextual</span>
          </button>
        </div>
      </div>

      {/* Banner de Feedback ou de Bloqueio de Liberação */}
      {feedbackBanner && (
        <div
          role="alert"
          className={`rounded-2xl border-2 p-5 shadow-md space-y-3 ${
            feedbackBanner.type === "ERROR"
              ? "bg-red-50 border-red-400 text-red-950"
              : "bg-emerald-50 border-emerald-400 text-emerald-950"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 font-extrabold text-sm">
              {feedbackBanner.type === "ERROR" ? (
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              )}
              <span>{feedbackBanner.title}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-xs font-bold underline"
            >
              Fechar
            </button>
          </div>
          <p className="text-xs leading-relaxed">{feedbackBanner.message}</p>

          {feedbackBanner.blockers && feedbackBanner.blockers.length > 0 && (
            <div className="pt-2 border-t border-red-200 space-y-2">
              <div className="text-xs font-bold text-red-900">
                Requisitos impeditivos verificados no servidor:
              </div>
              <ul className="space-y-1.5 text-xs">
                {feedbackBanner.blockers.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-lg bg-white border border-red-200 p-2.5"
                  >
                    <div className="font-bold text-red-950">
                      {b.title} — Área Responsável: {b.responsibleAreaLabel}
                    </div>
                    <div className="text-slate-700 mt-0.5">{b.reason}</div>
                    <div className="text-[#0B3B70] font-semibold mt-0.5">
                      Próximo passo: {b.actionRequired}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* RESUMO DO VEÍCULO, COMPRADOR E PROGRESSO DAS ETAPAS (Prancha Tela 3) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="grid lg:grid-cols-12 gap-6 items-center">
          {/* Veículo Vinculado */}
          <div className="lg:col-span-7 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <img
              src={vehicle.photos[0] || "/vehicle-placeholder.svg"}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="w-full sm:w-44 h-28 rounded-xl border border-slate-200 object-cover bg-slate-900 shrink-0"
            />
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold bg-[#EAF3FC] text-[#0B3B70] px-2.5 py-0.5 rounded">
                  {vehicle.internalCode}
                </span>
                <Link
                  href={`/app/veiculos/${vehicle.id}`}
                  className="text-xs text-[#1684D8] font-bold hover:underline"
                >
                  Ficha permanente & QR →
                </Link>
              </div>
              <h2 className="text-xl font-extrabold text-[#172B3A]">
                {vehicle.brand} {vehicle.model} — {vehicle.trim}
              </h2>
              <p className="text-xs text-slate-600">
                {vehicle.manufacturingYear}/{vehicle.modelYear} •{" "}
                <strong className="text-[#172B3A]">{vehicle.color}</strong> •
                Chassi:{" "}
                <code className="font-mono font-bold text-[#172B3A]">
                  {vehicle.vin}
                </code>
              </p>
            </div>
          </div>

          {/* Comprador e Vendedor */}
          <div className="lg:col-span-5 rounded-xl bg-[#F4F7FA] border border-slate-200 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Cliente / Comprador ({deal.buyerType})
              </span>
              <span className="text-[11px] font-semibold text-[#0B3B70]">
                Vendedor: {seller.fullName}
              </span>
            </div>
            <div className="text-base font-extrabold text-[#172B3A]">
              {customer.fullName}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
              <span>
                CPF/CNPJ: <strong className="font-mono">{customer.documentNumber}</strong>
              </span>
              {customer.phone && <span>Tel: {customer.phone}</span>}
            </div>
          </div>
        </div>

        {/* Barra Horizontal de Progresso das Etapas */}
        <div className="pt-5 border-t border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B3B70]">
                Progresso das Etapas ({summary.completedApplicableTasksCount} de{" "}
                {summary.applicableTasksCount} tarefas aplicáveis concluídas •{" "}
                {summary.waivedTasksCount} dispensada(s) por regra)
              </h3>
              <p className="text-[11px] text-slate-500">
                A conclusão percentual reflete tarefas aplicáveis; a liberação
                permanece condicionada às aprovações obrigatórias.
              </p>
            </div>
            <span className="text-xs font-bold text-[#0B3B70] bg-[#EAF3FC] border border-[#1684D8]/30 px-3 py-1 rounded-full">
              Avanço: {summary.progressPercentage}%
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {WORKFLOW_STAGES.map((st) => {
              const stageTasks = passport.tasks.filter(
                (t) =>
                  t.stageCode === st.code &&
                  t.state !== "WAIVED_BY_RULE" &&
                  t.state !== "CANCELLED",
              );
              const allDone =
                stageTasks.length > 0 &&
                stageTasks.every(
                  (t) =>
                    t.state === "COMPLETED" &&
                    (!t.requiresFormalApproval ||
                      t.approvalStatus === "APPROVED"),
                );
              const isCurrent =
                summary.currentStage === st.code && deal.status !== "DELIVERED";

              return (
                <div
                  key={st.code}
                  className={`rounded-xl border p-2.5 text-xs transition ${
                    allDone || deal.status === "DELIVERED"
                      ? "bg-emerald-50/90 border-emerald-300 text-emerald-950"
                      : isCurrent
                        ? "bg-[#EAF3FC] border-[#1684D8] text-[#0B3B70] ring-2 ring-[#1684D8]/20"
                        : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                        allDone || deal.status === "DELIVERED"
                          ? "bg-emerald-600 text-white"
                          : isCurrent
                            ? "bg-[#1684D8] text-white"
                            : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {allDone || deal.status === "DELIVERED" ? "✓" : st.order}
                    </span>
                    {allDone || deal.status === "DELIVERED" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : isCurrent ? (
                      <Clock className="h-3.5 w-3.5 text-[#1684D8]" />
                    ) : null}
                  </div>
                  <div className="font-bold mt-1.5 leading-tight">{st.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRÓXIMA AÇÃO + INFORMAÇÕES DA NEGOCIAÇÃO E PILARES */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Card Próxima Ação */}
        <div
          className={`lg:col-span-6 rounded-2xl border-2 p-5 shadow-xs flex flex-col justify-between gap-4 ${
            userNextAction.hasDirectAction
              ? "bg-[#0B3B70] text-white border-[#1684D8]"
              : "bg-white text-[#172B3A] border-slate-200"
          }`}
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${
                  userNextAction.hasDirectAction
                    ? "bg-[#1684D8] text-white"
                    : "bg-[#EAF3FC] text-[#0B3B70]"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Próxima Ação</span>
              </span>
              <span
                className={`text-xs font-semibold ${
                  userNextAction.hasDirectAction
                    ? "text-[#EAF3FC]"
                    : "text-slate-500"
                }`}
              >
                Área responsável: {userNextAction.responsibleAreaLabel}
              </span>
            </div>

            <h2 className="text-lg font-extrabold">
              {userNextAction.headline}
            </h2>
            <p
              className={`text-xs sm:text-sm leading-relaxed ${
                userNextAction.hasDirectAction
                  ? "text-[#EAF3FC]/90"
                  : "text-slate-600"
              }`}
            >
              {userNextAction.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {userNextAction.actionType === "UPLOAD_DOCUMENT" &&
              userNextAction.targetDocumentId && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("DOCUMENTS");
                    setUploadingDocId(userNextAction.targetDocumentId!);
                  }}
                  className="rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
                >
                  Enviar documento solicitado
                </button>
              )}

            {userNextAction.actionType === "REVIEW_DOCUMENT" &&
              userNextAction.targetDocumentId && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() =>
                    callDealApi(
                      {
                        action: "REVIEW_DOCUMENT",
                        dealId: deal.id,
                        documentId: userNextAction.targetDocumentId,
                        decision: "APPROVED",
                        justification:
                          "Documento conferido e aprovado conforme procedimento publicado.",
                      },
                      "Documento conferido e aprovado com sucesso!",
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
                >
                  <FileCheck2 className="h-4 w-4" />
                  <span>Conferir e Aprovar Documento</span>
                </button>
              )}

            {userNextAction.actionType === "APPROVE_TASK" &&
              userNextAction.targetTaskCode && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() =>
                    callDealApi(
                      {
                        action: "FORMAL_APPROVAL",
                        dealId: deal.id,
                        taskCode: userNextAction.targetTaskCode,
                        decision: "APPROVED",
                        justification:
                          "Conferência formal realizada com evidência validada.",
                      },
                      "Aprovação formal registrada com sucesso!",
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span>Registrar Aprovação Formal</span>
                </button>
              )}

            {userNextAction.actionType === "REGISTER_BILLING" && (
              <button
                type="button"
                onClick={() => setActiveTab("RELEASE")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white"
              >
                <span>Registrar Nota Fiscal →</span>
              </button>
            )}

            {userNextAction.actionType === "AUTHORIZE_RELEASE" && (
              <button
                type="button"
                onClick={() => setActiveTab("RELEASE")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Emitir Autorização de Liberação →</span>
              </button>
            )}

            {userNextAction.actionType === "CONFIRM_DELIVERY" && (
              <button
                type="button"
                onClick={() => setActiveTab("RELEASE")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white"
              >
                <KeyRound className="h-4 w-4" />
                <span>Reconfirmar Chassi e Registrar Entrega →</span>
              </button>
            )}
          </div>
        </div>

        {/* Card Informações da Negociação, Pilares e Paralelismo */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-extrabold text-[#172B3A]">
              Informações da negociação e pilares
            </h3>
            <span className="text-[11px] font-semibold text-slate-500">
              {summary.parallelTasks.length} tarefa(s) disponíveis em paralelo
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-2.5">
              <span className="text-slate-500 block text-[11px]">
                Modalidade:
              </span>
              <strong className="text-[#172B3A]">
                {deal.paymentMethod === "FINANCING"
                  ? `Financiamento (${deal.financingInstitution || "Banco"})`
                  : deal.paymentMethod === "CASH"
                    ? "À Vista (PIX/TED)"
                    : deal.paymentMethod}
              </strong>
            </div>
            <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-2.5">
              <span className="text-slate-500 block text-[11px]">
                Procuração:
              </span>
              <strong className="text-[#172B3A]">
                {deal.hasPowerOfAttorney
                  ? `Sim (${deal.attorneyName})`
                  : "Não exigida"}
              </strong>
            </div>
            <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-2.5">
              <span className="text-slate-500 block text-[11px]">
                Nota Fiscal:
              </span>
              <strong className="text-[#172B3A]">
                {deal.invoiceNumber || "Aguardando NF"}
              </strong>
            </div>
            <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-2.5">
              <span className="text-slate-500 block text-[11px]">
                Previsão Entrega:
              </span>
              <strong className="text-[#172B3A]">
                {deal.confirmedDeliveryDate
                  ? `Confirmada: ${formatDateBr(deal.confirmedDeliveryDate)}`
                  : deal.expectedDeliveryDate
                    ? `${formatDateBr(deal.expectedDeliveryDate)} (Não confirmada)`
                    : "A definir"}
              </strong>
            </div>
          </div>

          {tradeInVehicle && (
            <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-3 text-xs">
              <span className="font-bold text-amber-950 block">
                Veículo Usado na Troca (Cadastro separado do veículo vendido):
              </span>
              <span className="text-amber-900 mt-0.5 block">
                <strong>
                  {tradeInVehicle.brand} {tradeInVehicle.model}{" "}
                  {tradeInVehicle.modelYear} ({tradeInVehicle.color})
                </strong>{" "}
                • Placa: <code>{tradeInVehicle.plate}</code> • Chassi:{" "}
                <code>{tradeInVehicle.vin}</code> • Avaliação:{" "}
                <strong>
                  {formatCurrencyBr(tradeInVehicle.appraisedValue)}
                </strong>
              </span>
            </div>
          )}

          {/* 3 Pilares: Financeiro, Documental e Operacional */}
          <div className="grid sm:grid-cols-3 gap-2.5">
            {[
              summary.pillars.financial,
              summary.pillars.documentation,
              summary.pillars.operational,
            ].map((p) => (
              <div
                key={p.area}
                className={`rounded-xl border p-2.5 text-xs ${
                  p.status === "OK"
                    ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                    : p.status === "BLOCKED"
                      ? "bg-red-50/70 border-red-300 text-red-950"
                      : "bg-amber-50/60 border-amber-300 text-amber-950"
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>{p.label}</span>
                  {p.status === "OK" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                  )}
                </div>
                <p className="mt-1 text-[11px] font-medium leading-snug">
                  {p.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LISTA DE BLOQUEIOS (O QUE IMPEDE O FATURAMENTO OU A ENTREGA) */}
      {deal.status !== "DELIVERED" && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
                {summary.deliveryBlockers.length > 0 ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <span>
                      Requisitos Obrigatórios Pendentes (
                      {summary.deliveryBlockers.length} para entrega •{" "}
                      {summary.billingBlockers.length} para faturamento)
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span>
                      Nenhum requisito técnico bloqueando a autorização de
                      entrega
                    </span>
                  </>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                A liberação do veículo permanece condicionada ao cumprimento de
                100% dos requisitos obrigatórios e aprovações autorizadas.
              </p>
            </div>

            {summary.deliveryBlockers.length > 0 &&
              hasPerm("release:authorize") && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() =>
                    callDealApi(
                      {
                        action: "AUTHORIZE_RELEASE",
                        dealId: deal.id,
                      },
                      "",
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 px-3.5 py-2 text-xs font-bold text-red-900 transition"
                >
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  <span>Testar Bloqueio de Liberação Prematura</span>
                </button>
              )}
          </div>

          {summary.deliveryBlockers.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3">
              {summary.deliveryBlockers.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl bg-red-50/50 border border-red-200 p-3.5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-red-950">{b.title}</span>
                    <span className="rounded bg-white border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-800">
                      {b.responsibleAreaLabel}
                    </span>
                  </div>
                  <p className="text-slate-700">{b.reason}</p>
                  <p className="text-[#0B3B70] font-semibold">
                    Ação necessária: {b.actionRequired}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* NAVEGAÇÃO POR ABAS DO PASSAPORTE */}
      <div className="border-b border-slate-200 flex flex-wrap gap-2">
        {[
          {
            id: "TASKS" as const,
            label: `Tarefas e Regras (${passport.tasks.length})`,
            Icon: ClipboardCheck,
          },
          {
            id: "DOCUMENTS" as const,
            label: `Documentos (${passport.documents.length})`,
            Icon: FileText,
          },
          {
            id: "RELEASE" as const,
            label: "Faturamento, Autorização e Entrega",
            Icon: KeyRound,
          },
          {
            id: "HISTORY" as const,
            label: `Histórico e Auditoria (${passport.auditEvents.length})`,
            Icon: History,
          },
          {
            id: "ASSISTANT" as const,
            label: "Assistente Contextual",
            Icon: Bot,
          },
        ].map((tab) => {
          const Icon = tab.Icon;
          const isAct = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-bold transition ${
                isAct
                  ? "border-[#1684D8] text-[#0B3B70] bg-white rounded-t-xl"
                  : "border-transparent text-slate-600 hover:text-[#172B3A]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ABA 1: TAREFAS */}
      {activeTab === "TASKS" && (
        <div className="space-y-4">
          {passport.tasks.map((t) => (
            <div
              key={t.id}
              className={`rounded-2xl border p-5 shadow-xs space-y-3 ${
                t.state === "WAIVED_BY_RULE"
                  ? "bg-slate-50 border-slate-200 opacity-85"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                      {t.code}
                    </span>
                    <span className="rounded bg-[#EAF3FC] border border-[#1684D8]/30 px-2 py-0.5 text-[11px] font-bold text-[#0B3B70]">
                      Área: {AREA_LABELS[t.responsibleArea]}
                    </span>
                    {t.blocksBilling && (
                      <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                        Requisito p/ Faturar
                      </span>
                    )}
                    {t.blocksDelivery && (
                      <span className="rounded bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-900">
                        Requisito p/ Entregar
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-extrabold text-[#172B3A] mt-1.5">
                    {t.title}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <TaskStateBadge state={t.state} />
                  {t.requiresFormalApproval && (
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        t.approvalStatus === "APPROVED"
                          ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                          : t.approvalStatus === "OUTDATED" ||
                              t.approvalStatus === "REJECTED"
                            ? "bg-red-50 text-red-900 border-red-300"
                            : "bg-amber-50 text-amber-900 border-amber-300"
                      }`}
                    >
                      {TASK_APPROVAL_STATUS_LABELS[t.approvalStatus]}
                    </span>
                  )}
                </div>
              </div>

              {/* Detalhes obrigatórios da tarefa: O que fazer, Por que é necessário, Responsável, Prazo, Dependências e Procedimento */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs bg-[#F4F7FA] rounded-xl p-3.5 border border-slate-200">
                <div>
                  <span className="font-bold text-[#172B3A] block">
                    O que fazer:
                  </span>
                  <p className="text-slate-600 mt-0.5">{t.description}</p>
                </div>
                <div>
                  <span className="font-bold text-[#172B3A] block">
                    Por que é necessário:
                  </span>
                  <p className="text-slate-600 mt-0.5">{t.whyRequired}</p>
                </div>
                <div>
                  <span className="font-bold text-[#172B3A] block">
                    Orientação operacional:
                  </span>
                  <p className="text-slate-600 mt-0.5">{t.guidance}</p>
                </div>
                <div>
                  <span className="font-bold text-[#172B3A] block">
                    Responsável e Prazo:
                  </span>
                  <p className="text-slate-600 mt-0.5">
                    {t.assigneeName || AREA_LABELS[t.responsibleArea]} • Prazo:{" "}
                    {t.dueAt ? formatDateTimeBr(t.dueAt) : "Não aplicável"}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-[#172B3A] block">
                    Dependências e Evidências:
                  </span>
                  <p className="text-slate-600 mt-0.5">
                    Depende de:{" "}
                    {t.dependsOnTaskCodes.length > 0
                      ? t.dependsOnTaskCodes.join(", ")
                      : "Nenhuma (Inicial)"}{" "}
                    • Evidência:{" "}
                    {t.requiredEvidenceTypes.length > 0
                      ? t.requiredEvidenceTypes.join(", ")
                      : "Execução no sistema"}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-[#172B3A] block">
                    Procedimento Publicado de Referência:
                  </span>
                  {t.publishedProcedure ? (
                    <p className="text-[#0B3B70] font-semibold mt-0.5 flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5 text-[#1684D8] shrink-0" />
                      <span>
                        {t.publishedProcedure.title} (v
                        {t.publishedProcedure.versionNumber})
                      </span>
                    </p>
                  ) : (
                    <p className="text-slate-500 mt-0.5">Padrão interno</p>
                  )}
                </div>
              </div>

              {/* Explicação explícita do motivo da pendência ou da dispensa por regra */}
              {t.state === "WAIVED_BY_RULE" && t.waivedRuleDescription && (
                <div className="rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-xs text-slate-700">
                  <strong>Condição que dispensou esta tarefa por regra:</strong>{" "}
                  {t.waivedRuleDescription}
                </div>
              )}

              {t.state !== "COMPLETED" &&
                t.state !== "WAIVED_BY_RULE" &&
                t.pendingReason && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-950">
                    <strong>Motivo da situação atual e ação necessária:</strong>{" "}
                    {t.pendingReason}
                  </div>
                )}

              {/* Ações disponíveis para o usuário atual */}
              {t.state !== "WAIVED_BY_RULE" &&
                t.state !== "COMPLETED" &&
                deal.status !== "DELIVERED" && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {!t.requiresFormalApproval &&
                        t.code !== "TASK_BILLING_INVOICE" &&
                        t.code !== "TASK_CONFIRM_DELIVERY" && (
                          <button
                            type="button"
                            disabled={
                              actionLoading ||
                              t.state === "WAITING_PREREQUISITE"
                            }
                            onClick={() =>
                              callDealApi(
                                {
                                  action: "TASK_ACTION",
                                  dealId: deal.id,
                                  taskCode: t.code,
                                  taskAction: "COMPLETE_OPERATIONAL",
                                },
                                `Tarefa '${t.title}' marcada como concluída.`,
                              )
                            }
                            className="rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40 transition"
                          >
                            Concluir Tarefa Operacional
                          </button>
                        )}

                      {t.requiresFormalApproval &&
                        t.code !== "TASK_RELEASE_AUTH" && (
                          <button
                            type="button"
                            disabled={
                              actionLoading ||
                              t.state === "WAITING_PREREQUISITE"
                            }
                            onClick={() =>
                              setApprovingTaskCode(
                                approvingTaskCode === t.code ? null : t.code,
                              )
                            }
                            className="rounded-xl bg-[#0B3B70] hover:bg-[#1684D8] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40 transition"
                          >
                            Registrar Aprovação (
                            {t.approvalRole
                              ? ROLE_LABELS[t.approvalRole]
                              : AREA_LABELS[t.responsibleArea]}
                            )
                          </button>
                        )}
                    </div>

                    {hasPerm("task:assign") && (
                      <div className="flex items-center gap-2 text-xs">
                        <label className="text-slate-500 font-medium">
                          Atribuir:
                        </label>
                        <select
                          value={t.assigneeId || ""}
                          onChange={(e) =>
                            callDealApi(
                              {
                                action: "TASK_ACTION",
                                dealId: deal.id,
                                taskCode: t.code,
                                taskAction: "ASSIGN",
                                targetAssigneeId: e.target.value,
                              },
                              "Responsável atualizado.",
                            )
                          }
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-[#172B3A]"
                        >
                          <option value="">Selecionar colaborador...</option>
                          {internalStaffList.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

              {/* Formulário Inline de Aprovação Formal */}
              {approvingTaskCode === t.code && (
                <div className="rounded-xl bg-[#0B3B70] text-white p-4 space-y-3">
                  <div className="text-xs font-bold text-[#EAF3FC]">
                    Registrar Decisão Formal de Aprovação ou Rejeição —{" "}
                    {t.title}
                  </div>
                  <textarea
                    rows={2}
                    value={approvalJustification}
                    onChange={(e) => setApprovalJustification(e.target.value)}
                    placeholder="Informe o parecer / justificativa e referência da evidência conferida..."
                    className="w-full rounded-lg bg-[#082B54] border border-white/20 p-2.5 text-xs text-white placeholder:text-white/50"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        const ok = await callDealApi(
                          {
                            action: "FORMAL_APPROVAL",
                            dealId: deal.id,
                            taskCode: t.code,
                            decision: "APPROVED",
                            justification:
                              approvalJustification.trim() ||
                              "Conferido e aprovado com evidência validada.",
                          },
                          `Etapa '${t.title}' aprovada formalmente!`,
                        );
                        if (ok) {
                          setApprovingTaskCode(null);
                          setApprovalJustification("");
                        }
                      }}
                      className="rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2 text-xs font-bold text-white"
                    >
                      Aprovar Etapa
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        const ok = await callDealApi(
                          {
                            action: "FORMAL_APPROVAL",
                            dealId: deal.id,
                            taskCode: t.code,
                            decision: "CORRECTION_REQUESTED",
                            justification: approvalJustification,
                          },
                          `Solicitação de correção registrada para '${t.title}'.`,
                        );
                        if (ok) {
                          setApprovingTaskCode(null);
                          setApprovalJustification("");
                        }
                      }}
                      className="rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2 text-xs font-bold text-white"
                    >
                      Rejeitar / Solicitar Correção
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ABA 2: DOCUMENTOS PRIVADOS E VERSÕES */}
      {activeTab === "DOCUMENTS" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#1684D8] shrink-0" />
              <span>
                Armazenamento privado com validação de tipo/tamanho no servidor
                e links temporários assinados (HMAC). Substituir um documento
                aprovado preserva a versão anterior, marca aprovações
                dependentes como desatualizadas e reabre verificações.
              </span>
            </div>
            {hasPerm("document:request") && deal.status !== "DELIVERED" && (
              <button
                type="button"
                onClick={() => setShowRequestDocModal((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-3.5 py-2 text-xs font-bold text-white shrink-0 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Solicitar Documento Adicional</span>
              </button>
            )}
          </div>

          {showRequestDocModal && (
            <div className="bg-white rounded-2xl border-2 border-[#1684D8] p-5 space-y-4">
              <h3 className="text-sm font-bold text-[#172B3A]">
                Solicitar Novo Documento na Negociação
              </h3>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block">
                    Título do Documento *
                  </label>
                  <input
                    type="text"
                    value={reqDocTitle}
                    onChange={(e) => setReqDocTitle(e.target.value)}
                    placeholder="Ex: Declaração de Quitação de Consórcio"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[#172B3A]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block">
                    Área Responsável pela Conferência *
                  </label>
                  <select
                    value={reqDocArea}
                    onChange={(e) =>
                      setReqDocArea(e.target.value as ResponsibleArea)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[#172B3A]"
                  >
                    <option value="DOCUMENTATION">Documentação</option>
                    <option value="FINANCE">Financeiro</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-700 block">
                    Por que é exigido? *
                  </label>
                  <input
                    type="text"
                    value={reqDocWhy}
                    onChange={(e) => setReqDocWhy(e.target.value)}
                    placeholder="Explique o motivo para orientar o vendedor e o comprador..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[#172B3A]"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={reqDocBlocksBilling}
                      onChange={(e) => setReqDocBlocksBilling(e.target.checked)}
                    />
                    <span>Bloqueia Faturamento</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={reqDocBlocksDelivery}
                      onChange={(e) =>
                        setReqDocBlocksDelivery(e.target.checked)
                      }
                    />
                    <span>Bloqueia Entrega</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={reqDocCustomerVisible}
                      onChange={(e) =>
                        setReqDocCustomerVisible(e.target.checked)
                      }
                    />
                    <span>Compartilhável na Área do Cliente</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRequestDocModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={
                    actionLoading || !reqDocTitle.trim() || !reqDocWhy.trim()
                  }
                  onClick={async () => {
                    const ok = await callDealApi(
                      {
                        action: "REQUEST_DOCUMENT",
                        dealId: deal.id,
                        title: reqDocTitle,
                        category: "COMPLEMENTARY",
                        whyRequired: reqDocWhy,
                        responsibleArea: reqDocArea,
                        blocksBilling: reqDocBlocksBilling,
                        blocksDelivery: reqDocBlocksDelivery,
                        isCustomerVisible: reqDocCustomerVisible,
                      },
                      `Documento '${reqDocTitle}' solicitado com sucesso.`,
                    );
                    if (ok) {
                      setShowRequestDocModal(false);
                      setReqDocTitle("");
                      setReqDocWhy("");
                    }
                  }}
                  className="rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-4 py-1.5 text-xs font-bold text-white"
                >
                  Confirmar Solicitação
                </button>
              </div>
            </div>
          )}

          {passport.documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider bg-[#EAF3FC] text-[#0B3B70] px-2 py-0.5 rounded">
                      {doc.category} • Área: {AREA_LABELS[doc.responsibleArea]}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Versão atual: v{doc.currentVersionNumber}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-[#172B3A] mt-1">
                    {doc.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    <strong>Por que é necessário:</strong> {doc.whyRequired}
                  </p>
                </div>

                <DocumentStatusBadge status={doc.status} />
              </div>

              {doc.rejectionReason && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-900">
                  <strong>Motivo de rejeição / correção solicitada:</strong>{" "}
                  {doc.rejectionReason}
                </div>
              )}

              {/* Histórico de Versões do Documento */}
              {doc.versions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#172B3A]">
                    Versões armazenadas ({doc.versions.length}):
                  </div>
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
                    {doc.versions.map((ver) => (
                      <div
                        key={ver.id}
                        className="p-3 bg-[#F4F7FA] flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-[#172B3A]">
                            v{ver.versionNumber} — {ver.originalFilename} (
                            {Math.round(ver.sizeBytes / 1024 || 1)} KB)
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Enviado por {ver.uploadedByName} em{" "}
                            {formatDateTimeBr(ver.createdAt)}
                            {ver.uploadNotes
                              ? ` • Obs: ${ver.uploadNotes}`
                              : ""}
                          </div>
                        </div>
                        <a
                          href={ver.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 text-xs font-bold text-[#0B3B70]"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-[#1684D8]" />
                          <span>Visualizar (Link Temporário Assinado)</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botões de Upload / Substituição e de Conferência */}
              {deal.status !== "DELIVERED" && (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {hasPerm("document:upload") && (
                      <button
                        type="button"
                        onClick={() =>
                          setUploadingDocId(
                            uploadingDocId === doc.id ? null : doc.id,
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-[#172B3A]"
                      >
                        <Upload className="h-3.5 w-3.5 text-[#1684D8]" />
                        <span>
                          {doc.status === "APPROVED"
                            ? "Substituir Documento Aprovado (Gera Nova Versão)"
                            : "Enviar documento"}
                        </span>
                      </button>
                    )}
                  </div>

                  {(hasPerm("document:review") ||
                    (doc.responsibleArea === "FINANCE" &&
                      hasPerm("approval:finance"))) &&
                    doc.currentVersionNumber > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        {doc.status !== "APPROVED" && (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() =>
                              callDealApi(
                                {
                                  action: "REVIEW_DOCUMENT",
                                  dealId: deal.id,
                                  documentId: doc.id,
                                  decision: "APPROVED",
                                  justification:
                                    "Documento conferido e aprovado.",
                                },
                                `Documento '${doc.title}' aprovado!`,
                              )
                            }
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white"
                          >
                            Aprovar v{doc.currentVersionNumber}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setReviewingDocId(
                              reviewingDocId === doc.id ? null : doc.id,
                            )
                          }
                          className="rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 px-3 py-2 text-xs font-bold text-red-900"
                        >
                          Rejeitar / Solicitar Correção
                        </button>
                      </div>
                    )}
                </div>
              )}

              {/* Painel Inline de Upload Real ou Substituição de Aprovado */}
              {uploadingDocId === doc.id && (
                <div className="rounded-xl bg-[#0B3B70] text-white p-4 space-y-3 text-xs">
                  <div className="font-bold text-[#EAF3FC]">
                    {doc.status === "APPROVED"
                      ? `Substituição de Documento Aprovado — ${doc.title}`
                      : `Enviar Arquivo Privado — ${doc.title}`}
                  </div>
                  {doc.status === "APPROVED" && (
                    <div className="rounded-lg bg-amber-500/20 border border-amber-400/40 p-2.5 text-amber-100">
                      Atenção: Ao substituir um documento já aprovado, a versão
                      anterior (v{doc.currentVersionNumber}) será preservada,
                      aprovações dependentes ficarão{" "}
                      <strong>Desatualizadas</strong> e as verificações serão
                      reabertas automaticamente.
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#EAF3FC]">
                        Selecionar arquivo (PDF, PNG, JPG, WEBP, TXT — máx 4 MB)
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                        onChange={(e) =>
                          setSelectedFile(e.target.files?.[0] || null)
                        }
                        className="mt-1 w-full rounded bg-[#082B54] border border-white/20 p-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#EAF3FC]">
                        {doc.status === "APPROVED"
                          ? "Motivo da substituição (Obrigatório) *"
                          : "Observações do envio"}
                      </label>
                      <input
                        type="text"
                        value={
                          doc.status === "APPROVED"
                            ? replacementReason
                            : uploadNotes
                        }
                        onChange={(e) =>
                          doc.status === "APPROVED"
                            ? setReplacementReason(e.target.value)
                            : setUploadNotes(e.target.value)
                        }
                        placeholder="Informe o motivo ou observação..."
                        className="mt-1 w-full rounded bg-[#082B54] border border-white/20 p-2 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={actionLoading || !selectedFile}
                      onClick={() => handleRealFileUpload(doc.id)}
                      className="rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2 font-bold text-white disabled:opacity-40"
                    >
                      Enviar Arquivo Selecionado
                    </button>
                  </div>
                </div>
              )}

              {/* Painel Inline de Rejeição / Correção */}
              {reviewingDocId === doc.id && (
                <div className="rounded-xl bg-red-950 text-white p-4 space-y-3 text-xs">
                  <div className="font-bold text-red-200">
                    Informar Motivo de Rejeição ou Correção — {doc.title}
                  </div>
                  <input
                    type="text"
                    value={reviewJustification}
                    onChange={(e) => setReviewJustification(e.target.value)}
                    placeholder="Ex: Imagem ilegível / Falta assinatura no verso..."
                    className="w-full rounded bg-red-900/60 border border-red-700 p-2 text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        const ok = await callDealApi(
                          {
                            action: "REVIEW_DOCUMENT",
                            dealId: deal.id,
                            documentId: doc.id,
                            decision: "CORRECTION_REQUESTED",
                            justification: reviewJustification,
                          },
                          "Solicitação de correção registrada.",
                        );
                        if (ok) {
                          setReviewingDocId(null);
                          setReviewJustification("");
                        }
                      }}
                      className="rounded-lg bg-amber-500 px-3.5 py-1.5 font-bold text-slate-950"
                    >
                      Solicitar Correção
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        const ok = await callDealApi(
                          {
                            action: "REVIEW_DOCUMENT",
                            dealId: deal.id,
                            documentId: doc.id,
                            decision: "REJECTED",
                            justification: reviewJustification,
                          },
                          "Documento rejeitado.",
                        );
                        if (ok) {
                          setReviewingDocId(null);
                          setReviewJustification("");
                        }
                      }}
                      className="rounded-lg bg-red-600 px-3.5 py-1.5 font-bold text-white"
                    >
                      Rejeitar Documento
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ABA 3: FATURAMENTO, AUTORIZAÇÃO E ENTREGA FÍSICA */}
      {activeTab === "RELEASE" && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* 1. Registro de Faturamento */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="eyebrow">Marco 1 • Faturamento</span>
                <h3 className="text-base font-extrabold text-[#172B3A]">
                  Emissão e Registro de Nota Fiscal
                </h3>
                <p className="text-xs text-slate-600">
                  Verificado em transação no servidor: exige dossiê documental e
                  financeiro 100% aprovados.
                </p>

                {deal.billingRegisteredAt ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Nota Fiscal Registrada</span>
                    </div>
                    <div>
                      Número: <strong>{deal.invoiceNumber}</strong>
                    </div>
                    <div>Em: {formatDateTimeBr(deal.billingRegisteredAt)}</div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Número da Nota Fiscal (NF-e) *
                      </label>
                      <input
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-[#172B3A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Observações do Faturamento
                      </label>
                      <input
                        type="text"
                        value={billingNotes}
                        onChange={(e) => setBillingNotes(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-[#172B3A]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {!deal.billingRegisteredAt && (
                <button
                  type="button"
                  disabled={actionLoading || !hasPerm("billing:register")}
                  onClick={() =>
                    callDealApi(
                      {
                        action: "REGISTER_BILLING",
                        dealId: deal.id,
                        invoiceNumber,
                        notes: billingNotes,
                      },
                      `Faturamento registrado com Nota Fiscal '${invoiceNumber}'!`,
                    )
                  }
                  className="w-full rounded-xl bg-[#0B3B70] hover:bg-[#1684D8] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40 transition"
                >
                  {hasPerm("billing:register")
                    ? "Registrar Faturamento"
                    : "Requer perfil Faturamento / Admin"}
                </button>
              )}
            </div>

            {/* 2. Autorização Formal de Liberação */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="eyebrow">Marco 2 • Autorização de Liberação</span>
                <h3 className="text-base font-extrabold text-[#172B3A]">
                  Separado de Elegível e de Entregue
                </h3>
                <p className="text-xs text-slate-600">
                  A conclusão das tarefas torna a negociação{" "}
                  <strong>Elegível</strong>, mas a entrega só pode ocorrer após
                  emissão desta Autorização Formal.
                </p>

                {passport.activeReleaseAuthorization ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>Autorização Formal Ativa</span>
                    </div>
                    <div>
                      Emitida por:{" "}
                      <strong>
                        {passport.activeReleaseAuthorization.authorizedByName}
                      </strong>
                    </div>
                    <div>
                      Em:{" "}
                      {formatDateTimeBr(
                        passport.activeReleaseAuthorization.createdAt,
                      )}
                    </div>
                  </div>
                ) : deal.status === "DELIVERED" ? (
                  <div className="rounded-xl bg-slate-100 border border-slate-300 p-3 text-xs text-slate-800">
                    Autorização já consumida pela entrega física concluída.
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Parecer de Liberação
                    </label>
                    <textarea
                      rows={2}
                      value={releaseNotes}
                      onChange={(e) => setReleaseNotes(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-[#172B3A]"
                    />
                  </div>
                )}
              </div>

              {!passport.activeReleaseAuthorization &&
                deal.status !== "DELIVERED" && (
                  <button
                    type="button"
                    disabled={actionLoading || !hasPerm("release:authorize")}
                    onClick={() =>
                      callDealApi(
                        {
                          action: "AUTHORIZE_RELEASE",
                          dealId: deal.id,
                          notes: releaseNotes,
                          expectedConcurrencyVersion: deal.concurrencyVersion,
                        },
                        "Autorização Formal de Entrega emitida com sucesso! A Operação já pode realizar a entrega física.",
                      )
                    }
                    className="w-full rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40 transition"
                  >
                    {hasPerm("release:authorize")
                      ? "Emitir Autorização Formal de Entrega"
                      : "Requer perfil Responsável pela Liberação / Gestor"}
                  </button>
                )}
            </div>

            {/* 3. Entrega Física das Chaves */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="eyebrow">Marco 3 • Entrega Física</span>
                <h3 className="text-base font-extrabold text-[#172B3A]">
                  Reconfirmação do Veículo e Entrega
                </h3>
                <p className="text-xs text-slate-600">
                  Exige autorização ativa, reconfirmação do chassi ou código
                  interno (<code>{vehicle.vin}</code> ou{" "}
                  <code>{vehicle.internalCode}</code>) e identificação do
                  recebedor.
                </p>

                {passport.deliveryRecord ? (
                  <div className="rounded-xl bg-emerald-100 border border-emerald-400 p-3 text-xs text-emerald-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      <span>Veículo Entregue</span>
                    </div>
                    <div>
                      Entregue por:{" "}
                      <strong>{passport.deliveryRecord.confirmedByName}</strong>
                    </div>
                    <div>
                      Recebido por:{" "}
                      <strong>
                        {passport.deliveryRecord.recipientName} (
                        {passport.deliveryRecord.recipientDocument})
                      </strong>
                    </div>
                    <div>
                      Horário:{" "}
                      {formatDateTimeBr(passport.deliveryRecord.deliveredAt)}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1 text-xs">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-slate-700">
                          Reconfirmar Chassi ou Código Interno *
                        </label>
                        <button
                          type="button"
                          onClick={() => setConfirmedVinInput(vehicle.vin)}
                          className="text-[11px] text-[#1684D8] font-bold hover:underline"
                        >
                          Preencher {vehicle.vin}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={confirmedVinInput}
                        onChange={(e) => setConfirmedVinInput(e.target.value)}
                        placeholder={`Digite ${vehicle.vin} ou ${vehicle.internalCode}`}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-[#172B3A]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block">
                        Nome de quem recebeu as chaves *
                      </label>
                      <input
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[#172B3A]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block">
                        Documento do recebedor *
                      </label>
                      <input
                        type="text"
                        value={recipientDoc}
                        onChange={(e) => setRecipientDoc(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[#172B3A]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block">
                        Observações da entrega
                      </label>
                      <input
                        type="text"
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[#172B3A]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {!passport.deliveryRecord && (
                <button
                  type="button"
                  disabled={
                    actionLoading ||
                    !hasPerm("delivery:confirm") ||
                    !passport.activeReleaseAuthorization
                  }
                  onClick={() =>
                    callDealApi(
                      {
                        action: "CONFIRM_DELIVERY",
                        dealId: deal.id,
                        confirmedVehicleIdentifier: confirmedVinInput,
                        recipientName,
                        recipientDocument: recipientDoc,
                        deliveryNotes,
                      },
                      "Entrega física das chaves confirmada e auditada com sucesso!",
                    )
                  }
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40 transition"
                >
                  {!passport.activeReleaseAuthorization
                    ? "Aguardando Autorização Formal Ativa"
                    : hasPerm("delivery:confirm")
                      ? "Reconfirmar Veículo e Registrar Entrega"
                      : "Requer perfil Operação / Admin"}
                </button>
              )}
            </div>
          </div>

          {/* Registro de Adendo Pós-Entrega (sem apagar o histórico) */}
          {passport.deliveryRecord && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#172B3A]">
                Adendos e Retificações Pós-Entrega (Histórico Original
                Preservado)
              </h3>
              {passport.deliveryRecord.addendums.length > 0 && (
                <ul className="space-y-1.5 text-xs">
                  {passport.deliveryRecord.addendums.map((ad) => (
                    <li
                      key={ad.id}
                      className="rounded-lg bg-[#F4F7FA] border border-slate-200 p-2.5"
                    >
                      <strong>{ad.authorName}</strong> (
                      {formatDateTimeBr(ad.createdAt)}): {ad.note}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addendumNote}
                  onChange={(e) => setAddendumNote(e.target.value)}
                  placeholder="Registrar novo evento complementar pós-entrega sem editar o ocorrido..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-[#172B3A]"
                />
                <button
                  type="button"
                  disabled={actionLoading || addendumNote.trim().length < 5}
                  onClick={async () => {
                    const ok = await callDealApi(
                      {
                        action: "POST_DELIVERY_ADDENDUM",
                        dealId: deal.id,
                        note: addendumNote,
                      },
                      "Evento complementar pós-entrega registrado.",
                    );
                    if (ok) setAddendumNote("");
                  }}
                  className="rounded-lg bg-[#0B3B70] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  Registrar Novo Evento
                </button>
              </div>
            </div>
          )}

          {/* Registros Formais de Aprovação e Autorizações */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#172B3A]">
              Registros Formais de Aprovação e Evidências (
              {passport.approvals.length})
            </h3>
            {passport.approvals.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhuma aprovação formal registrada até o momento.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
                {passport.approvals.map((ap) => (
                  <div
                    key={ap.id}
                    className={`p-3.5 flex flex-wrap items-start justify-between gap-3 ${
                      ap.status === "OUTDATED" ? "bg-amber-50/60" : "bg-white"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-[#172B3A] flex items-center gap-2">
                        <span>
                          {ap.taskCode} — Decisão: {ap.decision}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            ap.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-red-100 text-red-900"
                          }`}
                        >
                          {ap.status === "ACTIVE"
                            ? "VÁLIDA"
                            : `DESATUALIZADA (${ap.invalidationReason})`}
                        </span>
                      </div>
                      <p className="text-slate-700">
                        Justificativa: {ap.justification}
                      </p>
                      <div className="text-[11px] text-slate-500">
                        Autor: <strong>{ap.authorName}</strong> (Função:{" "}
                        {ROLE_LABELS[ap.roleUsed]}) • Versão dos dados
                        analisados: v{ap.analyzedDataVersion} • Em{" "}
                        {formatDateTimeBr(ap.createdAt)}
                      </div>
                      {ap.evidenceRefs.length > 0 && (
                        <div className="text-[11px] text-[#0B3B70] font-medium">
                          Evidências vinculadas:{" "}
                          {ap.evidenceRefs
                            .map(
                              (e) => `${e.documentTitle} (v${e.versionNumber})`,
                            )
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 4: HISTÓRICO E AUDITORIA IMUTÁVEL */}
      {activeTab === "HISTORY" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#172B3A]">
                Trilha de Auditoria Imutável da Negociação (
                {passport.auditEvents.length})
              </h2>
              <p className="text-xs text-slate-500">
                Eventos de auditoria não podem ser editados nem removidos por
                usuários comuns.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
            {passport.auditEvents.map((ev) => (
              <div key={ev.id} className="p-3.5 hover:bg-[#F4F7FA] space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-[#172B3A] flex items-center gap-2">
                    <span className="font-mono text-[11px] bg-[#EAF3FC] text-[#0B3B70] px-2 py-0.5 rounded">
                      {ev.action}
                    </span>
                    <span>
                      {ev.actorName} ({ev.actorRole})
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {formatDateTimeBr(ev.createdAt)}
                  </span>
                </div>
                <p className="text-slate-700">{ev.summary}</p>
                <div className="text-[10px] text-slate-400">
                  Visível na Área do Cliente:{" "}
                  {ev.isCustomerVisible
                    ? "Sim (Compartilhável)"
                    : "Não (Restrito à equipe interna)"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 5: ASSISTENTE CONTEXTUAL */}
      {activeTab === "ASSISTANT" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#1684D8] flex items-center justify-center text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-[#172B3A]">
                    Assistente Contextual da Negociação
                  </h2>
                  <span className="rounded bg-[#EAF3FC] border border-[#1684D8]/30 px-2 py-0.5 text-[10px] font-bold text-[#0B3B70]">
                    Assistente de Consulta Determinístico (Sem provedor de IA
                    externo)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Explica procedimentos publicados e analisa pendências, mas
                  nunca aprova etapas nem executa alterações.
                </p>
              </div>
            </div>
          </div>

          {/* Perguntas Sugeridas */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#172B3A] block">
              Perguntas rápidas sobre este passaporte:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                "O que falta para entregar este carro?",
                "Quem precisa agir agora?",
                "Por que este documento foi solicitado?",
                "O que posso adiantar?",
                "Qual foi a última atualização?",
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setAssistantQuestion(q);
                    askAssistant(q);
                  }}
                  className="rounded-xl border border-slate-300 bg-[#F4F7FA] hover:bg-[#EAF3FC] hover:border-[#1684D8] px-3 py-2 text-xs font-semibold text-[#172B3A] transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Campo de Pergunta Livre */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              askAssistant(assistantQuestion);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={assistantQuestion}
              onChange={(e) => setAssistantQuestion(e.target.value)}
              placeholder="Pergunte sobre pendências, documentos, responsáveis ou procedimentos desta negociação..."
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-xs sm:text-sm text-[#172B3A]"
            />
            <button
              type="submit"
              disabled={assistantLoading || !assistantQuestion.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-5 py-2.5 text-xs font-bold text-white transition"
            >
              <Send className="h-4 w-4" />
              <span>{assistantLoading ? "Consultando..." : "Perguntar"}</span>
            </button>
          </form>

          {/* Resposta do Assistente */}
          {assistantReply && (
            <div className="rounded-2xl bg-[#F4F7FA] border border-slate-200 p-5 space-y-4 text-xs sm:text-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs text-slate-500">
                <span className="font-bold text-[#172B3A] flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-[#1684D8]" />
                  <span>Pergunta: &ldquo;{assistantReply.question}&rdquo;</span>
                </span>
                <span>{assistantReply.modeLabel}</span>
              </div>

              <div className="whitespace-pre-line text-[#172B3A] leading-relaxed">
                {assistantReply.answerMarkdown}
              </div>

              {assistantReply.citations.length > 0 && (
                <div className="pt-3 border-t border-slate-200 space-y-1.5">
                  <div className="text-xs font-bold text-[#172B3A]">
                    Referências de Procedimentos Publicados pela Organização:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {assistantReply.citations.map((cit, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAF3FC] border border-[#1684D8]/30 px-2.5 py-1 text-xs font-semibold text-[#0B3B70]"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-[#1684D8]" />
                        <span>
                          {cit.procedureTitle} (v{cit.versionNumber} • Seção{" "}
                          {cit.sectionNumber}: {cit.sectionHeading})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                {assistantReply.disclaimer}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
