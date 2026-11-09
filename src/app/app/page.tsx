import { listDealsForOrg } from "@/application/deal-service";
import { listVehiclesForOrg } from "@/application/vehicle-service";
import { DealStatusBadge, StockStatusBadge } from "@/components/StatusBadge";
import { WORKFLOW_STAGES } from "@/domain/types";
import { computeUserNextAction } from "@/domain/workflow-engine";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";
import {
  AlertTriangle,
  ArrowRight,
  Car,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  PlusCircle,
  QrCode,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";

export default async function OperationalHomePage() {
  const ctx = await requireInternalSession();
  const deals = await listDealsForOrg({ ctx });
  const vehicles = await listVehiclesForOrg({ ctx });
  const db = await loadDatabaseState();
  const isAdmin = ctx.roles.includes("ADMIN");
  const isSeller = ctx.roles.includes("SELLER") && !isAdmin;

  const activeDeals = deals.filter(
    (d) =>
      d.deal.status === "ACTIVE" ||
      d.deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
      d.deal.status === "DELIVERY_AUTHORIZED",
  );

  const availableVehicles = vehicles.filter(
    (v) => v.stockStatus === "AVAILABLE" && !v.activeDeal,
  );

  return (
    <div className="space-y-8">
      {/* Cabeçalho Operacional */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700">
            <span>
              {isAdmin
                ? "Administração"
                : isSeller
                  ? "Seu espaço de vendas"
                  : "Central operacional"}{" "}
              • {ctx.branch?.name}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
            Olá, {ctx.profile.fullName.split(" ")[0]}.
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {isAdmin
              ? "Uma visão clara da operação, da sua equipe e dos próximos passos."
              : isSeller
                ? "Acompanhe suas negociações e mantenha seus clientes por perto."
                : "Suas atividades, pendências e próximos passos em um só lugar."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/app/escanear"
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition"
          >
            <QrCode className="h-4 w-4" />
            <span>Escanear Veículo (QR Code)</span>
          </Link>
          <Link
            href="/app/negociacoes/nova"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] hover:bg-slate-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition"
          >
            <PlusCircle className="h-4 w-4 text-teal-400" />
            <span>Nova Negociação Guiada</span>
          </Link>
        </div>
      </div>

      {(isAdmin || isSeller) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href={isAdmin ? "/app/configuracoes" : "/app/clientes"}
            className="group flex items-center gap-4 rounded-2xl bg-[#101d31] p-6 text-white transition hover:bg-slate-800"
          >
            <div className="rounded-xl bg-white/10 p-3 text-teal-300">
              {isAdmin ? (
                <UserPlus className="h-6 w-6" />
              ) : (
                <Users className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">
                {isAdmin ? "Sua equipe começa aqui" : "Clientes e acessos"}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {isAdmin
                  ? "Cadastre vendedores e prepare os acessos da equipe."
                  : "Crie o acesso de cada cliente para acompanhar a compra."}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-teal-300" />
          </Link>
          <Link
            href="/app/negociacoes/nova"
            className="group flex items-center gap-4 rounded-2xl border border-teal-200 bg-teal-50 p-6"
          >
            <div className="rounded-xl bg-white p-3 text-teal-700">
              <PlusCircle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-slate-900">Uma nova negociação</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Conecte o veículo, o comprador e cada etapa da venda.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-teal-700" />
          </Link>
        </div>
      )}
      {/* Indicadores Rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Negociações Ativas</span>
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {activeDeals.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Com passaporte em acompanhamento
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Prontas para Autorização</span>
            <ClipboardCheck className="h-4 w-4 text-teal-600" />
          </div>
          <div className="text-2xl font-extrabold text-teal-700 mt-2">
            {
              deals.filter(
                (d) =>
                  d.deal.status === "ELIGIBLE_FOR_AUTHORIZATION" ||
                  (d.summary.deliveryEligible && d.deal.status === "ACTIVE"),
              ).length
            }
          </div>
          <div className="text-xs text-slate-500 mt-1">
            100% dos requisitos cumpridos
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Veículos Disponíveis</span>
            <Car className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {availableVehicles.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Sem negociação ativa vinculada
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Entregas Concluídas</span>
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {deals.filter((d) => d.deal.status === "DELIVERED").length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Com reconfirmação de chassi auditada
          </div>
        </div>
      </div>

      {/* Lista de Passaportes Digitais da Concessionária */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isSeller
                ? "Minhas negociações"
                : "Negociações em acompanhamento"}
            </h2>
            <p className="text-xs text-slate-500">
              Visão em tempo real do veículo, situação, próxima ação do seu
              perfil e bloqueios impeditivos.
            </p>
          </div>
          <Link
            href="/app/negociacoes"
            className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"
          >
            <span>Ver todas as negociações</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {deals.length === 0 && (
          <div className="empty-state">
            <FileSpreadsheet className="mx-auto h-10 w-10 text-teal-500" />
            <h2>Pronto para a próxima negociação.</h2>
            <p>
              {isAdmin
                ? "Cadastre sua equipe e adicione os veículos ao estoque para começar a operação."
                : "Suas negociações aparecerão aqui, com documentos, pendências e o próximo passo de cada venda."}
            </p>
            <Link
              href={isAdmin ? "/app/configuracoes" : "/app/negociacoes/nova"}
              className="text-sm font-semibold text-teal-700"
            >
              {isAdmin ? "Organizar minha equipe" : "Abrir uma negociação"} →
            </Link>
          </div>
        )}
        <div className="grid lg:grid-cols-2 gap-4">
          {deals.map(({ deal, vehicle, customer, sellerName, summary }) => {
            const dealTasks = db.taskInstances.filter(
              (t) => t.dealId === deal.id,
            );
            const dealDocs = db.documents.filter((d) => d.dealId === deal.id);
            const nextAction = computeUserNextAction(
              ctx,
              deal,
              dealTasks,
              dealDocs,
              summary,
            );
            const stageObj = WORKFLOW_STAGES.find(
              (s) => s.code === summary.currentStage,
            );

            return (
              <div
                key={deal.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between gap-4 hover:border-slate-300 transition"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                          {deal.dealNumber}
                        </span>
                        <span className="font-mono text-xs font-semibold text-slate-600">
                          {vehicle.internalCode}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {vehicle.brand} {vehicle.model} {vehicle.trim} (
                        {vehicle.color})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Comprador: <strong>{customer.fullName}</strong> (
                        {deal.buyerType}) • Vendedor: {sellerName}
                      </p>
                    </div>
                    <DealStatusBadge status={deal.status} />
                  </div>

                  {/* Condições da Negociação */}
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      Etapa: {stageObj?.name ?? summary.currentStage}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      Financiamento: {deal.hasFinancing ? "Sim" : "Não"}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      Usado na troca: {deal.hasTradeIn ? "Sim" : "Não"}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      Procuração: {deal.hasPowerOfAttorney ? "Sim" : "Não"}
                    </span>
                  </div>

                  {/* Próxima Ação Recomendada para o Usuário Atual */}
                  <div
                    className={`rounded-xl p-3 border text-xs ${
                      nextAction.hasDirectAction
                        ? "bg-teal-50/70 border-teal-300 text-teal-950"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between gap-2">
                      <span>
                        {nextAction.hasDirectAction
                          ? "Sua próxima ação nesta negociação:"
                          : "Situação atual da fila:"}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200">
                        Área: {nextAction.responsibleAreaLabel}
                      </span>
                    </div>
                    <p className="font-semibold mt-1">{nextAction.headline}</p>
                    <p className="text-slate-600 mt-0.5">
                      {nextAction.description}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs">
                    {summary.deliveryBlockers.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {summary.deliveryBlockers.length} bloqueio(s) p/ entrega
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Sem bloqueios técnicos
                      </span>
                    )}
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600 font-medium">
                      Tarefas aplicáveis:{" "}
                      {summary.completedApplicableTasksCount}/
                      {summary.applicableTasksCount}
                    </span>
                  </div>

                  <Link
                    href={`/app/negociacoes/${deal.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f172a] hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-white transition"
                  >
                    <span>Abrir Passaporte Digital</span>
                    <ArrowRight className="h-3.5 w-3.5 text-teal-400" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Veículos no Estoque Prontos para Escaneamento ou Nova Venda */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Estoque da Unidade ({vehicles.length} veículos)
            </h2>
            <p className="text-xs text-slate-500">
              Situação do estoque separada da situação da negociação. Clique
              para imprimir etiqueta QR Code ou iniciar negociação.
            </p>
          </div>
          <Link
            href="/app/veiculos"
            className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"
          >
            <span>Gerenciar estoque e importar CSV</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {vehicles.length === 0 && (
          <div className="empty-state">
            <Car className="mx-auto h-10 w-10 text-slate-300" />
            <h2>Seu estoque está pronto para começar.</h2>
            <p>
              {isAdmin
                ? "Cadastre o primeiro veículo para iniciar negociações e gerar as etiquetas de identificação."
                : "Os veículos cadastrados pela administração ficarão disponíveis aqui."}
            </p>
            {isAdmin && (
              <Link
                href="/app/veiculos/novo"
                className="text-sm font-semibold text-teal-700"
              >
                Cadastrar primeiro veículo →
              </Link>
            )}
          </div>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.slice(0, 6).map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                    {v.internalCode}
                  </span>
                  <StockStatusBadge status={v.stockStatus} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2">
                  {v.brand} {v.model} • {v.color}
                </h3>
                <p className="text-xs text-slate-500">
                  {v.trim} • {v.manufacturingYear}/{v.modelYear} • Chassi:{" "}
                  <code className="font-mono">{v.vin}</code>
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <Link
                  href={`/app/veiculos/${v.id}`}
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                >
                  Cadastro & Etiqueta QR
                </Link>
                {v.activeDeal ? (
                  <Link
                    href={`/app/negociacoes/${v.activeDeal.id}`}
                    className="text-xs font-bold text-teal-700 hover:underline"
                  >
                    Passaporte {v.activeDeal.dealNumber} →
                  </Link>
                ) : (
                  <Link
                    href={`/app/negociacoes/nova?vehicleId=${v.id}`}
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    + Iniciar Negociação
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
