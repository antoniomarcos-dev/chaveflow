import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { getServerSessionContext } from "@/lib/server-session";
import { listDealsForOrg } from "@/application/deal-service";
import { loadDatabaseState } from "@/infrastructure/database";
import { AREA_LABELS } from "@/domain/types";
import {
  DealStatusBadge,
  DocumentStatusBadge,
  TaskStateBadge,
} from "@/components/StatusBadge";

export default async function AprovacoesWorkQueuesPage() {
  const ctx = (await getServerSessionContext())!;
  const deals = listDealsForOrg({ ctx });
  const db = loadDatabaseState();

  const activeDeals = deals.filter(
    (d) =>
      d.deal.status === "ACTIVE" ||
      d.deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      d.deal.status === "DELIVERY_AUTHORIZED"
  );

  // 1. Fila Documental (Documentos enviados aguardando revisão ou desatualizados)
  const pendingDocsQueue = activeDeals.flatMap(({ deal, vehicle, customer }) =>
    db.documents
      .filter(
        (doc) =>
          doc.dealId === deal.id &&
          (doc.status === "UPLOADED_PENDING_REVIEW" ||
            doc.status === "OUTDATED" ||
            doc.status === "REQUESTED")
      )
      .map((doc) => ({ doc, deal, vehicle, customer }))
  );

  // 2. Fila de Aprovações Formais por Área (Financeiro e Documental)
  const pendingFormalTasksQueue = activeDeals.flatMap(
    ({ deal, vehicle, customer }) =>
      db.taskInstances
        .filter(
          (t) =>
            t.dealId === deal.id &&
            t.requiresFormalApproval &&
            t.state !== "WAIVED_BY_RULE" &&
            t.approvalStatus !== "APPROVED" &&
            t.code !== "TASK_RELEASE_AUTH"
        )
        .map((task) => ({ task, deal, vehicle, customer }))
  );

  // 3. Fila de Faturamento, Autorização de Liberação e Entrega Física
  const releaseAndBillingQueue = activeDeals.filter(
    ({ deal, summary }) =>
      summary.billingEligible ||
      summary.deliveryEligible ||
      deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      deal.status === "DELIVERY_AUTHORIZED"
  );

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
          Caixas de Trabalho por Área (Funcionalidade 8)
        </span>
        <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
          Central de Aprovações, Faturamento e Liberação
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
          Separação explícita entre conferência documental, aprovação financeira, faturamento, elegibilidade para autorização, entrega autorizada e entrega realizada.
        </p>
      </div>

      {/* Caixa 1: Conferência de Documentos */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-teal-600" />
          <h2 className="text-base font-bold text-slate-900">
            Caixa Documental — Documentos em Conferência ou Pendentes ({pendingDocsQueue.length})
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {pendingDocsQueue.map(({ doc, deal, vehicle, customer }) => (
            <div
              key={doc.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                    {deal.dealNumber} • {vehicle.internalCode}
                  </span>
                  <DocumentStatusBadge status={doc.status} />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {doc.title} (v{doc.currentVersionNumber})
                </h3>
                <p className="text-xs text-slate-600">
                  Comprador: <strong>{customer.fullName}</strong> • Área:{" "}
                  {AREA_LABELS[doc.responsibleArea]}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <Link
                  href={`/app/negociacoes/${deal.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white"
                >
                  <span>Conferir no Passaporte</span>
                  <ArrowRight className="h-3.5 w-3.5 text-teal-400" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Caixa 2: Etapas com Aprovação Formal */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-teal-600" />
          <h2 className="text-base font-bold text-slate-900">
            Caixa Financeira e Documental — Aprovações Formais Pendentes ({pendingFormalTasksQueue.length})
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {pendingFormalTasksQueue.map(({ task, deal, vehicle, customer }) => (
            <div
              key={task.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                    {deal.dealNumber} • {AREA_LABELS[task.responsibleArea]}
                  </span>
                  <TaskStateBadge state={task.state} />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {task.title}
                </h3>
                <p className="text-xs text-slate-600">
                  Veículo: {vehicle.brand} {vehicle.model} ({vehicle.internalCode}) • Comprador:{" "}
                  {customer.fullName}
                </p>
                {task.pendingReason && (
                  <p className="text-xs text-amber-800 font-medium">
                    {task.pendingReason}
                  </p>
                )}
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <Link
                  href={`/app/negociacoes/${deal.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f172a] px-3.5 py-1.5 text-xs font-bold text-white"
                >
                  <span>Analisar e Registrar Decisão</span>
                  <ArrowRight className="h-3.5 w-3.5 text-teal-400" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Caixa 3: Faturamento, Autorização de Liberação e Entrega */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-teal-600" />
          <h2 className="text-base font-bold text-slate-900">
            Caixa de Faturamento, Autorização de Liberação e Entrega Física ({releaseAndBillingQueue.length})
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {releaseAndBillingQueue.map(({ deal, vehicle, customer, summary }) => (
            <div
              key={deal.id}
              className="bg-white rounded-2xl border-2 border-teal-500 p-5 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2.5 py-1 rounded">
                  {deal.dealNumber}
                </span>
                <DealStatusBadge status={deal.status} />
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {vehicle.internalCode} — {vehicle.brand} {vehicle.model} (
                  {vehicle.color})
                </h3>
                <p className="text-xs text-slate-600">
                  Comprador: <strong>{customer.fullName}</strong> • Chassi:{" "}
                  <code>{vehicle.vin}</code>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                  <span className="text-slate-500 block">Faturamento:</span>
                  <strong className="text-slate-900">
                    {summary.billingRegistered
                      ? "NF Registrada"
                      : summary.billingEligible
                      ? "Elegível p/ NF"
                      : "Bloqueado"}
                  </strong>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                  <span className="text-slate-500 block">Elegível Liberação:</span>
                  <strong className="text-slate-900">
                    {summary.deliveryEligible ? "Sim (100%)" : "Não"}
                  </strong>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                  <span className="text-slate-500 block">Autorização:</span>
                  <strong className="text-slate-900">
                    {summary.deliveryAuthorized ? "Autorizada" : "Pendente"}
                  </strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <Link
                  href={`/app/negociacoes/${deal.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2 text-xs font-bold text-white"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Abrir Passaporte p/ Liberação ou Entrega</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
