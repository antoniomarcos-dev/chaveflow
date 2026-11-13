"use client";

import type { DealPassportView } from "@/application/deal-service";
import type { AssistantResponse } from "@/domain/contextual-assistant";
import { AREA_COMPATIBLE_ROLES } from "@/domain/permissions";
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
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  HelpCircle,
  History,
  KeyRound,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CustomerAccessButton } from "./CustomerAccessButton";
import {
  DealStatusBadge,
  DocumentStatusBadge,
  TaskStateBadge,
} from "./StatusBadge";

type PassportTab = "TASKS" | "DOCUMENTS" | "SALE_DATA" | "HISTORY";
type TaskFilter = "EXECUTABLE" | "FUTURE" | "COMPLETED" | "WAIVED" | "ALL";

const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  IDENTIFICATION: "Identificação e Endereço",
  FINANCIAL: "Financeiro",
  TRADE_IN: "Usado na Troca",
  REPRESENTATION: "Procuração / Representação",
  BILLING: "Faturamento",
  DELIVERY: "Entrega",
  COMPLEMENTARY: "Complementar",
};

const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  DOCUMENT: "Documento aprovado",
  FORMAL_APPROVAL: "Aprovação formal registrada",
  INVOICE_NUMBER: "Número da Nota Fiscal",
  VIN_CONFIRMATION: "Reconfirmação do chassi ou código interno",
  SYSTEM_RECORD: "Registro operacional no sistema",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
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
  CUSTOMER_DOCUMENT_UPLOADED: "Documento enviado pelo portal do cliente",
};

function formatHumanRuleDescription(desc?: string) {
  if (!desc) return "";
  return desc
    .replace(/paymentMethod\s*!==?\s*'FINANCING'/g, "Pagamento sem financiamento")
    .replace(/hasFinancing\s*===\s*false/g, "Negociação sem financiamento bancário")
    .replace(/hasTradeIn\s*===\s*false/g, "Negociação sem veículo usado na troca")
    .replace(/hasPowerOfAttorney\s*===\s*false/g, "Negociação sem uso de procuração")
    .replace(/buyerType\s*===\s*'PF'/g, "Comprador Pessoa Física")
    .replace(/buyerType\s*===\s*'PJ'/g, "Comprador Pessoa Jurídica");
}

export function DealPassportClient({
  passport,
  userRoles,
  userPermissions,
  internalStaffList,
  initialTab = "TASKS",
  initialTaskCode,
  initialDocId,
  backHref = "/app/negociacoes",
}: {
  passport: DealPassportView;
  userRoles: RoleCode[];
  userPermissions: PermissionCode[];
  internalStaffList: Array<{ id: string; fullName: string; roles: RoleCode[] }>;
  initialTab?: PassportTab;
  initialTaskCode?: string;
  initialDocId?: string;
  backHref?: string;
}) {
  const router = useRouter();
  const {
    deal,
    vehicle,
    tradeInVehicle,
    customer,
    seller,
    summary,
    userNextAction,
  } = passport;

  const taskTitleByCode = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of passport.tasks) {
      map[t.code] = t.title;
    }
    return map;
  }, [passport.tasks]);

  // Se initialTaskCode apontar para uma tarefa que não está em EXECUTABLE, ajusta o filtro inicial
  const initialTaskFilter = useMemo<TaskFilter>(() => {
    if (initialTaskCode) {
      const target = passport.tasks.find((t) => t.code === initialTaskCode);
      if (target) {
        if (target.state === "WAITING_PREREQUISITE") return "FUTURE";
        if (target.state === "COMPLETED") return "COMPLETED";
        if (target.state === "WAIVED_BY_RULE") return "WAIVED";
      }
    }
    const hasExecutable = passport.tasks.some((t) =>
      ["AVAILABLE", "IN_PROGRESS", "IN_REVIEW", "WAITING_INFO", "BLOCKED"].includes(
        t.state,
      ),
    );
    return hasExecutable ? "EXECUTABLE" : "ALL";
  }, [initialTaskCode, passport.tasks]);

  const [activeTab, setActiveTab] = useState<PassportTab>(initialTab);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>(initialTaskFilter);
  const [highlightedTaskCode, setHighlightedTaskCode] = useState<string | null>(
    initialTaskCode || null,
  );
  const [highlightedDocId, setHighlightedDocId] = useState<string | null>(
    initialDocId || null,
  );

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

  // Estado para Revisão de Documento (Orientação pública vs Observação interna)
  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);
  const [customerRejectionGuidance, setCustomerRejectionGuidance] =
    useState("");
  const [internalReviewNotes, setInternalReviewNotes] = useState("");

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

  // Estado da Orientação Contextual discreta
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantReply, setAssistantReply] =
    useState<AssistantResponse | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);

  const hasPerm = (perm: PermissionCode) =>
    userRoles.includes("ADMIN") || userPermissions.includes(perm);

  const canReviewDoc = (docArea: ResponsibleArea) => {
    if (userRoles.includes("ADMIN")) return true;
    if (docArea === "FINANCE") {
      return (
        userRoles.includes("FINANCE") ||
        userRoles.includes("MANAGER") ||
        userPermissions.includes("approval:finance")
      );
    }
    return userPermissions.includes("document:review");
  };

  function navigateToBlockerItem(blocker: DealBlocker) {
    if (blocker.sourceType === "DOCUMENT") {
      const docId = blocker.id.replace(/^blocker-doc-/, "");
      setActiveTab("DOCUMENTS");
      setHighlightedDocId(docId);
      return;
    }
    if (blocker.sourceType === "AUTHORIZATION") {
      setActiveTab("SALE_DATA");
      return;
    }
    // Tarefa ou aprovação vinculada a tarefa
    const code = blocker.id
      .replace(/^blocker-task-/, "")
      .replace(/^blocker-approval-/, "");
    if (
      code === "TASK_BILLING_INVOICE" ||
      code === "TASK_RELEASE_AUTH" ||
      code === "TASK_CONFIRM_DELIVERY"
    ) {
      setActiveTab("SALE_DATA");
      return;
    }
    const targetTask = passport.tasks.find((t) => t.code === code);
    if (targetTask) {
      if (targetTask.state === "WAITING_PREREQUISITE") {
        setTaskFilter("FUTURE");
      } else if (targetTask.state === "COMPLETED") {
        setTaskFilter("COMPLETED");
      } else {
        setTaskFilter("EXECUTABLE");
      }
      setHighlightedTaskCode(code);
      setActiveTab("TASKS");
    }
  }

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
          title: "Não foi possível concluir a ação",
          message: data.error || "Verifique os dados informados e tente novamente.",
          blockers: data.blockers,
        });
        router.refresh();
        return false;
      }
      setFeedbackBanner({
        type: "SUCCESS",
        title: "Ação registrada",
        message: successMsg,
      });
      router.refresh();
      return true;
    } catch {
      setFeedbackBanner({ type: "ERROR", title: "Falha de conexão", message: "Não foi possível concluir a ação. Seus dados foram mantidos. Verifique sua conexão e tente novamente." });
      return false;
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRealFileUpload(docId: string) {
    if (!selectedFile) return;
    setFeedbackBanner(null);
    setActionLoading(true);
    try {
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
          title: "Arquivo recusado na validação",
          message:
            data.error ||
            "Não foi possível validar o arquivo enviado. Confira o formato e o tamanho.",
        });
        return;
      }
      setUploadingDocId(null);
      setSelectedFile(null);
      setUploadNotes("");
      setReplacementReason("");
      setFeedbackBanner({
        type: "SUCCESS",
        title: "Documento enviado",
        message:
          data.invalidatedApprovalsCount > 0
            ? `Versão v${data.version.versionNumber} registrada. Como o documento anterior já estava aprovado, ${data.invalidatedApprovalsCount} aprovação(ões) dependente(s) foram reabertas para nova conferência.`
            : `Versão v${data.version.versionNumber} enviada e disponibilizada para conferência.`,
      });
      router.refresh();
    } catch (error) {
      setFeedbackBanner({
        type: "ERROR",
        title: "Falha no envio",
        message:
          error instanceof Error
            ? error.message
            : "Falha de conexão ao enviar o arquivo.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function askAssistant(q: string) {
    if (!q.trim()) return;
    setAssistantLoading(true);
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
      } else throw new Error(data.error || "Não foi possível consultar o assistente.");
    } catch {
      setFeedbackBanner({ type: "ERROR", title: "Consulta indisponível", message: "Não foi possível consultar as orientações. Verifique sua conexão e tente novamente." });
    } finally {
      setAssistantLoading(false);
    }
  }

  // Separa os impedimentos atuais (executáveis agora) das etapas futuras (aguardando etapa anterior)
  const { currentBlockers, futureStageBlockers } = useMemo(() => {
    const current: DealBlocker[] = [];
    const future: DealBlocker[] = [];

    for (const b of summary.deliveryBlockers) {
      if (b.sourceType === "TASK") {
        const code = b.id.replace(/^blocker-task-/, "");
        const task = passport.tasks.find((t) => t.code === code);
        if (task && task.state === "WAITING_PREREQUISITE") {
          future.push(b);
          continue;
        }
      }
      if (b.sourceType === "AUTHORIZATION" && !summary.deliveryEligible) {
        future.push(b);
        continue;
      }
      current.push(b);
    }
    return { currentBlockers: current, futureStageBlockers: future };
  }, [summary.deliveryBlockers, summary.deliveryEligible, passport.tasks]);

  // Tarefas por filtro
  const taskCounts = useMemo(() => {
    const executable = passport.tasks.filter((t) =>
      ["AVAILABLE", "IN_PROGRESS", "IN_REVIEW", "WAITING_INFO"].includes(
        t.state,
      ),
    ).length;
    const future = passport.tasks.filter(
      (t) => t.state === "WAITING_PREREQUISITE",
    ).length;
    const completed = passport.tasks.filter(
      (t) => t.state === "COMPLETED",
    ).length;
    const waived = passport.tasks.filter(
      (t) => t.state === "WAIVED_BY_RULE",
    ).length;
    return {
      executable,
      future,
      completed,
      waived,
      all: passport.tasks.length,
    };
  }, [passport.tasks]);

  const filteredTasks = useMemo(() => {
    return passport.tasks.filter((t) => {
      if (taskFilter === "EXECUTABLE") {
        return [
          "AVAILABLE",
          "IN_PROGRESS",
          "IN_REVIEW",
          "WAITING_INFO",
          "BLOCKED",
        ].includes(t.state);
      }
      if (taskFilter === "FUTURE") return t.state === "WAITING_PREREQUISITE";
      if (taskFilter === "COMPLETED") return t.state === "COMPLETED";
      if (taskFilter === "WAIVED") return t.state === "WAIVED_BY_RULE";
      return true;
    });
  }, [passport.tasks, taskFilter]);

  return (
    <div className="space-y-5">
      {/* A. RESUMO COMPACTO */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F4F7FA] hover:bg-[#EAF3FC] px-2.5 py-1.5 text-xs font-bold text-[#0B3B70] transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Voltar</span>
            </Link>
            <span className="rounded-lg bg-[#0B3B70] px-2.5 py-1 font-mono text-xs font-extrabold text-white">
              {deal.dealNumber}
            </span>
            <DealStatusBadge status={deal.status} />
            <span className="text-xs text-slate-500 hidden sm:inline">
              Atualizado em {formatDateTimeBr(deal.updatedAt)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(userRoles.includes("ADMIN") ||
              userRoles.includes("MANAGER") ||
              userRoles.includes("SELLER")) &&
              deal.status !== "DRAFT" && (
                <CustomerAccessButton
                  dealId={deal.id}
                  compact
                  isAccountActive={Boolean(customer.profileId)}
                />
              )}
            {passport.customerAccessToken && (
              <Link
                href={`/cliente?token=${encodeURIComponent(
                  passport.customerAccessToken,
                )}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-[#172B3A] transition"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[#1684D8]" />
                <span>Portal do Cliente</span>
              </Link>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center">
          {/* Veículo */}
          <div className="lg:col-span-6 flex items-center gap-3.5">
            <img
              src={vehicle.photos[0] || "/vehicle-placeholder.svg"}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="w-20 h-16 sm:w-28 sm:h-20 rounded-xl border border-slate-200 object-cover bg-slate-900 shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-bold bg-[#EAF3FC] text-[#0B3B70] px-2 py-0.5 rounded">
                  {vehicle.internalCode}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Chassi: {vehicle.vin}
                </span>
                <Link
                  href={`/app/veiculos/${vehicle.id}`}
                  className="text-xs text-[#1684D8] font-bold hover:underline"
                >
                  Ver veículo →
                </Link>
              </div>
              <h1 className="text-base sm:text-lg font-extrabold text-[#172B3A] truncate">
                {vehicle.brand} {vehicle.model} — {vehicle.trim}
              </h1>
              <p className="text-xs text-slate-600">
                {vehicle.manufacturingYear}/{vehicle.modelYear} •{" "}
                <strong className="text-[#172B3A]">{vehicle.color}</strong>
              </p>
            </div>
          </div>

          {/* Comprador */}
          <div className="lg:col-span-3 rounded-xl bg-[#F4F7FA] border border-slate-200 p-3 text-xs space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Comprador ({deal.buyerType})
            </span>
            <div className="font-extrabold text-sm text-[#172B3A] truncate">
              {customer.fullName}
            </div>
            <div className="text-slate-600 font-mono text-[11px]">
              {customer.documentNumber}
              {customer.phone ? ` • ${customer.phone}` : ""}
            </div>
          </div>

          {/* Vendedor e Condição */}
          <div className="lg:col-span-3 rounded-xl bg-[#F4F7FA] border border-slate-200 p-3 text-xs space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Responsável Comercial
            </span>
            <div className="font-extrabold text-sm text-[#172B3A] truncate">
              {seller.fullName}
            </div>
            <div className="text-slate-600 text-[11px] truncate">
              {deal.paymentMethod === "FINANCING"
                ? `Financiamento (${deal.financingInstitution || "Banco"})`
                : deal.paymentMethod === "CASH"
                  ? "À Vista (PIX/TED)"
                  : deal.paymentMethod === "CONSORTIUM"
                    ? "Consórcio"
                    : "Pagamento Misto"}
              {deal.hasTradeIn ? " • Com troca" : ""}
            </div>
          </div>
        </div>
      </section>

      {/* Banner de Feedback */}
      {feedbackBanner && (
        <div
          role="alert"
          className={`rounded-2xl border-2 p-4 shadow-xs space-y-2.5 ${
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
            <div className="pt-2 border-t border-red-200 space-y-1.5">
              <div className="text-xs font-bold text-red-900">
                Pendências que impedem esta ação:
              </div>
              <ul className="space-y-1 text-xs">
                {feedbackBanner.blockers.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-lg bg-white border border-red-200 p-2 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-red-950">{b.title}</span>{" "}
                      <span className="text-slate-600">({b.reason})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFeedbackBanner(null);
                        navigateToBlockerItem(b);
                      }}
                      className="text-xs font-bold text-[#1684D8] hover:underline"
                    >
                      Abrir item →
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* B. PRÓXIMA AÇÃO */}
      <section
        className={`rounded-2xl border-2 p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 ${
          userNextAction.hasDirectAction
            ? "bg-[#0B3B70] text-white border-[#1684D8]"
            : "bg-white text-[#172B3A] border-slate-200"
        }`}
      >
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                userNextAction.hasDirectAction
                  ? "bg-[#1684D8] text-white"
                  : "bg-[#EAF3FC] text-[#0B3B70]"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Próxima ação</span>
            </span>
            <span
              className={`text-xs font-semibold ${
                userNextAction.hasDirectAction
                  ? "text-[#EAF3FC]"
                  : "text-slate-600"
              }`}
            >
              Quem faz: <strong>{userNextAction.responsibleAreaLabel}</strong>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-extrabold">
            {userNextAction.headline}
          </h2>
          <p
            className={`text-xs sm:text-sm ${
              userNextAction.hasDirectAction
                ? "text-[#EAF3FC]/90"
                : "text-slate-600"
            }`}
          >
            {userNextAction.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {userNextAction.actionType === "UPLOAD_DOCUMENT" &&
            userNextAction.targetDocumentId && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("DOCUMENTS");
                  setHighlightedDocId(userNextAction.targetDocumentId!);
                  setUploadingDocId(userNextAction.targetDocumentId!);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
              >
                <Upload className="h-4 w-4" />
                <span>Enviar documento agora</span>
              </button>
            )}

          {userNextAction.actionType === "REVIEW_DOCUMENT" &&
            userNextAction.targetDocumentId && (
              <>
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
                        justification: "Documento conferido e aprovado.",
                      },
                      "Documento conferido e aprovado com sucesso!",
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
                >
                  <FileCheck2 className="h-4 w-4" />
                  <span>Aprovar documento</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("DOCUMENTS");
                    setHighlightedDocId(userNextAction.targetDocumentId!);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 hover:bg-white/20 px-3.5 py-2.5 text-xs font-bold text-white transition"
                >
                  <span>Abrir para conferir</span>
                </button>
              </>
            )}

          {userNextAction.actionType === "APPROVE_TASK" &&
            userNextAction.targetTaskCode && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("TASKS");
                  setTaskFilter("EXECUTABLE");
                  setHighlightedTaskCode(userNextAction.targetTaskCode!);
                  setApprovingTaskCode(userNextAction.targetTaskCode!);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
              >
                <ClipboardCheck className="h-4 w-4" />
                <span>Analisar e registrar aprovação</span>
              </button>
            )}

          {userNextAction.actionType === "EXECUTE_TASK" &&
            userNextAction.targetTaskCode && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("TASKS");
                  setTaskFilter("EXECUTABLE");
                  setHighlightedTaskCode(userNextAction.targetTaskCode!);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
              >
                <ClipboardCheck className="h-4 w-4" />
                <span>Abrir atividade para concluir</span>
              </button>
            )}

          {userNextAction.actionType === "REGISTER_BILLING" && (
            <button
              type="button"
              onClick={() => setActiveTab("SALE_DATA")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white transition"
            >
              <span>Registrar Nota Fiscal →</span>
            </button>
          )}

          {userNextAction.actionType === "AUTHORIZE_RELEASE" && (
            <button
              type="button"
              onClick={() => setActiveTab("SALE_DATA")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white transition"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Autorizar liberação para entrega →</span>
            </button>
          )}

          {userNextAction.actionType === "CONFIRM_DELIVERY" && (
            <button
              type="button"
              onClick={() => setActiveTab("SALE_DATA")}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white transition"
            >
              <KeyRound className="h-4 w-4" />
              <span>Reconfirmar chassi e entregar →</span>
            </button>
          )}

          {!userNextAction.hasDirectAction && deal.status !== "DELIVERED" && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("TASKS");
                setTaskFilter("EXECUTABLE");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-[#F4F7FA] hover:bg-[#EAF3FC] px-3.5 py-2 text-xs font-bold text-[#0B3B70] transition"
            >
              <span>Ver atividades em andamento</span>
            </button>
          )}
        </div>
      </section>

      {/* C. TRILHA DAS ETAPAS + RESUMO RECOLHIDO DE IMPEDIMENTOS */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#0B3B70]">
              Trilha das etapas ({summary.completedApplicableTasksCount} de{" "}
              {summary.applicableTasksCount} atividades aplicáveis concluídas)
            </h2>
          </div>
          <span className="text-xs font-bold text-[#0B3B70] bg-[#EAF3FC] border border-[#1684D8]/30 px-2.5 py-0.5 rounded-full">
            {summary.progressPercentage}% concluído
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
            const hasStageImpediment = stageTasks.some(
              (t) =>
                t.state === "WAITING_PREREQUISITE" ||
                t.state === "WAITING_INFO" ||
                t.approvalStatus === "REJECTED" ||
                t.approvalStatus === "OUTDATED" ||
                passport.documents.some(
                  (d) =>
                    d.taskCode === t.code &&
                    (d.status === "REJECTED" ||
                      d.status === "CORRECTION_REQUESTED"),
                ),
            );
            const isCurrent =
              summary.currentStage === st.code && deal.status !== "DELIVERED";

            const stageStateLabel =
              allDone || deal.status === "DELIVERED"
                ? "Concluída"
                : hasStageImpediment
                  ? "Com impedimento"
                  : isCurrent
                    ? "Atual"
                    : "Futura";

            return (
              <div
                key={st.code}
                className={`rounded-xl border p-2.5 text-xs transition ${
                  allDone || deal.status === "DELIVERED"
                    ? "bg-emerald-50/90 border-emerald-300 text-emerald-950"
                    : hasStageImpediment
                      ? "bg-red-50 border-red-300 text-red-950"
                      : isCurrent
                        ? "bg-[#EAF3FC] border-[#1684D8] text-[#0B3B70] ring-2 ring-[#1684D8]/20"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                      allDone || deal.status === "DELIVERED"
                        ? "bg-emerald-600 text-white"
                        : hasStageImpediment
                          ? "bg-red-600 text-white"
                          : isCurrent
                            ? "bg-[#1684D8] text-white"
                            : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {allDone || deal.status === "DELIVERED" ? "✓" : st.order}
                  </span>
                  <span className="text-[10px] font-semibold">
                    {stageStateLabel}
                  </span>
                </div>
                <div className="font-bold mt-1.5 leading-tight">{st.name}</div>
              </div>
            );
          })}
        </div>

        {/* Lista de Impedimentos Recolhida */}
        {deal.status !== "DELIVERED" && (
          <div className="pt-2 border-t border-slate-100">
            {summary.deliveryBlockers.length === 0 ? (
              <div className="flex items-center justify-between gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 font-semibold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    Todos os requisitos obrigatórios foram cumpridos. Nenhum
                    impedimento ativo.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("SALE_DATA")}
                  className="text-[#0B3B70] font-bold hover:underline"
                >
                  Ir para liberação / entrega →
                </button>
              </div>
            ) : (
              <details className="group rounded-xl border border-slate-200 bg-[#F4F7FA]">
                <summary className="cursor-pointer px-4 py-2.5 text-xs font-bold text-[#172B3A] flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      O que falta para concluir:{" "}
                      <strong>
                        {currentBlockers.length} pendência(s) atual(is)
                      </strong>
                      {futureStageBlockers.length > 0
                        ? ` e ${futureStageBlockers.length} etapa(s) futura(s)`
                        : ""}
                    </span>
                  </span>
                  <span className="text-[#1684D8] group-open:underline">
                    Ver detalhes e abrir itens
                  </span>
                </summary>
                <div className="px-4 pb-4 pt-2 border-t border-slate-200 space-y-3 text-xs">
                  {currentBlockers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-bold text-[#0B3B70]">
                        Pendências atuais (podem ser resolvidas agora):
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {currentBlockers.map((b) => (
                          <div
                            key={b.id}
                            className="rounded-xl bg-white border border-amber-200 p-3 flex flex-col justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-[#172B3A]">
                                  {b.title}
                                </span>
                                <span className="rounded bg-[#EAF3FC] px-2 py-0.5 text-[10px] font-bold text-[#0B3B70]">
                                  {b.responsibleAreaLabel}
                                </span>
                              </div>
                              <p className="text-slate-600 mt-1">{b.reason}</p>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <span className="text-[11px] text-slate-500">
                                {b.actionRequired}
                              </span>
                              <button
                                type="button"
                                onClick={() => navigateToBlockerItem(b)}
                                className="inline-flex items-center gap-1 font-bold text-[#1684D8] hover:underline shrink-0"
                              >
                                <span>Abrir</span>
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {futureStageBlockers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-bold text-slate-600">
                        Etapas futuras (aguardam conclusão das pendências
                        atuais):
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {futureStageBlockers.map((b) => (
                          <div
                            key={b.id}
                            className="rounded-xl bg-white/70 border border-slate-200 p-2.5 flex items-center justify-between gap-2 text-slate-600"
                          >
                            <div>
                              <span className="font-semibold text-[#172B3A]">
                                {b.title}
                              </span>{" "}
                              <span className="text-[11px]">
                                ({b.responsibleAreaLabel})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigateToBlockerItem(b)}
                              className="text-[11px] font-bold text-[#0B3B70] hover:underline shrink-0"
                            >
                              Ver etapa
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        )}
      </section>

      {/* D. ABAS DO PASSAPORTE DIGITAL */}
      <div
        role="tablist"
        aria-label="Seções do Passaporte Digital"
        className="border-b border-slate-200 flex flex-wrap gap-1.5"
      >
        {[
          {
            id: "TASKS" as const,
            label: `Atividades (${taskCounts.executable} ativas)`,
            Icon: ClipboardCheck,
          },
          {
            id: "DOCUMENTS" as const,
            label: `Documentos (${passport.documents.length})`,
            Icon: FileText,
          },
          {
            id: "SALE_DATA" as const,
            label: "Dados da venda e liberação",
            Icon: KeyRound,
          },
          {
            id: "HISTORY" as const,
            label: `Histórico (${passport.auditEvents.length})`,
            Icon: History,
          },
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

      {/* ABA 1: ATIVIDADES */}
      {activeTab === "TASKS" && (
        <div className="space-y-4">
          {/* Filtros de Atividades */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                {
                  id: "EXECUTABLE" as const,
                  label: `Executáveis agora (${taskCounts.executable})`,
                },
                {
                  id: "FUTURE" as const,
                  label: `Futuras (${taskCounts.future})`,
                },
                {
                  id: "COMPLETED" as const,
                  label: `Concluídas (${taskCounts.completed})`,
                },
                {
                  id: "WAIVED" as const,
                  label: `Dispensadas (${taskCounts.waived})`,
                },
                {
                  id: "ALL" as const,
                  label: `Todas (${taskCounts.all})`,
                },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTaskFilter(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    taskFilter === f.id
                      ? "bg-[#0B3B70] text-white"
                      : "bg-[#F4F7FA] text-slate-700 hover:bg-[#EAF3FC] hover:text-[#0B3B70]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Ajuda contextual discreta */}
            <details className="relative">
              <summary className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F4F7FA] hover:bg-[#EAF3FC] px-3 py-1.5 text-xs font-bold text-[#0B3B70]">
                <HelpCircle className="h-3.5 w-3.5 text-[#1684D8]" />
                <span>Tirar dúvida sobre procedimentos</span>
              </summary>
              <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg space-y-3 text-xs sm:w-96 lg:w-[28rem] z-20">
                <div className="font-bold text-[#172B3A]">
                  Consulta rápida aos procedimentos da concessionária
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "O que falta para entregar este carro?",
                    "Quem precisa agir agora?",
                    "O que posso adiantar?",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setAssistantQuestion(q);
                        askAssistant(q);
                      }}
                      className="rounded-lg border border-slate-200 bg-[#F4F7FA] hover:bg-[#EAF3FC] px-2.5 py-1 text-[11px] font-semibold text-[#0B3B70]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    askAssistant(assistantQuestion);
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    value={assistantQuestion}
                    onChange={(e) => setAssistantQuestion(e.target.value)}
                    placeholder="Digite sua dúvida sobre esta negociação..."
                    className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-[#172B3A]"
                  />
                  <button
                    type="submit"
                    disabled={assistantLoading || !assistantQuestion.trim()}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#1684D8] px-3 py-1.5 text-xs font-bold text-white"
                  >
                    <Send className="h-3 w-3" />
                    <span>{assistantLoading ? "..." : "Consultar"}</span>
                  </button>
                </form>
                {assistantReply && (
                  <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3 space-y-2">
                    <div className="whitespace-pre-line text-[#172B3A] leading-relaxed">
                      {assistantReply.answerMarkdown}
                    </div>
                    {assistantReply.citations.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
                        {assistantReply.citations.map((cit, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded bg-[#EAF3FC] px-2 py-0.5 text-[10px] font-semibold text-[#0B3B70]"
                          >
                            <BookOpen className="h-3 w-3 text-[#1684D8]" />
                            <span>
                              {cit.procedureTitle} (Seção {cit.sectionNumber})
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </details>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-2">
              <p className="text-sm font-bold text-[#172B3A]">
                Nenhuma atividade neste filtro.
              </p>
              <button
                type="button"
                onClick={() => setTaskFilter("ALL")}
                className="text-xs font-bold text-[#1684D8] hover:underline"
              >
                Mostrar todas as atividades ({taskCounts.all})
              </button>
            </div>
          ) : (
            filteredTasks.map((t) => {
              const linkedDocs = passport.documents.filter(
                (d) => d.taskCode === t.code,
              );
              const compatibleStaff = internalStaffList.filter((st) =>
                st.roles.some((r) =>
                  AREA_COMPATIBLE_ROLES[t.responsibleArea].includes(r),
                ),
              );
              const isHighlighted = highlightedTaskCode === t.code;

              return (
                <div
                  key={t.id}
                  className={`rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3 transition ${
                    isHighlighted
                      ? "bg-white border-2 border-[#1684D8] ring-2 ring-[#1684D8]/20"
                      : t.state === "WAIVED_BY_RULE"
                        ? "bg-slate-50 border-slate-200"
                        : "bg-white border-slate-200"
                  }`}
                >
                  {/* Linha Principal: Título, Responsável, Prazo e Estado */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[#EAF3FC] border border-[#1684D8]/30 px-2 py-0.5 text-[11px] font-bold text-[#0B3B70]">
                          {AREA_LABELS[t.responsibleArea]}
                        </span>
                        <span className="text-xs text-slate-600">
                          Responsável:{" "}
                          <strong className="text-[#172B3A]">
                            {t.assigneeName || AREA_LABELS[t.responsibleArea]}
                          </strong>
                        </span>
                        <span className="text-xs text-slate-500">
                          • Prazo:{" "}
                          <strong className="text-[#172B3A]">
                            {t.state === "WAITING_PREREQUISITE"
                              ? "Inicia após etapa anterior"
                              : t.dueAt
                                ? formatDateTimeBr(t.dueAt)
                                : "Não aplicável"}
                          </strong>
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-[#172B3A]">
                        {t.title}
                      </h3>
                      <p className="text-xs text-slate-600">{t.description}</p>
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

                  {/* Documentos vinculados a esta atividade */}
                  {linkedDocs.length > 0 && (
                    <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3 text-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-[#0B3B70]">
                          Documentos vinculados a esta atividade (aprovar todos
                          conclui a atividade automaticamente):
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {linkedDocs.map((ld) => (
                          <button
                            key={ld.id}
                            type="button"
                            onClick={() => {
                              setActiveTab("DOCUMENTS");
                              setHighlightedDocId(ld.id);
                            }}
                            className="inline-flex items-center gap-2 rounded-lg bg-white border border-slate-300 hover:border-[#1684D8] px-3 py-1.5 text-xs font-semibold text-[#172B3A] transition"
                          >
                            <span>{ld.title}</span>
                            <DocumentStatusBadge status={ld.status} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Motivo de dispensa ou pendência */}
                  {t.state === "WAIVED_BY_RULE" && t.waivedRuleDescription && (
                    <div className="rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-xs text-slate-700">
                      <strong>Motivo da dispensa:</strong>{" "}
                      {formatHumanRuleDescription(t.waivedRuleDescription)}
                    </div>
                  )}

                  {t.state !== "COMPLETED" &&
                    t.state !== "WAIVED_BY_RULE" &&
                    t.pendingReason && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-950">
                        <strong>Situação atual:</strong> {t.pendingReason}
                      </div>
                    )}

                  {/* Como fazer (Recolhido: finalidade, orientação, evidências, dependências e procedimento) */}
                  <details className="group rounded-xl border border-slate-200 bg-[#F4F7FA] text-xs">
                    <summary className="cursor-pointer px-3.5 py-2 font-bold text-[#0B3B70] flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-[#1684D8]" />
                        <span>Como fazer e requisitos desta atividade</span>
                      </span>
                      <span className="text-[11px] text-[#1684D8] group-open:underline">
                        Expandir orientações
                      </span>
                    </summary>
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-200 grid sm:grid-cols-2 gap-3 text-slate-700">
                      <div>
                        <strong className="text-[#172B3A] block">
                          Finalidade:
                        </strong>
                        <p className="mt-0.5">{t.whyRequired}</p>
                      </div>
                      <div>
                        <strong className="text-[#172B3A] block">
                          Passo a passo:
                        </strong>
                        <p className="mt-0.5">{t.guidance}</p>
                      </div>
                      <div>
                        <strong className="text-[#172B3A] block">
                          Evidências exigidas:
                        </strong>
                        <p className="mt-0.5">
                          {t.requiredEvidenceTypes.length > 0
                            ? t.requiredEvidenceTypes
                                .map((ev) => EVIDENCE_TYPE_LABELS[ev] || ev)
                                .join(", ")
                            : "Registro de conclusão no sistema"}
                        </p>
                      </div>
                      <div>
                        <strong className="text-[#172B3A] block">
                          Atividades anteriores necessárias:
                        </strong>
                        <p className="mt-0.5">
                          {t.dependsOnTaskCodes.length > 0
                            ? t.dependsOnTaskCodes
                                .map((code) => taskTitleByCode[code] || code)
                                .join(", ")
                            : "Nenhuma (disponível desde o início)"}
                        </p>
                      </div>
                      {t.publishedProcedure && (
                        <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                          <strong className="text-[#0B3B70] flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-[#1684D8]" />
                            <span>
                              Procedimento de referência:{" "}
                              {t.publishedProcedure.title} (v
                              {t.publishedProcedure.versionNumber})
                            </span>
                          </strong>
                          <p className="mt-0.5 text-slate-600">
                            {t.publishedProcedure.sections?.[0]?.body || "Procedimento publicado vinculado."}
                          </p>
                        </div>
                      )}
                    </div>
                  </details>

                  {/* Barra de Ação e Atribuição (apenas para tarefas abertas e quando a ação já está disponível) */}
                  {t.state !== "WAIVED_BY_RULE" &&
                    t.state !== "COMPLETED" &&
                    deal.status !== "DELIVERED" && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {t.state === "WAITING_PREREQUISITE" ? (
                            <span className="text-xs font-medium text-slate-500">
                              Esta atividade ficará disponível assim que as
                              etapas anteriores forem concluídas.
                            </span>
                          ) : (
                            <>
                              {t.code === "TASK_BILLING_INVOICE" ||
                              t.code === "TASK_RELEASE_AUTH" ||
                              t.code === "TASK_CONFIRM_DELIVERY" ? (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab("SALE_DATA")}
                                  className="rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-3.5 py-2 text-xs font-bold text-white transition"
                                >
                                  Abrir painel de execução →
                                </button>
                              ) : !t.requiresFormalApproval ? (
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() =>
                                    callDealApi(
                                      {
                                        action: "TASK_ACTION",
                                        dealId: deal.id,
                                        taskCode: t.code,
                                        taskAction: "COMPLETE_OPERATIONAL",
                                      },
                                      `Atividade '${t.title}' concluída.`,
                                    )
                                  }
                                  className="rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40 transition"
                                >
                                  Concluir atividade
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() =>
                                    setApprovingTaskCode(
                                      approvingTaskCode === t.code
                                        ? null
                                        : t.code,
                                    )
                                  }
                                  className="rounded-xl bg-[#0B3B70] hover:bg-[#1684D8] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40 transition"
                                >
                                  Registrar aprovação (
                                  {t.approvalRole
                                    ? ROLE_LABELS[t.approvalRole]
                                    : AREA_LABELS[t.responsibleArea]}
                                  )
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {hasPerm("task:assign") && (
                          <div className="flex items-center gap-2 text-xs">
                            <label
                              htmlFor={`assign-${t.id}`}
                              className="text-slate-600 font-medium"
                            >
                              Responsável:
                            </label>
                            <select
                              id={`assign-${t.id}`}
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
                              <option value="">
                                Definir colaborador ({AREA_LABELS[t.responsibleArea]})...
                              </option>
                              {compatibleStaff.map((st) => (
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
                        Decisão de conferência e aprovação — {t.title}
                      </div>
                      <textarea
                        rows={2}
                        value={approvalJustification}
                        onChange={(e) =>
                          setApprovalJustification(e.target.value)
                        }
                        placeholder="Informe o parecer da conferência..."
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
                                  "Conferido e aprovado com evidências validadas.",
                              },
                              `Atividade '${t.title}' aprovada!`,
                            );
                            if (ok) {
                              setApprovingTaskCode(null);
                              setApprovalJustification("");
                            }
                          }}
                          className="rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2 text-xs font-bold text-white"
                        >
                          Aprovar etapa
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
                          Solicitar correção
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ABA 2: DOCUMENTOS E CONFERÊNCIA */}
      {activeTab === "DOCUMENTS" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-600">
              Confira cada documento exigido, abra o arquivo atual ou envie uma
              nova versão quando necessário.
            </div>
            {hasPerm("document:request") &&
              deal.status !== "DELIVERED" &&
              deal.status !== "CANCELLED" && (
                <button
                  type="button"
                  onClick={() => setShowRequestDocModal((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-3.5 py-2 text-xs font-bold text-white shrink-0 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Solicitar documento adicional</span>
                </button>
              )}
          </div>

          {showRequestDocModal && (
            <div className="bg-white rounded-2xl border-2 border-[#1684D8] p-5 space-y-4">
              <h3 className="text-sm font-bold text-[#172B3A]">
                Solicitar documento adicional
              </h3>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block">
                    Nome do documento *
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
                    Área responsável pela conferência *
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
                    Motivo da solicitação *
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
                    <span>Exigido antes do faturamento</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={reqDocBlocksDelivery}
                      onChange={(e) =>
                        setReqDocBlocksDelivery(e.target.checked)
                      }
                    />
                    <span>Exigido antes da entrega</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={reqDocCustomerVisible}
                      onChange={(e) =>
                        setReqDocCustomerVisible(e.target.checked)
                      }
                    />
                    <span>Visível no Portal do Cliente</span>
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
                      `Documento '${reqDocTitle}' solicitado.`,
                    );
                    if (ok) {
                      setShowRequestDocModal(false);
                      setReqDocTitle("");
                      setReqDocWhy("");
                    }
                  }}
                  className="rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-4 py-1.5 text-xs font-bold text-white"
                >
                  Confirmar solicitação
                </button>
              </div>
            </div>
          )}

          {passport.documents.map((doc) => {
            const currentVer =
              doc.versions.find(
                (v) => v.versionNumber === doc.currentVersionNumber,
              ) || doc.versions[0];
            const linkedTaskTitle = doc.taskCode
              ? taskTitleByCode[doc.taskCode]
              : null;
            const isDocHighlighted = highlightedDocId === doc.id;

            return (
              <div
                key={doc.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs space-y-3.5 transition ${
                  isDocHighlighted
                    ? "border-2 border-[#1684D8] ring-2 ring-[#1684D8]/20"
                    : "border-slate-200"
                }`}
              >
                {/* Cabeçalho do Documento: Nome, Estado, Responsável */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold bg-[#EAF3FC] text-[#0B3B70] px-2 py-0.5 rounded">
                        {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                      </span>
                      <span className="text-xs text-slate-600">
                        Conferência:{" "}
                        <strong className="text-[#172B3A]">
                          {AREA_LABELS[doc.responsibleArea]}
                        </strong>
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-[#172B3A]">
                      {doc.title}
                    </h3>
                    <p className="text-xs text-slate-600">{doc.whyRequired}</p>
                    {linkedTaskTitle && (
                      <p className="text-[11px] font-semibold text-[#0B3B70]">
                        Vinculado à atividade «{linkedTaskTitle}» (concluída
                        automaticamente quando os documentos exigidos são
                        aprovados).
                      </p>
                    )}
                  </div>

                  <DocumentStatusBadge status={doc.status} />
                </div>

                {/* Orientação pública e Observação interna de conferência */}
                {(doc.customerRejectionGuidance || doc.rejectionReason) && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-950 space-y-1">
                    <div>
                      <strong>
                        Orientação para regularização (visível ao vendedor e
                        cliente):
                      </strong>{" "}
                      {doc.customerRejectionGuidance || doc.rejectionReason}
                    </div>
                    {doc.internalReviewNotes && (
                      <div className="pt-1 border-t border-red-200/80 text-red-900">
                        <strong>Observação interna da conferência:</strong>{" "}
                        {doc.internalReviewNotes}
                      </div>
                    )}
                  </div>
                )}

                {!doc.customerRejectionGuidance &&
                  !doc.rejectionReason &&
                  doc.internalReviewNotes && (
                    <div className="rounded-xl bg-slate-100 border border-slate-200 p-2.5 text-xs text-slate-700">
                      <strong>Observação interna da conferência:</strong>{" "}
                      {doc.internalReviewNotes}
                    </div>
                  )}

                {/* Arquivo Atual */}
                <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                  {currentVer ? (
                    <>
                      <div>
                        <span className="font-bold text-[#172B3A]">
                          Arquivo atual (v{currentVer.versionNumber}):{" "}
                          {currentVer.originalFilename}
                        </span>{" "}
                        <span className="text-slate-500">
                          ({Math.round(currentVer.sizeBytes / 1024 || 1)} KB •
                          Enviado por {currentVer.uploadedByName} em{" "}
                          {formatDateTimeBr(currentVer.createdAt)})
                        </span>
                        {currentVer.uploadNotes && (
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            Observação do envio: {currentVer.uploadNotes}
                          </div>
                        )}
                      </div>
                      <a
                        href={currentVer.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 text-xs font-bold text-[#0B3B70]"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-[#1684D8]" />
                        <span>Abrir arquivo</span>
                      </a>
                    </>
                  ) : (
                    <span className="text-slate-500 font-medium">
                      Nenhum arquivo enviado até o momento.
                    </span>
                  )}
                </div>

                {/* Histórico de Versões Recolhido */}
                {doc.versions.length > 1 && (
                  <details className="rounded-xl border border-slate-200 bg-white text-xs">
                    <summary className="cursor-pointer px-3.5 py-2 font-semibold text-slate-700 hover:text-[#0B3B70]">
                      Ver histórico de versões ({doc.versions.length} versões)
                    </summary>
                    <div className="divide-y divide-slate-200 border-t border-slate-200">
                      {doc.versions.map((ver) => (
                        <div
                          key={ver.id}
                          className="p-3 flex flex-wrap items-center justify-between gap-2"
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
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-2.5 py-1 text-xs font-bold text-[#0B3B70]"
                          >
                            <ExternalLink className="h-3 w-3 text-[#1684D8]" />
                            <span>Abrir v{ver.versionNumber}</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Botões de Ação do Documento */}
                {deal.status !== "DELIVERED" && deal.status !== "CANCELLED" && (
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
                              ? "Substituir documento aprovado"
                              : currentVer
                                ? "Enviar nova versão"
                                : "Enviar documento"}
                          </span>
                        </button>
                      )}
                    </div>

                    {canReviewDoc(doc.responsibleArea) &&
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
                              Aprovar documento
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setReviewingDocId(
                                reviewingDocId === doc.id ? null : doc.id,
                              );
                              setCustomerRejectionGuidance(
                                doc.customerRejectionGuidance ||
                                  doc.rejectionReason ||
                                  "",
                              );
                              setInternalReviewNotes(
                                doc.internalReviewNotes || "",
                              );
                            }}
                            className="rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 px-3 py-2 text-xs font-bold text-red-900"
                          >
                            Pedir correção ou rejeitar
                          </button>
                        </div>
                      )}
                  </div>
                )}

                {/* Painel Inline de Envio / Substituição */}
                {uploadingDocId === doc.id && (
                  <div className="rounded-xl bg-[#0B3B70] text-white p-4 space-y-3 text-xs">
                    <div className="font-bold text-[#EAF3FC]">
                      {doc.status === "APPROVED"
                        ? `Substituir documento aprovado — ${doc.title}`
                        : `Enviar arquivo — ${doc.title}`}
                    </div>
                    {doc.status === "APPROVED" && (
                      <div className="rounded-lg bg-amber-500/20 border border-amber-400/40 p-2.5 text-amber-100">
                        Ao substituir um documento já aprovado, a versão
                        anterior permanece no histórico e as aprovações que
                        dependem dele voltam para conferência.
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-[#EAF3FC]">
                          Arquivo (PDF, PNG, JPG, WEBP ou TXT — máx. 4 MB)
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
                            : "Observações do envio (opcional)"}
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
                        Confirmar envio
                      </button>
                    </div>
                  </div>
                )}

                {/* Painel Inline de Rejeição / Correção com separação entre orientação pública e nota interna */}
                {reviewingDocId === doc.id && (
                  <div className="rounded-xl bg-red-950 text-white p-4 space-y-3 text-xs">
                    <div className="font-bold text-red-200">
                      Registrar pedido de correção ou rejeição — {doc.title}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-red-100">
                          Orientação pública para o cliente ou vendedor *
                        </label>
                        <input
                          type="text"
                          value={customerRejectionGuidance}
                          onChange={(e) =>
                            setCustomerRejectionGuidance(e.target.value)
                          }
                          placeholder="Ex: Envie uma foto nítida frente e verso da CNH..."
                          className="mt-1 w-full rounded bg-red-900/60 border border-red-700 p-2 text-white placeholder:text-red-300/60"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-red-100">
                          Observação interna da conferência (apenas equipe)
                        </label>
                        <input
                          type="text"
                          value={internalReviewNotes}
                          onChange={(e) =>
                            setInternalReviewNotes(e.target.value)
                          }
                          placeholder="Ex: Divergência de CEP com a proposta inicial..."
                          className="mt-1 w-full rounded bg-red-900/60 border border-red-700 p-2 text-white placeholder:text-red-300/60"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          actionLoading ||
                          customerRejectionGuidance.trim().length < 5
                        }
                        onClick={async () => {
                          const ok = await callDealApi(
                            {
                              action: "REVIEW_DOCUMENT",
                              dealId: deal.id,
                              documentId: doc.id,
                              decision: "CORRECTION_REQUESTED",
                              justification: customerRejectionGuidance,
                              customerRejectionGuidance,
                              internalReviewNotes,
                            },
                            "Pedido de correção registrado.",
                          );
                          if (ok) {
                            setReviewingDocId(null);
                            setCustomerRejectionGuidance("");
                            setInternalReviewNotes("");
                          }
                        }}
                        className="rounded-lg bg-amber-500 px-3.5 py-1.5 font-bold text-slate-950 disabled:opacity-40"
                      >
                        Solicitar correção
                      </button>
                      <button
                        type="button"
                        disabled={
                          actionLoading ||
                          customerRejectionGuidance.trim().length < 5
                        }
                        onClick={async () => {
                          const ok = await callDealApi(
                            {
                              action: "REVIEW_DOCUMENT",
                              dealId: deal.id,
                              documentId: doc.id,
                              decision: "REJECTED",
                              justification: customerRejectionGuidance,
                              customerRejectionGuidance,
                              internalReviewNotes,
                            },
                            "Documento rejeitado.",
                          );
                          if (ok) {
                            setReviewingDocId(null);
                            setCustomerRejectionGuidance("");
                            setInternalReviewNotes("");
                          }
                        }}
                        className="rounded-lg bg-red-600 px-3.5 py-1.5 font-bold text-white disabled:opacity-40"
                      >
                        Rejeitar documento
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ABA 3: DADOS DA VENDA, FATURAMENTO, AUTORIZAÇÃO E ENTREGA */}
      {activeTab === "SALE_DATA" && (
        <div className="space-y-6">
          {/* Condições comerciais, Procuração, Usado na troca e Pilares */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-base font-extrabold text-[#172B3A]">
              Condições da venda e resumo das frentes
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3">
                <span className="text-slate-500 block text-[11px]">
                  Modalidade de pagamento
                </span>
                <strong className="text-[#172B3A] mt-0.5 block">
                  {deal.paymentMethod === "FINANCING"
                    ? `Financiamento (${deal.financingInstitution || "Banco"})`
                    : deal.paymentMethod === "CASH"
                      ? "À Vista (PIX/TED)"
                      : deal.paymentMethod === "CONSORTIUM"
                        ? "Consórcio"
                        : "Pagamento Misto"}
                </strong>
              </div>
              <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3">
                <span className="text-slate-500 block text-[11px]">
                  Procuração
                </span>
                <strong className="text-[#172B3A] mt-0.5 block">
                  {deal.hasPowerOfAttorney
                    ? `Sim (${deal.attorneyName})`
                    : "Não aplicável"}
                </strong>
              </div>
              <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3">
                <span className="text-slate-500 block text-[11px]">
                  Nota Fiscal (NF-e)
                </span>
                <strong className="text-[#172B3A] mt-0.5 block">
                  {deal.invoiceNumber || "Aguardando emissão"}
                </strong>
              </div>
              <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3">
                <span className="text-slate-500 block text-[11px]">
                  Previsão de entrega
                </span>
                <strong className="text-[#172B3A] mt-0.5 block">
                  {deal.confirmedDeliveryDate
                    ? `Confirmada: ${formatDateBr(deal.confirmedDeliveryDate)}`
                    : deal.expectedDeliveryDate
                      ? `${formatDateBr(deal.expectedDeliveryDate)} (Previsão)`
                      : "A definir"}
                </strong>
              </div>
            </div>

            {tradeInVehicle && (
              <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-3.5 text-xs">
                <span className="font-bold text-amber-950 block">
                  Veículo usado na troca:
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

            <div className="grid sm:grid-cols-3 gap-3">
              {[
                summary.pillars.financial,
                summary.pillars.documentation,
                summary.pillars.operational,
              ].map((p) => (
                <div
                  key={p.area}
                  className={`rounded-xl border p-3 text-xs ${
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

          {/* 3 Marcos Operacionais: Faturamento, Autorização e Entrega Física */}
          <div className="grid lg:grid-cols-3 gap-5">
            {/* 1. Faturamento */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="eyebrow">1 • Faturamento</span>
                <h3 className="text-base font-extrabold text-[#172B3A]">
                  Emissão da Nota Fiscal
                </h3>

                {deal.billingRegisteredAt ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Nota Fiscal registrada</span>
                    </div>
                    <div>
                      Número: <strong>{deal.invoiceNumber}</strong>
                    </div>
                    <div>Em: {formatDateTimeBr(deal.billingRegisteredAt)}</div>
                  </div>
                ) : summary.billingEligible ? (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-emerald-800 font-semibold">
                      Dossiê financeiro e documental aprovados. Faturamento
                      disponível.
                    </p>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Número da Nota Fiscal (NF-e) *
                      </label>
                      <input
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="Ex: NF-2026-009841"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-[#172B3A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Observações do faturamento
                      </label>
                      <input
                        type="text"
                        value={billingNotes}
                        onChange={(e) => setBillingNotes(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-[#172B3A]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3 text-xs space-y-2">
                    <p className="text-slate-700 font-medium">
                      O faturamento ficará disponível após a aprovação dos
                      documentos e da conferência financeira.
                    </p>
                    {summary.billingBlockers[0] && (
                      <div className="pt-1 border-t border-slate-200 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-600">
                          Pendente: <strong>{summary.billingBlockers[0].title}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            navigateToBlockerItem(summary.billingBlockers[0])
                          }
                          className="text-[11px] font-bold text-[#1684D8] hover:underline shrink-0"
                        >
                          Abrir →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!deal.billingRegisteredAt && summary.billingEligible && (
                <button
                  type="button"
                  disabled={
                    actionLoading ||
                    !hasPerm("billing:register") ||
                    invoiceNumber.trim().length < 3
                  }
                  onClick={() =>
                    callDealApi(
                      {
                        action: "REGISTER_BILLING",
                        dealId: deal.id,
                        invoiceNumber,
                        notes: billingNotes,
                      },
                      `Faturamento registrado com Nota Fiscal '${invoiceNumber}'.`,
                    )
                  }
                  className="w-full rounded-xl bg-[#0B3B70] hover:bg-[#1684D8] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40 transition"
                >
                  {hasPerm("billing:register")
                    ? "Registrar faturamento"
                    : "Requer perfil Faturamento / Admin"}
                </button>
              )}
            </div>

            {/* 2. Autorização Formal de Liberação */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="eyebrow">2 • Autorização de Liberação</span>
                <h3 className="text-base font-extrabold text-[#172B3A]">
                  Autorização Formal para Entrega
                </h3>

                {passport.activeReleaseAuthorization ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>Entrega autorizada</span>
                    </div>
                    <div>
                      Autorizado por:{" "}
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
                    Autorização utilizada na entrega concluída.
                  </div>
                ) : summary.deliveryEligible ? (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs text-emerald-800 font-semibold">
                      Todas as etapas anteriores foram concluídas. Pronta para
                      autorização formal.
                    </p>
                    <label className="block text-xs font-semibold text-slate-700">
                      Parecer de liberação
                    </label>
                    <textarea
                      rows={2}
                      value={releaseNotes}
                      onChange={(e) => setReleaseNotes(e.target.value)}
                      placeholder="Observação opcional da conferência final..."
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-[#172B3A]"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3 text-xs space-y-2">
                    <p className="text-slate-700 font-medium">
                      A autorização formal só fica disponível quando todas as
                      atividades e documentos obrigatórios estão concluídos.
                    </p>
                    {currentBlockers[0] && (
                      <div className="pt-1 border-t border-slate-200 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-600">
                          Pendente: <strong>{currentBlockers[0].title}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            navigateToBlockerItem(currentBlockers[0])
                          }
                          className="text-[11px] font-bold text-[#1684D8] hover:underline shrink-0"
                        >
                          Abrir →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!passport.activeReleaseAuthorization &&
                deal.status !== "DELIVERED" &&
                summary.deliveryEligible && (
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
                        "Autorização de entrega emitida com sucesso!",
                      )
                    }
                    className="w-full rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40 transition"
                  >
                    {hasPerm("release:authorize")
                      ? "Emitir autorização de entrega"
                      : "Requer perfil Gestor / Responsável pela Liberação"}
                  </button>
                )}
            </div>

            {/* 3. Entrega Física das Chaves */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="eyebrow">3 • Entrega Física</span>
                <h3 className="text-base font-extrabold text-[#172B3A]">
                  Confirmação do Veículo e Entrega
                </h3>

                {passport.deliveryRecord ? (
                  <div className="rounded-xl bg-emerald-100 border border-emerald-400 p-3 text-xs text-emerald-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      <span>Veículo entregue</span>
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
                ) : passport.activeReleaseAuthorization ? (
                  <div className="space-y-2.5 pt-1 text-xs">
                    <p className="text-slate-600">
                      Digite o chassi ou o código interno do veículo na etiqueta
                      física para confirmar a entrega das chaves.
                    </p>
                    <div>
                      <label className="font-semibold text-slate-700 block">
                        Chassi ou código interno do veículo *
                      </label>
                      <input
                        type="text"
                        value={confirmedVinInput}
                        onChange={(e) => setConfirmedVinInput(e.target.value)}
                        placeholder="Digite o chassi ou código interno..."
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
                ) : (
                  <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3 text-xs text-slate-700">
                    A entrega física só fica disponível após a emissão da
                    Autorização Formal de Entrega.
                  </div>
                )}
              </div>

              {!passport.deliveryRecord &&
                passport.activeReleaseAuthorization && (
                  <button
                    type="button"
                    disabled={
                      actionLoading ||
                      !hasPerm("delivery:confirm") ||
                      !confirmedVinInput.trim()
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
                        "Entrega física das chaves confirmada com sucesso!",
                      )
                    }
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40 transition"
                  >
                    {hasPerm("delivery:confirm")
                      ? "Confirmar veículo e registrar entrega"
                      : "Requer perfil Operação / Admin"}
                  </button>
                )}
            </div>
          </div>

          {/* Adendo Pós-Entrega */}
          {passport.deliveryRecord && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#172B3A]">
                Observações complementares pós-entrega
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
                  placeholder="Registrar anotação complementar pós-entrega..."
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
                      "Anotação complementar registrada.",
                    );
                    if (ok) setAddendumNote("");
                  }}
                  className="rounded-lg bg-[#0B3B70] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  Registrar anotação
                </button>
              </div>
            </div>
          )}

          {/* Aprovações Formais Registradas */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#172B3A]">
              Aprovações formais registradas ({passport.approvals.length})
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
                      <div className="font-bold text-[#172B3A] flex flex-wrap items-center gap-2">
                        <span>
                          {taskTitleByCode[ap.taskCode] || ap.taskCode}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            ap.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-red-100 text-red-900"
                          }`}
                        >
                          {ap.status === "ACTIVE"
                            ? "Válida"
                            : `Desatualizada (${ap.invalidationReason})`}
                        </span>
                      </div>
                      <p className="text-slate-700">{ap.justification}</p>
                      <div className="text-[11px] text-slate-500">
                        Responsável: <strong>{ap.authorName}</strong> (
                        {ROLE_LABELS[ap.roleUsed]}) • Em{" "}
                        {formatDateTimeBr(ap.createdAt)}
                      </div>
                      {ap.evidenceRefs.length > 0 && (
                        <div className="text-[11px] text-[#0B3B70] font-medium">
                          Documentos conferidos:{" "}
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

      {/* ABA 4: HISTÓRICO */}
      {activeTab === "HISTORY" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#172B3A]">
              Histórico da negociação ({passport.auditEvents.length})
            </h2>
            <p className="text-xs text-slate-500">
              Registro cronológico das atividades, conferências e decisões.
            </p>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
            {passport.auditEvents.map((ev) => (
              <div key={ev.id} className="p-3.5 hover:bg-[#F4F7FA] space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-[#172B3A] flex flex-wrap items-center gap-2">
                    <span className="text-[11px] bg-[#EAF3FC] text-[#0B3B70] px-2 py-0.5 rounded font-semibold">
                      {AUDIT_ACTION_LABELS[ev.action] || ev.action}
                    </span>
                    <span>{ev.actorName}</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {formatDateTimeBr(ev.createdAt)}
                  </span>
                </div>
                <p className="text-slate-700">{ev.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
