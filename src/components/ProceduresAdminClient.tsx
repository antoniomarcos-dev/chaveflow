"use client";
import { TaskDefaultsClient, type TaskDefault } from "./TaskDefaultsClient";

import {
  AREA_LABELS,
  ProcedureSection,
  ResponsibleArea,
  RoleCode,
} from "@/domain/types";
import { formatDateTimeBr } from "@/lib/format";
import { BookOpen, CheckCircle2, FilePlus, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

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

export function ProceduresAdminClient({
  procedures,
  taskTemplates,
  internalStaff,
  canManageProcedures,
}: {
  procedures: EnrichedProcedure[];
  taskTemplates: TaskDefault[];
  internalStaff: Array<{ id: string; fullName: string; roles: RoleCode[] }>;
  canManageProcedures: boolean;
}) {
  const router = useRouter();
  const [showNewForm, setShowNewForm] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [responsibleArea, setResponsibleArea] =
    useState<ResponsibleArea>("OPERATIONS");
  const [content, setContent] = useState("");
  const [secNum, setSecNum] = useState("1.1");
  const [secHeading, setSecHeading] = useState("");
  const [secBody, setSecBody] = useState(
    "Conferir presença do carregador portátil e registrar número de série antes da autorização de liberação.",
  );
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<ResponsibleArea | "ALL">("ALL");

  const filteredProcedures =
    areaFilter === "ALL"
      ? procedures
      : procedures.filter((p) => p.responsibleArea === areaFilter);

  async function handleSaveProcedure(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_OR_PUBLISH_PROCEDURE",
          code,
          title,
          responsibleArea,
          content,
          sections: [
            {
              sectionNumber: secNum,
              heading: secHeading,
              body: secBody,
            },
          ],
          publishImmediately,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setShowNewForm(false);
        setFeedback(
          publishImmediately
            ? "Nova versão de procedimento publicada e ativa para orientações oficiais!"
            : "Rascunho de procedimento salvo (não alimenta orientações oficiais até ser publicado).",
        );
        router.refresh();
      } else {
        setFeedback(data.error || "Erro ao salvar procedimento.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishDraft(versionId: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PUBLISH_DRAFT_PROCEDURE",
          versionId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setFeedback(
          "Versão promovida de Rascunho para Publicado! Agora alimenta as orientações oficiais.",
        );
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho (4.12 Procedimentos e regras) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B3B70] bg-[#EAF3FC] border border-[#1684D8]/30 px-2.5 py-0.5 rounded">
            <ShieldAlert className="h-3.5 w-3.5 text-[#1684D8]" />
            <span>Procedimentos e Regras Confirmadas da Organização</span>
          </span>
          <h1 className="text-2xl font-extrabold text-[#172B3A] mt-2">
            Procedimentos e Regras Operacionais
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Orientações oficiais por área responsável, finalidade e condição de aplicação. Publique uma versão para disponibilizá-la nas negociações.
          </p>
        </div>

        {canManageProcedures && (
          <button
            type="button"
            onClick={() => setShowNewForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition shrink-0"
          >
            <FilePlus className="h-4 w-4" />
            <span>Novo procedimento</span>
          </button>
        )}
      </div>

      {feedback && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-950 font-semibold">
          {feedback}
        </div>
      )}

      {/* Formulário de Criação/Publicação de Procedimento */}
      {showNewForm && canManageProcedures && (
        <form
          onSubmit={handleSaveProcedure}
          className="bg-white rounded-2xl border-2 border-[#1684D8] p-6 shadow-md space-y-4 text-xs"
        >
          <h2 className="text-base font-bold text-[#172B3A]">
            Criar ou Versionar Procedimento Operacional
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block">
                Código do Procedimento *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-[#172B3A]"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block">
                Área Responsável *
              </label>
              <select
                value={responsibleArea}
                onChange={(e) =>
                  setResponsibleArea(e.target.value as ResponsibleArea)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[#172B3A]"
              >
                {(Object.keys(AREA_LABELS) as ResponsibleArea[]).map((ar) => (
                  <option key={ar} value={ar}>
                    {AREA_LABELS[ar]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 font-bold text-[#172B3A] pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publishImmediately}
                  onChange={(e) => setPublishImmediately(e.target.checked)}
                />
                <span>Publicar versão imediatamente</span>
              </label>
            </div>
            <div className="sm:col-span-3">
              <label className="font-semibold text-slate-700 block">
                Título do Procedimento *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[#172B3A]"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="font-semibold text-slate-700 block">
                Resumo / Escopo Geral *
              </label>
              <textarea
                rows={2}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-[#172B3A]"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block">
                Seção Nº
              </label>
              <input
                type="text"
                value={secNum}
                onChange={(e) => setSecNum(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[#172B3A]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block">
                Título da Seção
              </label>
              <input
                type="text"
                value={secHeading}
                onChange={(e) => setSecHeading(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[#172B3A]"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="font-semibold text-slate-700 block">
                Conteúdo Normativo da Seção
              </label>
              <textarea
                rows={2}
                value={secBody}
                onChange={(e) => setSecBody(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-[#172B3A]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-5 py-2 font-bold text-white transition"
            >
              {publishImmediately
                ? "Salvar e Publicar Versão"
                : "Salvar como Rascunho"}
            </button>
          </div>
        </form>
      )}

      {/* Lista de Procedimentos e Suas Versões por Categoria/Área */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#1684D8]" />
            <span>Procedimentos da Concessionária ({filteredProcedures.length})</span>
          </h2>

          {/* Abas de filtro por área responsável */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAreaFilter("ALL")}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                areaFilter === "ALL"
                  ? "bg-[#1684D8] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Todas as áreas
            </button>
            {(Object.keys(AREA_LABELS) as ResponsibleArea[]).map((ar) => (
              <button
                key={ar}
                type="button"
                onClick={() => setAreaFilter(ar)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  areaFilter === ar
                    ? "bg-[#1684D8] text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {AREA_LABELS[ar]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredProcedures.map((proc) => (
            <div
              key={proc.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-[#0B3B70] text-white px-2.5 py-0.5 rounded">
                      {proc.code}
                    </span>
                    <span className="text-xs font-bold bg-[#EAF3FC] text-[#0B3B70] border border-[#1684D8]/30 px-2.5 py-0.5 rounded">
                      Responsável: {proc.areaLabel}
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-[#172B3A] mt-1">
                    {proc.title}
                  </h3>
                </div>

                {proc.publishedVersion ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-950">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>
                      Versão Ativa Publicada: v
                      {proc.publishedVersion.versionNumber}
                    </span>
                  </span>
                ) : (
                  <span className="rounded-md bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                    Apenas Rascunho (Não ativo)
                  </span>
                )}
              </div>

              {proc.publishedVersion && (
                <div className="space-y-2 text-xs">
                  <div className="rounded-xl bg-[#EAF3FC]/50 border border-[#1684D8]/20 p-3 text-[#172B3A]">
                    <span className="font-bold text-[#0B3B70] block mb-0.5">
                      Finalidade e Condição de Aplicação:
                    </span>
                    <p className="font-medium leading-relaxed">
                      {proc.publishedVersion.content}
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
                    {proc.publishedVersion.sections.map((sec) => (
                      <div
                        key={sec.sectionNumber}
                        className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3"
                      >
                        <div className="font-bold text-[#172B3A]">
                          Seção {sec.sectionNumber} — {sec.heading}
                        </div>
                        <p className="text-slate-600 mt-1">{sec.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Todas as versões (incluindo rascunhos e arquivadas) */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="text-xs font-bold text-slate-600">
                  Histórico de Versões deste Procedimento:
                </div>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
                  {proc.allVersions.map((ver) => (
                    <div
                      key={ver.id}
                      className="p-3 bg-[#F4F7FA]/60 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-[#172B3A]">
                          Versão v{ver.versionNumber} — {ver.title}
                        </span>
                        <span
                          className={`ml-2 rounded px-2 py-0.5 text-[10px] font-bold ${
                            ver.status === "PUBLISHED"
                              ? "bg-emerald-100 text-emerald-900"
                              : ver.status === "DRAFT"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {ver.status === "PUBLISHED"
                            ? "PUBLICADO (Alimenta Orientações)"
                            : ver.status === "DRAFT"
                              ? "RASCUNHO (Oculto do Assistente)"
                              : "ARQUIVADO"}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Autor: {ver.authorName} •{" "}
                          {ver.publishedAt
                            ? `Publicado em ${formatDateTimeBr(ver.publishedAt)}`
                            : `Criado em ${formatDateTimeBr(ver.createdAt)}`}
                        </div>
                      </div>

                      {ver.status === "DRAFT" && canManageProcedures && (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handlePublishDraft(ver.id)}
                          className="rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-3 py-1.5 text-xs font-bold text-white transition"
                        >
                          Publicar esta Versão (v{ver.versionNumber})
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Configuração de Prazos Operacionais (SLA), Responsáveis e Documentos Exigidos por Condição */}
      {canManageProcedures && (
        <TaskDefaultsClient tasks={taskTemplates} staff={internalStaff} />
      )}
    </div>
  );
}
