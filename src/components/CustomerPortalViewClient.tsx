"use client";

import { CustomerSafeDealView } from "@/application/customer-portal-service";
import { DealStatus, DocumentStatus } from "@/domain/types";
import { formatDateTimeBr } from "@/lib/format";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
      if (file.size > 4 * 1024 * 1024)
        throw new Error("O arquivo deve ter até 4 MB.");
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
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Erro ao enviar arquivo.",
        });
      } else {
        setFeedback({
          type: "success",
          text: `Arquivo '${file.name}' enviado para '${docTitle}'.`,
        });
        router.refresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro de rede no upload do arquivo.",
      });
    } finally {
      setLoadingDocId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Cabeçalho mobile-friendly */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base">
                  ChaveFlow
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
                  Portal do Comprador
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Acompanhamento transparente da sua aquisição
              </p>
            </div>
          </div>

          <Link
            href="/cliente"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Início
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-5">
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <span>{feedback.text}</span>
            <button
              onClick={() => setFeedback(null)}
              className="underline ml-3 font-semibold"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Cartão Principal do Veículo Adquirido */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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

          {/* Previsão de Entrega (Regra: só mostra data confirmada quando confirmada por pessoa autorizada) */}
          <div
            className={`px-5 py-3.5 border-t flex items-start gap-3 ${
              view.deliveryForecast.isConfirmedByAuthorizedStaff
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            <Calendar
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                view.deliveryForecast.isConfirmedByAuthorizedStaff
                  ? "text-emerald-600"
                  : "text-slate-500"
              }`}
            />
            <div className="text-xs">
              <p className="font-bold">
                {view.deliveryForecast.isConfirmedByAuthorizedStaff
                  ? "Previsão de Entrega Confirmada pela Liberação"
                  : "Previsão de Entrega"}
              </p>
              <p className="mt-0.5">{view.deliveryForecast.publicMessage}</p>
            </div>
          </div>
        </section>

        {/* Etapas Compartilháveis */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-1">
            Etapas da sua Aquisição
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Acompanhe em qual fase está a preparação documental e operacional do
            seu veículo.
          </p>

          <div className="space-y-2.5">
            {view.shareableStages.map((stage, idx) => {
              const isCompleted = stage.state === "COMPLETED";
              const isCurrent = stage.state === "CURRENT";
              return (
                <div
                  key={stage.code}
                  className={`p-3 rounded-xl border flex items-start gap-3 ${
                    isCurrent
                      ? "bg-blue-50/70 border-blue-300"
                      : isCompleted
                        ? "bg-emerald-50/40 border-emerald-200"
                        : "bg-slate-50/60 border-slate-200 opacity-75"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                      isCompleted
                        ? "bg-emerald-600 text-white"
                        : isCurrent
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : isCurrent ? (
                      <Clock className="w-3.5 h-3.5" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900">
                        {stage.name}
                      </p>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-800"
                            : isCurrent
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {isCompleted
                          ? "Concluída"
                          : isCurrent
                            ? "Etapa atual"
                            : "Próxima etapa"}
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
        </section>

        {/* Solicitações de Documentos Visíveis ao Cliente */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Seus Documentos Solicitados
              </h2>
              <p className="text-xs text-slate-500">
                Envie ou consulte a situação dos documentos necessários para o
                faturamento e entrega.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {view.documentRequests.map((doc) => (
              <div
                key={doc.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
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
                  {doc.customerSafeFeedback && (
                    <p className="text-xs text-amber-800 font-medium flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      {doc.customerSafeFeedback}
                    </p>
                  )}
                </div>

                {doc.customerActionNeeded && view.status !== "DELIVERED" && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer">
                      <span>Enviar documento (até 4 MB)</span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
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
            ))}
          </div>
        </section>

        {/* Atualizações Compartilháveis & Contato do Vendedor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-3">
              Atualizações Recentes
            </h2>
            {view.customerUpdates.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhuma atualização pública registrada ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {view.customerUpdates.map((upd) => (
                  <div
                    key={upd.id}
                    className="border-l-2 border-blue-500 pl-3 py-0.5"
                  >
                    <p className="text-xs text-slate-800 font-medium">
                      {upd.summary}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatDateTimeBr(upd.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                Seu Consultor Comercial
              </h2>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <p className="text-sm font-bold text-slate-900">
                  {view.sellerContact.fullName}
                </p>
                <p className="text-xs text-slate-600 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {view.sellerContact.phone}
                </p>
                <p className="text-xs text-slate-600 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {view.sellerContact.email}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Ambiente protegido por convite individual revogável. Observações
                internas da concessionária e pareceres técnicos não são exibidos
                nesta visão.
              </span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
