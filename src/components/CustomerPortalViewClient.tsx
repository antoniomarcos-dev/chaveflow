"use client";

import { CustomerSafeDealView } from "@/application/customer-portal-service";
import { DealStatus, DocumentStatus } from "@/domain/types";
import { formatDateTimeBr } from "@/lib/format";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  Upload,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DealStatusBadge, DocumentStatusBadge } from "./StatusBadge";

export function CustomerPortalViewClient({
  view,
  accessToken,
}: {
  view: CustomerSafeDealView;
  accessToken?: string;
}) {
  const router = useRouter();
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleRealFileUpload(
    docId: string,
    docTitle: string,
    file: File,
  ) {
    setFeedback(null);
    setLoadingDocId(docId);
    try {
      if (file.size > 4 * 1024 * 1024) {
        throw new Error("O arquivo deve ter até 4 MB.");
      }
      const fd = new FormData();
      fd.append("dealId", view.dealId);
      fd.append("documentId", docId);
      fd.append("uploadNotes", "Arquivo enviado pelo comprador via Portal");
      if (accessToken) {
        fd.append("accessToken", accessToken);
      }
      fd.append("file", file);

      const res = await fetch("/api/deals", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFeedback({
          type: "error",
          text:
            data.error ||
            "Não foi possível validar o arquivo enviado. Confira o tamanho e o formato.",
        });
      } else {
        setFeedback({
          type: "success",
          text: `Arquivo '${file.name}' enviado com sucesso para '${docTitle}'.`,
        });
        router.refresh();
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Falha de conexão ao enviar o arquivo.",
      });
    } finally {
      setLoadingDocId(null);
    }
  }

  // Separação de etapas concluídas/atual vs etapas futuras (recolhidas em Próximas etapas)
  const { activeStages, futureStages } = useMemo(() => {
    const active = [];
    const future = [];
    for (const stage of view.shareableStages) {
      if (stage.state === "COMPLETED" || stage.state === "CURRENT") {
        active.push(stage);
      } else {
        future.push(stage);
      }
    }
    return { activeStages: active, futureStages: future };
  }, [view.shareableStages]);

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-12 text-[#172B3A]">
      {/* Cabeçalho do Portal do Cliente */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#0B3B70] flex items-center justify-center text-white shadow-sm">
              <KeyRound className="w-5 h-5 text-[#7CC4FA]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-[#0B3B70] text-base">
                  <span className="text-[#1684D8] mr-0.5">//</span>AUTOFLOW
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#EAF3FC] text-[#0B3B70] border border-[#1684D8]/30 font-bold">
                  Área do Cliente
                </span>
                <span className="hidden sm:inline text-xs font-semibold text-slate-500">
                  • Pinauto BYD — Ceres/GO
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Acompanhamento transparente da sua entrega
              </p>
            </div>
          </div>

          <Link
            href="/cliente"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#172B3A] hover:text-[#1684D8] px-3 py-1.5 rounded-lg border border-slate-200 bg-[#F4F7FA] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Início</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-5">
        {feedback && (
          <div
            role="alert"
            className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between shadow-xs ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                : "bg-red-50 border-red-300 text-red-950"
            }`}
          >
            <span>{feedback.text}</span>
            <button
              onClick={() => setFeedback(null)}
              className="underline ml-3 font-bold"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Resumo do Veículo e Comprador */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-full sm:w-44 h-28 rounded-xl bg-slate-900 flex items-center justify-center p-2 shrink-0">
              <img
                src={view.vehicle.photos[0] || "/vehicle-placeholder.svg"}
                alt={`${view.vehicle.brand} ${view.vehicle.model}`}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                  {view.dealNumber}
                </span>
                <DealStatusBadge status={view.status as DealStatus} />
              </div>

              <h1 className="text-xl font-bold text-slate-900">
                {view.vehicle.brand} {view.vehicle.model} {view.vehicle.trim}
              </h1>

              <p className="text-xs text-slate-600">
                Cor:{" "}
                <strong className="text-slate-800">{view.vehicle.color}</strong>{" "}
                • Ano/Modelo:{" "}
                <strong className="text-slate-800">
                  {view.vehicle.modelYear}
                </strong>{" "}
                • Comprador:{" "}
                <strong className="text-slate-800">{view.customerName}</strong>
              </p>
            </div>
          </div>

          {/* Destaque da Previsão de Entrega */}
          <div
            className={`px-5 py-4 border-t flex items-start gap-3.5 ${
              view.deliveryForecast.isConfirmedByAuthorizedStaff
                ? "bg-emerald-50/90 border-emerald-300 text-emerald-950"
                : "bg-amber-50/80 border-amber-200 text-amber-950"
            }`}
          >
            <Calendar
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                view.deliveryForecast.isConfirmedByAuthorizedStaff
                  ? "text-emerald-700"
                  : "text-amber-700"
              }`}
            />
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-sm">
                {view.deliveryForecast.isConfirmedByAuthorizedStaff
                  ? "Previsão de Entrega Confirmada"
                  : "Previsão de Entrega (Aguardando Confirmação)"}
              </p>
              <p className="text-slate-700 leading-relaxed">
                {view.deliveryForecast.publicMessage}
              </p>
              {!view.deliveryForecast.isConfirmedByAuthorizedStaff && (
                <p className="text-[11px] text-amber-900 font-medium pt-0.5">
                  A data exata de entrega das chaves será confirmada assim que o
                  faturamento e as vistorias forem concluídos.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Etapas da Aquisição: Concluídas/Atual + Próximas Etapas Recolhidas */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Etapas da sua Aquisição
            </h2>
            <p className="text-xs text-slate-500">
              Acompanhe o andamento da preparação do seu veículo.
            </p>
          </div>

          {/* Etapas ativas ou concluídas */}
          <div className="space-y-2.5">
            {activeStages.map((stage) => {
              const isCompleted = stage.state === "COMPLETED";
              const isCurrent = stage.state === "CURRENT";
              return (
                <div
                  key={stage.code}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 transition ${
                    isCurrent
                      ? "bg-[#EAF3FC] border-[#1684D8]"
                      : "bg-emerald-50/50 border-emerald-200"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                      isCompleted
                        ? "bg-emerald-600 text-white"
                        : "bg-[#1684D8] text-white"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#172B3A]">
                        {stage.name}
                      </p>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-[#1684D8] text-white"
                        }`}
                      >
                        {isCompleted ? "Concluída" : "Em andamento"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {stage.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Próximas etapas recolhidas */}
          {futureStages.length > 0 && (
            <details className="group rounded-xl border border-slate-200 bg-[#F4F7FA] text-xs">
              <summary className="cursor-pointer px-4 py-2.5 font-bold text-slate-700 flex items-center justify-between">
                <span>Próximas etapas ({futureStages.length})</span>
                <ChevronDown className="h-4 w-4 text-slate-500 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="p-4 pt-1 border-t border-slate-200 space-y-2">
                {futureStages.map((stage) => (
                  <div
                    key={stage.code}
                    className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">
                        {stage.name}
                      </span>
                      <p className="text-[11px] text-slate-500">
                        {stage.description}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                      Aguardando
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* Documentos Solicitados ao Cliente */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#1684D8]" />
              <span>Seus Documentos Solicitados</span>
            </h2>
            <p className="text-xs text-slate-500">
              Envie ou consulte a situação dos documentos necessários para o
              faturamento e entrega.
            </p>
          </div>

          <div className="space-y-3">
            {view.documentRequests.map((doc) => {
              const hasRejectionOrCorrection =
                Boolean(doc.customerSafeFeedback) &&
                (doc.status === "REJECTED" ||
                  doc.status === "CORRECTION_REQUESTED" ||
                  doc.status === "OUTDATED");

              return (
                <div
                  key={doc.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    hasRejectionOrCorrection
                      ? "bg-red-50/50 border-red-300"
                      : "bg-[#F4F7FA]/70 border-slate-200"
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {doc.title}
                      </span>
                      <DocumentStatusBadge
                        status={doc.status as DocumentStatus}
                      />
                      {doc.currentVersionNumber > 0 && (
                        <span className="text-[11px] font-mono text-slate-500">
                          v{doc.currentVersionNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">{doc.whyRequired}</p>

                    {/* Orientação específica de regularização em destaque */}
                    {hasRejectionOrCorrection && (
                      <div className="rounded-lg bg-red-100/70 border border-red-200 p-2.5 text-xs text-red-950 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Como regularizar este documento:</strong>{" "}
                          <span>{doc.customerSafeFeedback}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {doc.customerActionNeeded && view.status !== "DELIVERED" && (
                    <div className="shrink-0 pt-2 sm:pt-0">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer transition shadow-xs">
                        <Upload className="h-3.5 w-3.5 text-[#1684D8]" />
                        <span>
                          {loadingDocId === doc.id
                            ? "Enviando..."
                            : "Enviar arquivo"}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                          disabled={loadingDocId === doc.id}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleRealFileUpload(doc.id, doc.title, f);
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Atualizações Recentes em Linguagem Simples & Contato do Consultor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              Atualizações Recentes
            </h2>
            {view.customerUpdates.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhuma atualização registrada ainda.
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                {view.customerUpdates.map((upd) => (
                  <div
                    key={upd.id}
                    className="border-l-2 border-[#1684D8] pl-3 py-0.5"
                  >
                    <p className="text-slate-800 font-medium">{upd.summary}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatDateTimeBr(upd.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#1684D8]" />
                <span>Seu Consultor Comercial</span>
              </h2>
              <div className="p-3.5 rounded-xl bg-[#F4F7FA] border border-slate-200 space-y-2">
                <p className="text-sm font-bold text-slate-900">
                  {view.sellerContact.fullName}
                </p>
                <p className="text-xs text-slate-600 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{view.sellerContact.phone}</span>
                </p>
                <p className="text-xs text-slate-600 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{view.sellerContact.email}</span>
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Ambiente seguro AUTOFLOW. Acompanhamento exclusivo da sua
                negociação.
              </span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
