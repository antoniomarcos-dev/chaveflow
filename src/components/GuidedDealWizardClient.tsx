"use client";

import type { VehicleWithDealStatus } from "@/application/vehicle-service";
import {
  Branch,
  Customer,
  Deal,
  TaskTemplate,
  TradeInVehicle,
} from "@/domain/types";
import { evaluateApplicabilityConditions } from "@/domain/workflow-engine";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Car,
  CheckCircle2,
  FileSpreadsheet,
  Save,
  SlidersHorizontal,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function GuidedDealWizardClient({
  availableVehicles,
  customers,
  branches,
  sellers,
  taskTemplates,
  defaultSellerId,
  defaultBranchId,
  preselectedVehicleId,
  existingDraft,
  existingDraftTradeIn,
}: {
  availableVehicles: VehicleWithDealStatus[];
  customers: Customer[];
  branches: Branch[];
  sellers: Array<{ id: string; fullName: string }>;
  taskTemplates: TaskTemplate[];
  defaultSellerId: string;
  defaultBranchId: string;
  preselectedVehicleId?: string;
  existingDraft?: Deal;
  existingDraftTradeIn?: TradeInVehicle | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [submissionId] = useState(() => crypto.randomUUID());
  const [vehicleId, setVehicleId] = useState(
    existingDraft?.vehicleId ||
      preselectedVehicleId ||
      availableVehicles[0]?.id ||
      "",
  );

  // Passo 2: Comprador
  const [customerMode, setCustomerMode] = useState<"EXISTING" | "NEW">(
    existingDraft?.customerId || customers.length ? "EXISTING" : "NEW",
  );
  const [customerId, setCustomerId] = useState(
    existingDraft?.customerId || customers[0]?.id || "",
  );
  const [newPersonType, setNewPersonType] = useState<"PF" | "PJ">("PF");
  const [newDocNumber, setNewDocNumber] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");

  // Passo 3: Condições da Negociação
  const [buyerType, setBuyerType] = useState<"PF" | "PJ">(
    existingDraft?.buyerType || "PF",
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "FINANCING" | "CONSORTIUM" | "LEASING"
  >(existingDraft?.paymentMethod || "FINANCING");
  const [hasFinancing, setHasFinancing] = useState<boolean>(
    existingDraft ? existingDraft.hasFinancing : true,
  );
  const [financingInstitution, setFinancingInstitution] = useState(
    existingDraft?.financingInstitution || "",
  );
  const [hasTradeIn, setHasTradeIn] = useState<boolean>(
    existingDraft ? existingDraft.hasTradeIn : false,
  );
  const [tradeInBrand, setTradeInBrand] = useState(
    existingDraftTradeIn?.brand || "",
  );
  const [tradeInModel, setTradeInModel] = useState(
    existingDraftTradeIn?.model || "",
  );
  const [tradeInYear, setTradeInYear] = useState(
    existingDraftTradeIn?.modelYear || new Date().getFullYear(),
  );
  const [tradeInColor, setTradeInColor] = useState(
    existingDraftTradeIn?.color || "",
  );
  const [tradeInPlate, setTradeInPlate] = useState(
    existingDraftTradeIn?.plate || "",
  );
  const [tradeInVin, setTradeInVin] = useState(existingDraftTradeIn?.vin || "");
  const [tradeInValue, setTradeInValue] = useState(
    existingDraftTradeIn?.appraisedValue || 0,
  );
  const [tradeInNotes, setTradeInNotes] = useState(
    existingDraftTradeIn?.notes || "",
  );

  const [hasPowerOfAttorney, setHasPowerOfAttorney] = useState<boolean>(
    existingDraft ? existingDraft.hasPowerOfAttorney : false,
  );
  const [attorneyName, setAttorneyName] = useState(
    existingDraft?.attorneyName || "",
  );
  const [attorneyDocument, setAttorneyDocument] = useState(
    existingDraft?.attorneyDocument || "",
  );
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    existingDraft?.expectedDeliveryDate || "",
  );
  const [notes, setNotes] = useState(existingDraft?.notes || "");

  // Passo 4: Vendedor e Unidade
  const [sellerId, setSellerId] = useState(
    existingDraft?.sellerId || defaultSellerId,
  );
  const [branchId, setBranchId] = useState(
    existingDraft?.branchId || defaultBranchId,
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedVehicle = availableVehicles.find((v) => v.id === vehicleId);

  // Prévia determinística das tarefas aplicáveis vs dispensadas por regra
  const taskPreviews = taskTemplates.map((tpl) => {
    const evalRes = evaluateApplicabilityConditions(
      tpl.applicabilityConditions,
      {
        buyerType,
        paymentMethod,
        hasFinancing,
        hasTradeIn,
        hasPowerOfAttorney,
        vehicleCondition: selectedVehicle?.condition || "NEW",
      },
    );
    return {
      template: tpl,
      applicable: evalRes.applicable,
      waivedReason: evalRes.waivedReason,
    };
  });

  async function submitDeal(saveAsDraft: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_OR_SAVE_DEAL",
          idempotencyKey: `wiz-${submissionId}-${vehicleId}-${saveAsDraft ? "draft" : "final"}`,
          input: {
            vehicleId,
            branchId,
            sellerId,
            customerMode,
            customerId: customerMode === "EXISTING" ? customerId : undefined,
            newCustomer:
              customerMode === "NEW"
                ? {
                    personType: newPersonType,
                    documentNumber: newDocNumber,
                    fullName: newFullName,
                    email: newEmail,
                    phone: newPhone,
                    address: newAddress,
                  }
                : undefined,
            buyerType: customerMode === "NEW" ? newPersonType : buyerType,
            paymentMethod,
            hasFinancing,
            financingInstitution: hasFinancing ? financingInstitution : null,
            hasTradeIn,
            tradeIn: hasTradeIn
              ? {
                  brand: tradeInBrand,
                  model: tradeInModel,
                  modelYear: tradeInYear,
                  color: tradeInColor,
                  plate: tradeInPlate,
                  vin: tradeInVin,
                  appraisedValue: tradeInValue,
                  notes: tradeInNotes,
                }
              : null,
            hasPowerOfAttorney,
            attorneyName: hasPowerOfAttorney ? attorneyName : null,
            attorneyDocument: hasPowerOfAttorney ? attorneyDocument : null,
            expectedDeliveryDate: expectedDeliveryDate || null,
            notes: notes || null,
            saveAsDraft,
            draftDealId: existingDraft?.id || null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Não foi possível salvar a negociação.");
        return;
      }

      if (saveAsDraft) {
        router.push("/app/negociacoes");
      } else {
        router.push(`/app/negociacoes/${data.deal.id}`);
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/app/negociacoes"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Negociações</span>
        </Link>
        <button
          type="button"
          disabled={submitting || !vehicleId}
          onClick={() => submitDeal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800"
        >
          <Save className="h-3.5 w-3.5 text-amber-600" />
          <span>Salvar Rascunho e Continuar Depois</span>
        </button>
      </div>

      {/* Cabeçalho e Passos do Assistente */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div>
          <span className="eyebrow">Assistente Guiado em 5 Etapas</span>
          <h1 className="text-2xl font-extrabold text-[#172B3A] mt-1">
            Abertura do Passaporte Digital da Negociação
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            As condições informadas definem automaticamente quais tarefas e
            documentos serão exigidos ou dispensados por regra.
          </p>
        </div>

        {/* Barra de Etapas */}
        <ol className="grid grid-cols-5 gap-2 text-xs">
          {[
            { num: 1 as const, label: "1. Veículo" },
            { num: 2 as const, label: "2. Comprador" },
            { num: 3 as const, label: "3. Condições" },
            { num: 4 as const, label: "4. Vendedor" },
            { num: 5 as const, label: "5. Revisar" },
          ].map((item) => (
            <li key={item.num}>
              <button
                type="button"
                onClick={() => setStep(item.num)}
                className={`w-full rounded-xl p-2.5 text-left font-bold border transition ${
                  step === item.num
                    ? "bg-[#1684D8] text-white border-[#1684D8] shadow-2xs"
                    : step > item.num
                      ? "bg-[#EAF3FC] text-[#0B3B70] border-[#1684D8]/30"
                      : "bg-slate-50 text-slate-500 border-slate-200"
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ol>

        {error && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-300 p-4 text-xs text-red-900 flex items-start gap-2.5"
          >
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Verifique os dados informados</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ETAPA 1: CONFIRMAR VEÍCULO */}
        {step === 1 && (
          <div className="space-y-4 pt-2">
            <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
              <Car className="h-5 w-5 text-[#1684D8]" />
              <span>Etapa 1: Confirmar Veículo Vendido</span>
            </h2>
            <p className="text-xs text-slate-600">
              Apenas veículos sem negociação ativa podem iniciar um novo
              passaporte ativo.
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              {availableVehicles.map((v) => {
                const isSelected = v.id === vehicleId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVehicleId(v.id)}
                    className={`text-left rounded-xl border-2 p-4 transition ${
                      isSelected
                        ? "border-[#1684D8] bg-[#EAF3FC]/50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold bg-[#0B3B70] text-white px-2 py-0.5 rounded">
                        {v.internalCode}
                      </span>
                      <span className="text-[11px] font-semibold text-[#0B3B70]">
                        {v.condition === "NEW" ? "0km / Novo" : "Seminovo"}
                      </span>
                    </div>
                    <div className="text-sm font-extrabold text-[#172B3A] mt-2">
                      {v.brand} {v.model} ({v.color})
                    </div>
                    <div className="text-xs text-slate-600">
                      {v.trim} • {v.manufacturingYear}/{v.modelYear}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-1">
                      Chassi: {v.vin}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                disabled={!vehicleId}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-5 py-2.5 text-xs font-bold text-white"
              >
                <span>Avançar para Comprador</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 2: SELECIONAR OU CADASTRAR COMPRADOR */}
        {step === 2 && (
          <div className="space-y-4 pt-2">
            <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
              <User className="h-5 w-5 text-[#1684D8]" />
              <span>Etapa 2: Selecionar ou Cadastrar Comprador</span>
            </h2>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCustomerMode("EXISTING")}
                className={`rounded-lg px-4 py-2 text-xs font-bold border ${
                  customerMode === "EXISTING"
                    ? "bg-[#0B3B70] text-white border-[#0B3B70]"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
              >
                Selecionar Comprador Cadastrado
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("NEW")}
                className={`rounded-lg px-4 py-2 text-xs font-bold border ${
                  customerMode === "NEW"
                    ? "bg-[#0B3B70] text-white border-[#0B3B70]"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
              >
                Cadastrar Novo Comprador
              </button>
            </div>

            {customerMode === "EXISTING" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Comprador *
                </label>
                <select
                  value={customerId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setCustomerId(cid);
                    const found = customers.find((c) => c.id === cid);
                    if (found) setBuyerType(found.personType);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-[#172B3A]"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.personType} — {c.documentNumber})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4 bg-[#F4F7FA] p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Tipo de Pessoa *
                  </label>
                  <select
                    value={newPersonType}
                    onChange={(e) => {
                      const pt = e.target.value as "PF" | "PJ";
                      setNewPersonType(pt);
                      setBuyerType(pt);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  >
                    <option value="PF">Pessoa Física (PF)</option>
                    <option value="PJ">Pessoa Jurídica (PJ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    CPF ou CNPJ *
                  </label>
                  <input
                    type="text"
                    value={newDocNumber}
                    onChange={(e) => setNewDocNumber(e.target.value)}
                    placeholder="000.000.000-00"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nome Completo ou Razão Social *
                  </label>
                  <input
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    E-mail *
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewNewEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Endereço
                  </label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
              >
                ← Voltar
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-5 py-2.5 text-xs font-bold text-white"
              >
                <span>Avançar para Condições da Negociação</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 3: CONDIÇÕES DA NEGOCIAÇÃO */}
        {step === 3 && (
          <div className="space-y-5 pt-2">
            <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-[#1684D8]" />
              <span>
                Etapa 3: Condições da Negociação (Determinam a Trilha)
              </span>
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Tipo de Comprador
                </label>
                <select
                  value={buyerType}
                  onChange={(e) => setBuyerType(e.target.value as "PF" | "PJ")}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#172B3A]"
                >
                  <option value="PF">Pessoa Física (PF)</option>
                  <option value="PJ">Pessoa Jurídica (PJ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Modalidade Principal de Pagamento
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    const pm = e.target.value as
                      "CASH" | "FINANCING" | "CONSORTIUM" | "LEASING";
                    setPaymentMethod(pm);
                    if (pm === "FINANCING") setHasFinancing(true);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#172B3A]"
                >
                  <option value="CASH">À Vista (PIX / TED)</option>
                  <option value="FINANCING">Financiamento Bancário</option>
                  <option value="CONSORTIUM">Carta de Consórcio</option>
                  <option value="LEASING">Arrendamento / Leasing</option>
                </select>
              </div>
            </div>

            {/* Condição 1: Existência de Financiamento */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-[#F4F7FA]">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasFinancing}
                  onChange={(e) => setHasFinancing(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#1684D8]"
                />
                <span className="text-sm font-bold text-[#172B3A]">
                  Possui financiamento bancário vinculado?
                </span>
              </label>
              {hasFinancing && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Instituição Financeira *
                  </label>
                  <input
                    type="text"
                    value={financingInstitution}
                    onChange={(e) => setFinancingInstitution(e.target.value)}
                    placeholder="Ex: Banco Santander / Safra / Alfa"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
              )}
            </div>

            {/* Condição 2: Veículo Usado na Troca (Registrado Separadamente) */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-[#F4F7FA]">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasTradeIn}
                  onChange={(e) => setHasTradeIn(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#1684D8]"
                />
                <span className="text-sm font-bold text-[#172B3A]">
                  Possui veículo usado recebido na troca?
                </span>
              </label>

              {hasTradeIn && (
                <div className="pt-2 border-t border-slate-200 space-y-3">
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-950 font-medium">
                    Atenção: Os dados abaixo referem-se exclusivamente ao{" "}
                    <strong>veículo usado recebido na troca</strong> e são
                    gravados em entidade separada do veículo vendido (
                    {selectedVehicle?.internalCode}).
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Marca do Usado *
                      </label>
                      <input
                        type="text"
                        value={tradeInBrand}
                        onChange={(e) => setTradeInBrand(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#172B3A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Modelo do Usado *
                      </label>
                      <input
                        type="text"
                        value={tradeInModel}
                        onChange={(e) => setTradeInModel(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#172B3A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Ano Modelo *
                      </label>
                      <input
                        type="number"
                        value={tradeInYear}
                        onChange={(e) => setTradeInYear(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#172B3A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Cor do Usado *
                      </label>
                      <input
                        type="text"
                        value={tradeInColor}
                        onChange={(e) => setTradeInColor(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#172B3A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Placa do Usado *
                      </label>
                      <input
                        type="text"
                        value={tradeInPlate}
                        onChange={(e) =>
                          setTradeInPlate(e.target.value.toUpperCase())
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-[#172B3A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Chassi do Usado *
                      </label>
                      <input
                        type="text"
                        value={tradeInVin}
                        onChange={(e) =>
                          setTradeInVin(e.target.value.toUpperCase())
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-[#172B3A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Valor Avaliado (R$) *
                      </label>
                      <input
                        type="number"
                        value={tradeInValue}
                        onChange={(e) =>
                          setTradeInValue(Number(e.target.value))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#172B3A]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Observações da Avaliação do Usado
                      </label>
                      <input
                        type="text"
                        value={tradeInNotes}
                        onChange={(e) => setTradeInNotes(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#172B3A]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Condição 3: Representante por Procuração */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-[#F4F7FA]">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasPowerOfAttorney}
                  onChange={(e) => setHasPowerOfAttorney(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#1684D8]"
                />
                <span className="text-sm font-bold text-[#172B3A]">
                  Possui representante legal por procuração?
                </span>
              </label>

              {hasPowerOfAttorney && (
                <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Nome Completo do Procurador *
                    </label>
                    <input
                      type="text"
                      value={attorneyName}
                      onChange={(e) => setAttorneyName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#172B3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      CPF do Procurador *
                    </label>
                    <input
                      type="text"
                      value={attorneyDocument}
                      onChange={(e) => setAttorneyDocument(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#172B3A]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Data desejada de entrega (identificada como expectativa não confirmada) */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Data Desejada de Entrega{" "}
                  <span className="text-amber-700 font-bold">
                    (Expectativa não confirmada)
                  </span>
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#172B3A]"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Não é exibida ao cliente como previsão confirmada até
                  validação formal da Liberação.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Observações Comerciais
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs text-[#172B3A]"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                ← Voltar
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-5 py-2.5 text-xs font-bold text-white transition"
              >
                <span>Avançar para Vendedor e Unidade</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 4: VENDEDOR E UNIDADE */}
        {step === 4 && (
          <div className="space-y-4 pt-2">
            <h2 className="text-base font-bold text-[#172B3A]">
              Etapa 4: Definir Vendedor Responsável e Unidade
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Vendedor Responsável *
                </label>
                <select
                  value={sellerId}
                  onChange={(e) => setSellerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-[#172B3A]"
                >
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Unidade da Concessionária *
                </label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-[#172B3A]"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                ← Voltar
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-5 py-2.5 text-xs font-bold text-white transition"
              >
                <span>Avançar para Revisão da Trilha</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 5: REVISAR E CRIAR PASSAPORTE */}
        {step === 5 && (
          <div className="space-y-5 pt-2">
            <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#1684D8]" />
              <span>
                Etapa 5: Revisão da Trilha Gerada pelo Motor de Processos
              </span>
            </h2>

            <div className="rounded-xl bg-[#EAF3FC]/60 border border-[#1684D8]/25 p-4 grid sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Veículo Vendido:</span>
                <strong className="text-[#172B3A]">
                  {selectedVehicle
                    ? `${selectedVehicle.internalCode} — ${selectedVehicle.brand} ${selectedVehicle.model}`
                    : "—"}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Condições:</span>
                <strong className="text-[#172B3A]">
                  {buyerType} • {paymentMethod} • Financiamento:{" "}
                  {hasFinancing ? "Sim" : "Não"}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">
                  Troca / Procuração:
                </span>
                <strong className="text-[#172B3A]">
                  Usado:{" "}
                  {hasTradeIn ? `${tradeInBrand} ${tradeInModel}` : "Não"} •
                  Procuração: {hasPowerOfAttorney ? "Sim" : "Não"}
                </strong>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Tarefas que serão instanciadas no Passaporte Digital:
              </h3>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
                {taskPreviews.map(({ template, applicable, waivedReason }) => (
                  <div
                    key={template.id}
                    className={`p-3 flex items-center justify-between gap-3 ${
                      applicable ? "bg-white" : "bg-slate-50 text-slate-500"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-[#172B3A]">
                        {template.title}
                      </div>
                      {!applicable && waivedReason && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {waivedReason}
                        </div>
                      )}
                    </div>
                    {applicable ? (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 font-bold text-emerald-900">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Aplicável
                      </span>
                    ) : (
                      <span className="shrink-0 rounded bg-slate-200 px-2.5 py-0.5 font-semibold text-slate-700">
                        Dispensada por regra
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                ← Voltar
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => submitDeal(true)}
                  className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-[#172B3A]"
                >
                  Salvar como Rascunho
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => submitDeal(false)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md transition"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {submitting
                      ? "Gerando Passaporte Digital..."
                      : "Confirmar e Criar Passaporte Digital"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
