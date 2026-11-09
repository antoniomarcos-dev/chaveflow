import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  Lock,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getServerSessionContext } from "@/lib/server-session";

export default async function HomePage() {
  const session = await getServerSessionContext();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Aviso de Ambiente Demonstrativo */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5" />
              PILOTO DEMONSTRATIVO
            </span>
            <span className="text-slate-300">
              Cenário demonstrativo:{" "}
              <strong className="text-white">Pinauto BYD de Ceres/GO</strong> —
              ChaveFlow é um sistema independente e não possui vínculo oficial ou homologação pela BYD.
            </span>
          </div>
          <div className="flex items-center gap-3">
            {session ? (
              <Link
                href={session.profile.isCustomerOnly ? "/cliente" : "/app"}
                className="text-teal-400 font-semibold hover:underline"
              >
                Sessão ativa: {session.profile.fullName} (Ir para o painel →)
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-teal-400 font-semibold hover:underline"
              >
                Acessar conta / Trocar perfil →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Hero Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 flex flex-col justify-between gap-12">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-950 border border-teal-700/60 px-3.5 py-1.5 text-xs font-semibold text-teal-300">
              <KeyRound className="h-3.5 w-3.5" />
              <span>Gestão de Faturamento, Passaporte Digital e Liberação de Veículos</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Escaneou o carro.{" "}
              <span className="text-teal-400">Entendeu o próximo passo.</span>{" "}
              Acompanhou até a entrega.
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
              A <strong>ChaveFlow</strong> organiza o caminho entre a venda de um
              veículo e a entrega física das chaves. Elimina ligações internas,
              dúvidas de regras documentais, pendências ocultas e retrabalho entre
              Comercial, Documental, Financeiro, Faturamento e Operação.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={session ? "/app" : "/login"}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition"
              >
                <span>
                  {session
                    ? "Abrir Painel Operacional ChaveFlow"
                    : "Entrar no Sistema (Ambiente Demonstrativo)"}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/app/escanear"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-5 py-3.5 text-sm font-semibold text-slate-100 transition"
              >
                <QrCode className="h-4 w-4 text-teal-400" />
                <span>Escanear Veículo (QR Code)</span>
              </Link>

              <Link
                href="/cliente?token=tok-cliente-helena-neg0001"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 px-4 py-3.5 text-sm font-medium text-slate-300 transition"
              >
                <Users className="h-4 w-4 text-blue-400" />
                <span>Visão do Comprador (Helena)</span>
              </Link>
            </div>
          </div>

          {/* Card de Demonstração Rápida das 9 Perguntas Respondidas */}
          <div className="lg:col-span-5 rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                  Passaporte Digital em Tempo Real
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  O que o ChaveFlow responde a qualquer instante:
                </h2>
              </div>
              <div className="h-10 w-10 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <FileCheck2 className="h-5 w-5" />
              </div>
            </div>

            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
              {[
                "Qual é o veículo e qual negociação ativa está vinculada a ele?",
                "Em qual situação e etapa do processo ele se encontra?",
                "O que falta exatamente para avançar e quem precisa agir?",
                "Qual é a próxima ação recomendada para o usuário logado?",
                "Quais tarefas podem ser adiantadas em paralelo (ex: PDI)?",
                "Quais requisitos impedem o faturamento ou a entrega?",
                "Quais aprovações, versões de documentos e evidências estão registradas?",
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-teal-400" />
                  <span>RBAC no Servidor</span>
                </div>
                <p className="text-slate-400 mt-1">
                  Isolamento por organização, controle de concorrência e auditoria imutável.
                </p>
              </div>
              <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
                  <span>Motor Versionado</span>
                </div>
                <p className="text-slate-400 mt-1">
                  Regras explícitas sem execução de código arbitrário e invalidação automática.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
