"use client";

import type { VehicleWithDealStatus } from "@/application/vehicle-service";
import {
  Branch,
  Customer,
  Deal,
  DocumentRequirement,
  PAYMENT_METHOD_LABELS,
  TaskTemplate,
  TradeInVehicle,
} from "@/domain/types";
import { evaluateApplicabilityConditions } from "@/domain/workflow-engine";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Car,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Save,
  SlidersHorizontal,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function cleanHumanReason(reason: string | null): string {
  if (!reason) return "";
  return reason
    .replace(/\s*\([a-zA-Z0-9_]+\s*=\s*[^)]+\)/g, "")
    .replace(/\b(TASK|DOC)_[A-Z0-9_]+\b/g, "")
    .trim();
}

export function GuidedDealWizardClient({
  availableVehicles,
  customers,
  branches,
  sellers,
  taskTemplates,
  documentRequirements = [],
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
  documentRequirements?: DocumentRequirement[];
  defaultSellerId: string;
  defaultBranchId: string;
  preselectedVehicleId?: string;
  existingDraft?: Deal;
  existingDraftTradeIn?: TradeInVehicle | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submissionId] = useState(() => crypto.randomUUID());

  // Passo 1: Veículo + Confirmação explícita
  const [vehicleId, setVehicleId] = useState(
    existingDraft?.vehicleId ||
      preselectedVehicleId ||
      availableVehicles[0]?.id ||
      "",
  );
  const [vehicleConfirmed, setVehicleConfirmed] = useState<boolean>(
    Boolean(existingDraft?.vehicleId || preselectedVehicleId),
  );

  // Passo 2: Comprador (determina automaticamente PF/PJ)
  const initialCustomerMode =
    existingDraft?.customerId || customers.length > 0 ? "EXISTING" : "NEW";
  const initialCustomerId =
    existingDraft?.customerId || customers[0]?.id || "";

  const [customerMode, setCustomerMode] = useState<"EXISTING" | "NEW">(
    initialCustomerMode,
  );
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [newPersonType, setNewPersonType] = useState<"PF" | "PJ">(
    existingDraft?.buyerType || "PF",
  );
  const [newDocNumber, setNewDocNumber] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");

  // Passo 3: Condições comerciais + Responsável e Unidade (auto-preenchidos quando únicos)
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

  const [sellerId, setSellerId] = useState(
    existingDraft?.sellerId ||
      (sellers.length === 1 ? sellers[0].id : defaultSellerId),
  );
  const [branchId, setBranchId] = useState(
    existingDraft?.branchId ||
      (branches.length === 1 ? branches[0].id : defaultBranchId),
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedVehicle = availableVehicles.find((v) => v.id === vehicleId);
  const selectedExistingCustomer = customers.find((c) => c.id === customerId);

  // Tipo de comprador sincronizado com o cadastro do comprador (sem redundância)
  const effectiveBuyerType: "PF" | "PJ" =
    customerMode === "EXISTING"
      ? (selectedExistingCustomer?.personType ?? "PF")
      : newPersonType;

  // Financiamento sincronizado com a modalidade de pagamento
  const effectiveHasFinancing =
    paymentMethod === "FINANCING"
      ? true
      : paymentMethod === "CASH"
        ? false
        : hasFinancing;

  const evalContext = {
    buyerType: effectiveBuyerType,
    paymentMethod,
    hasFinancing: effectiveHasFinancing,
    hasTradeIn,
    hasPowerOfAttorney,
    vehicleCondition: selectedVehicle?.condition || ("NEW" as const),
  };

  const taskPreviews = taskTemplates.map((tpl) => {
    const evalRes = evaluateApplicabilityConditions(
      tpl.applicabilityConditions,
      evalContext,
    );
    return {
      template: tpl,
      applicable: evalRes.applicable,
      waivedReason: cleanHumanReason(evalRes.waivedReason),
    };
  });

  const applicableDocs = documentRequirements.filter(
    (dr) =>
      evaluateApplicabilityConditions(dr.applicabilityConditions, evalContext)
        .applicable,
  );

  // Alertas de conferência para a etapa 4 (Revisão)
  const reviewAttentionItems: string[] = [];
  if (!vehicleConfirmed) {
    reviewAttentionItems.push(
      "Confirme explicitamente o veículo selecionado na Etapa 1.",
    );
  }
  if (customerMode === "NEW") {
    const cleanDigits = newDocNumber.replace(/\D/g, "");
    if (!newFullName.trim()) {
      reviewAttentionItems.push("Informe o nome completo ou razão social do comprador.");
    }
    if (effectiveBuyerType === "PF" && cleanDigits.length !== 11) {
      reviewAttentionItems.push("O CPF do comprador PF deve conter 11 dígitos.");
    }
    if (effectiveBuyerType === "PJ" && cleanDigits.length !== 14) {
      reviewAttentionItems.push("O CNPJ do comprador PJ deve conter 14 dígitos.");
    }
    if (!newEmail.trim()) {
      reviewAttentionItems.push("Informe o e-mail do comprador.");
    }
  }
  if (effectiveHasFinancing && !financingInstitution.trim()) {
    reviewAttentionItems.push(
      "Informe o nome da instituição financeira do financiamento.",
    );
  }
  if (hasTradeIn && (!tradeInBrand.trim() || !tradeInModel.trim() || !tradeInPlate.trim() || !tradeInVin.trim() || tradeInValue <= 0)) {
    reviewAttentionItems.push(
      "Preencha todos os dados obrigatórios do veículo usado recebido na troca (marca, modelo, placa, chassi e valor).",
    );
  }
  if (hasPowerOfAttorney && (!attorneyName.trim() || !attorneyDocument.trim())) {
    reviewAttentionItems.push(
      "Informe o nome completo e o CPF do representante legal por procuração.",
    );
  }
  if (expectedDeliveryDate) {
    reviewAttentionItems.push(
      `Data desejada de entrega (${expectedDeliveryDate}) é uma expectativa comercial e só será exibida ao comprador após confirmação formal da Liberação.`,
    );
  }

  async function submitDeal(saveAsDraft: boolean) {
    setError(null);
    if (!saveAsDraft && !vehicleConfirmed) {
      setError(
        "Confirme explicitamente os dados do veículo selecionado antes de abrir o Passaporte Digital.",
      );
      setStep(1);
      return;
    }
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
            buyerType: effectiveBuyerType,
            paymentMethod,
            hasFinancing: effectiveHasFinancing,
            financingInstitution: effectiveHasFinancing
              ? financingInstitution
              : null,
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
        router.push("/app/negociacoes?status=RASCUNHO");
      } else {
        router.push(`/app/negociacoes/${data.deal.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha de conexão ao salvar a negociação.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedSellerName =
    sellers.find((s) => s.id === sellerId)?.fullName || "Vendedor";
  const selectedBranchName =
    branches.find((b) => b.id === branchId)?.name || "Unidade";

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app/negociacoes"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#0B3B70]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para negociações</span>
        </Link>

        {/* Único comando consistente para salvar rascunho */}
        <button
          type="button"
          disabled={submitting || !vehicleId}
          onClick={() => submitDeal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-[#172B3A] disabled:opacity-50 transition"
        >
          <Save className="h-3.5 w-3.5 text-[#0B3B70]" />
          <span>Salvar rascunho</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#172B3A]">
            Nova negociação
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Preencha os 4 passos para gerar o Passaporte Digital do veículo.
          </p>
        </div>

        {/* Barra de 4 Passos */}
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            { num: 1 as const, label: "1. Veículo" },
            { num: 2 as const, label: "2. Comprador" },
            { num: 3 as const, label: "3. Condições comerciais" },
            { num: 4 as const, label: "4. Revisão" },
          ].map((item) => (
            <li key={item.num}>
              <button
                type="button"
                onClick={() => setStep(item.num)}
                className={`w-full rounded-xl p-2.5 text-left font-bold border transition ${
                  step === item.num
                    ? "bg-[#0B3B70] text-white border-[#0B3B70] shadow-2xs"
                    : step > item.num
                      ? "bg-[#EAF3FC] text-[#0B3B70] border-[#1684D8]/30"
                      : "bg-slate-50 text-slate-600 border-slate-200"
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
              <p className="font-bold">Não foi possível concluir a operação</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* PASSO 1: VEÍCULO */}
        {step === 1 && (
          <div className="space-y-4 pt-1">
            <div>
              <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
                <Car className="h-5 w-5 text-[#1684D8]" />
                <span>1. Selecionar e confirmar o veículo</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Somente veículos com estoque disponível e sem negociação ativa
                aparecem para venda.
              </p>
            </div>

            {availableVehicles.length === 0 ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
                Nenhum veículo disponível para venda no momento. Verifique o
                estoque em{" "}
                <Link href="/app/veiculos" className="font-bold underline">
                  Veículos
                </Link>
                .
              </div>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  {availableVehicles.map((v) => {
                    const isSelected = v.id === vehicleId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setVehicleId(v.id);
                          setVehicleConfirmed(true);
                        }}
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
                        <div className="text-[11px] font-mono text-slate-600 mt-1">
                          Chassi: {v.vin}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedVehicle && (
                  <div className="rounded-xl border border-[#1684D8]/35 bg-[#EAF3FC]/70 p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={vehicleConfirmed}
                        onChange={(e) => setVehicleConfirmed(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0B3B70]"
                      />
                      <span className="text-xs text-[#172B3A] leading-relaxed">
                        <strong>Confirmação do veículo selecionado:</strong>{" "}
                        confirmo que a venda refere-se ao veículo{" "}
                        <strong>
                          {selectedVehicle.brand} {selectedVehicle.model}{" "}
                          {selectedVehicle.trim} ({selectedVehicle.color})
                        </strong>
                        , código <code>{selectedVehicle.internalCode}</code> e
                        chassi <code>{selectedVehicle.vin}</code>.
                      </span>
                    </label>
                  </div>
                )}
              </>
            )}

            <div className="pt-3 flex justify-end">
              <button
                type="button"
                disabled={!vehicleId || !vehicleConfirmed}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#0B3B70] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50 transition"
              >
                <span>Continuar para comprador</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* PASSO 2: COMPRADOR */}
        {step === 2 && (
          <div className="space-y-4 pt-1">
            <div>
              <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
                <User className="h-5 w-5 text-[#1684D8]" />
                <span>2. Identificar o comprador</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                O tipo de pessoa (PF ou PJ) é definido automaticamente pelo
                cadastro do comprador.
              </p>
            </div>

            {customers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCustomerMode("EXISTING")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold border transition ${
                    customerMode === "EXISTING"
                      ? "bg-[#0B3B70] text-white border-[#0B3B70]"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  Selecionar comprador cadastrado
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode("NEW")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold border transition ${
                    customerMode === "NEW"
                      ? "bg-[#0B3B70] text-white border-[#0B3B70]"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  Cadastrar novo comprador
                </button>
              </div>
            )}

            {customerMode === "EXISTING" ? (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="wizard-existing-customer"
                    className="block text-xs font-bold text-[#172B3A]"
                  >
                    Comprador cadastrado
                  </label>
                  <select
                    id="wizard-existing-customer"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#172B3A]"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.personType} — {c.documentNumber})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedExistingCustomer && (
                  <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3.5 text-xs grid sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-500 block">Tipo e documento</span>
                      <strong className="text-[#172B3A]">
                        {selectedExistingCustomer.personType} •{" "}
                        {selectedExistingCustomer.documentNumber}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">E-mail</span>
                      <strong className="text-[#172B3A]">
                        {selectedExistingCustomer.email}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Telefone</span>
                      <strong className="text-[#172B3A]">
                        {selectedExistingCustomer.phone}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4 bg-[#F4F7FA] p-4 rounded-xl border border-slate-200">
                <div>
                  <label
                    htmlFor="wizard-new-person-type"
                    className="block text-xs font-bold text-[#172B3A]"
                  >
                    Tipo de pessoa *
                  </label>
                  <select
                    id="wizard-new-person-type"
                    value={newPersonType}
                    onChange={(e) =>
                      setNewPersonType(e.target.value as "PF" | "PJ")
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  >
                    <option value="PF">Pessoa Física (PF)</option>
                    <option value="PJ">Pessoa Jurídica (PJ)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="wizard-new-doc"
                    className="block text-xs font-bold text-[#172B3A]"
                  >
                    {newPersonType === "PF" ? "CPF (11 dígitos) *" : "CNPJ (14 dígitos) *"}
                  </label>
                  <input
                    id="wizard-new-doc"
                    type="text"
                    value={newDocNumber}
                    onChange={(e) => setNewDocNumber(e.target.value)}
                    placeholder={
                      newPersonType === "PF"
                        ? "000.000.000-00"
                        : "00.000.000/0001-00"
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="wizard-new-name"
                    className="block text-xs font-bold text-[#172B3A]"
                  >
                    {newPersonType === "PF"
                      ? "Nome completo *"
                      : "Razão social *"}
                  </label>
                  <input
                    id="wizard-new-name"
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="wizard-new-email"
                    className="block text-xs font-bold text-[#172B3A]"
                  >
                    E-mail *
                  </label>
                  <input
                    id="wizard-new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="wizard-new-phone"
                    className="block text-xs font-bold text-[#172B3A]"
                  >
                    Telefone / WhatsApp *
                  </label>
                  <input
                    id="wizard-new-phone"
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="wizard-new-address"
                    className="block text-xs font-bold text-[#172B3A]"
                  >
                    Endereço completo
                  </label>
                  <input
                    id="wizard-new-address"
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  />
                </div>
              </div>
            )}

            <div className="pt-3 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                ← Voltar
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#0B3B70] px-5 py-2.5 text-xs font-bold text-white transition"
              >
                <span>Continuar para condições comerciais</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* PASSO 3: CONDIÇÕES COMERCIAIS E RESPONSÁVEL */}
        {step === 3 && (
          <div className="space-y-4 pt-1">
            <div>
              <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-[#1684D8]" />
                <span>3. Condições comerciais</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Informe a forma de pagamento e marque apenas as condições que se
                aplicam a esta venda.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="wizard-payment-method"
                  className="block text-xs font-bold text-[#172B3A]"
                >
                  Modalidade de pagamento *
                </label>
                <select
                  id="wizard-payment-method"
                  value={paymentMethod}
                  onChange={(e) => {
                    const pm = e.target.value as
                      | "CASH"
                      | "FINANCING"
                      | "CONSORTIUM"
                      | "LEASING";
                    setPaymentMethod(pm);
                    if (pm === "FINANCING") setHasFinancing(true);
                    if (pm === "CASH") setHasFinancing(false);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#172B3A]"
                >
                  <option value="CASH">À Vista (PIX / TED)</option>
                  <option value="FINANCING">Financiamento Bancário</option>
                  <option value="CONSORTIUM">Carta de Consórcio</option>
                  <option value="LEASING">Arrendamento / Leasing</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="wizard-expected-delivery"
                  className="block text-xs font-bold text-[#172B3A]"
                >
                  Expectativa de entrega{" "}
                  <span className="font-normal text-slate-500">
                    (opcional, uso interno)
                  </span>
                </label>
                <input
                  id="wizard-expected-delivery"
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#172B3A]"
                />
              </div>
            </div>

            {/* Se Consórcio ou Leasing, permite indicar financiamento complementar */}
            {(paymentMethod === "CONSORTIUM" ||
              paymentMethod === "LEASING") && (
              <div className="rounded-xl border border-slate-200 bg-[#F4F7FA] p-3.5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasFinancing}
                    onChange={(e) => setHasFinancing(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#1684D8]"
                  />
                  <span className="text-xs font-bold text-[#172B3A]">
                    Possui financiamento complementar vinculado
                  </span>
                </label>
              </div>
            )}

            {/* Instituição financeira exibida somente quando há financiamento */}
            {effectiveHasFinancing && (
              <div className="rounded-xl border border-[#1684D8]/30 bg-[#EAF3FC]/50 p-4">
                <label
                  htmlFor="wizard-financing-bank"
                  className="block text-xs font-bold text-[#172B3A]"
                >
                  Instituição financeira *
                </label>
                <input
                  id="wizard-financing-bank"
                  type="text"
                  value={financingInstitution}
                  onChange={(e) => setFinancingInstitution(e.target.value)}
                  placeholder="Ex.: Banco Santander, Safra, Itaú"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#172B3A]"
                />
              </div>
            )}

            {/* Usado na Troca (campos exibidos somente quando marcado) */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-[#F4F7FA]">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasTradeIn}
                  onChange={(e) => setHasTradeIn(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#1684D8]"
                />
                <span className="text-sm font-bold text-[#172B3A]">
                  Receber veículo usado na troca
                </span>
              </label>

              {hasTradeIn && (
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Marca do usado *
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
                        Modelo do usado *
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
                        Ano modelo *
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
                        Cor do usado *
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
                        Placa *
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
                        Chassi do usado *
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
                        Valor avaliado (R$) *
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
                        Observações da avaliação
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

            {/* Procuração (campos exibidos somente quando marcado) */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-[#F4F7FA]">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasPowerOfAttorney}
                  onChange={(e) => setHasPowerOfAttorney(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#1684D8]"
                />
                <span className="text-sm font-bold text-[#172B3A]">
                  Compra ou retirada representada por procuração
                </span>
              </label>

              {hasPowerOfAttorney && (
                <div className="grid sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Nome completo do procurador *
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
                      CPF do procurador *
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

            {/* Responsável e Unidade: preenchimento automático quando houver uma única opção válida */}
            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              {sellers.length > 1 ? (
                <div>
                  <label
                    htmlFor="wizard-seller"
                    className="block text-xs font-bold text-[#172B3A]"
                  >
                    Vendedor responsável *
                  </label>
                  <select
                    id="wizard-seller"
                    value={sellerId}
                    onChange={(e) => setSellerId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  >
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs">
                  <span className="text-slate-500 block">
                    Vendedor responsável (preenchido automaticamente)
                  </span>
                  <strong className="text-[#172B3A]">
                    {selectedSellerName}
                  </strong>
                </div>
              )}

              {branches.length > 1 ? (
                <div>
                  <label
                    htmlFor="wizard-branch"
                    className="block text-xs font-bold text-[#172B3A]"
                  >
                    Unidade *
                  </label>
                  <select
                    id="wizard-branch"
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#172B3A]"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs">
                  <span className="text-slate-500 block">
                    Unidade (preenchida automaticamente)
                  </span>
                  <strong className="text-[#172B3A]">
                    {selectedBranchName}
                  </strong>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="wizard-notes"
                className="block text-xs font-bold text-[#172B3A]"
              >
                Observações comerciais (opcional)
              </label>
              <textarea
                id="wizard-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-[#172B3A]"
              />
            </div>

            <div className="pt-3 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                ← Voltar
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#0B3B70] px-5 py-2.5 text-xs font-bold text-white transition"
              >
                <span>Revisar negociação</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* PASSO 4: REVISÃO */}
        {step === 4 && (
          <div className="space-y-5 pt-1">
            <div>
              <h2 className="text-base font-bold text-[#172B3A] flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-[#1684D8]" />
                <span>4. Revisão antes de ativar o Passaporte Digital</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Confira o resumo do veículo, comprador, condições e documentos
                que serão solicitados.
              </p>
            </div>

            {/* Resumo Estruturado: Veículo, Comprador, Responsável, Condições */}
            <div className="grid sm:grid-cols-2 gap-3.5 text-xs">
              <div className="rounded-xl border border-slate-200 bg-[#F4F7FA] p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B3B70]">
                  Veículo
                </span>
                <p className="text-sm font-extrabold text-[#172B3A]">
                  {selectedVehicle
                    ? `${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.color})`
                    : "Não selecionado"}
                </p>
                {selectedVehicle && (
                  <p className="text-slate-600">
                    Código <code>{selectedVehicle.internalCode}</code> • Chassi{" "}
                    <code>{selectedVehicle.vin}</code>
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-[#F4F7FA] p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B3B70]">
                  Comprador
                </span>
                <p className="text-sm font-extrabold text-[#172B3A]">
                  {customerMode === "EXISTING"
                    ? selectedExistingCustomer?.fullName || "—"
                    : newFullName || "Novo comprador"}
                </p>
                <p className="text-slate-600">
                  {effectiveBuyerType} •{" "}
                  {customerMode === "EXISTING"
                    ? selectedExistingCustomer?.documentNumber
                    : newDocNumber || "Documento pendente"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-[#F4F7FA] p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B3B70]">
                  Responsável e unidade
                </span>
                <p className="text-sm font-bold text-[#172B3A]">
                  {selectedSellerName}
                </p>
                <p className="text-slate-600">{selectedBranchName}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-[#F4F7FA] p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B3B70]">
                  Condições comerciais
                </span>
                <p className="text-sm font-bold text-[#172B3A]">
                  {PAYMENT_METHOD_LABELS[paymentMethod]}
                  {effectiveHasFinancing && financingInstitution
                    ? ` (${financingInstitution})`
                    : ""}
                </p>
                <p className="text-slate-600">
                  Usado na troca:{" "}
                  {hasTradeIn
                    ? `${tradeInBrand} ${tradeInModel} (${tradeInPlate})`
                    : "Não"}{" "}
                  • Procuração:{" "}
                  {hasPowerOfAttorney ? attorneyName || "Sim" : "Não"}
                </p>
              </div>
            </div>

            {/* Informações que merecem conferência */}
            {reviewAttentionItems.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                  Informações que merecem conferência
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {reviewAttentionItems.map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Documentos aplicáveis */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B3B70] flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-[#1684D8]" />
                Documentos aplicáveis a esta negociação ({applicableDocs.length})
              </h3>
              <ul className="divide-y divide-slate-100 text-xs">
                {applicableDocs.map((doc) => (
                  <li
                    key={doc.id}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold text-[#172B3A]">
                      {doc.title}
                    </span>
                    <span className="rounded bg-[#EAF3FC] px-2 py-0.5 text-[11px] font-semibold text-[#0B3B70]">
                      Obrigatório
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Listagem de atividades futuras e dispensadas recolhida por padrão */}
            <details className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-[#0B3B70]">
                <span>
                  Ver trilha de atividades previstas (
                  {taskPreviews.filter((t) => t.applicable).length} aplicáveis •{" "}
                  {taskPreviews.filter((t) => !t.applicable).length} dispensadas)
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </summary>
              <div className="mt-3 divide-y divide-slate-200 border-t border-slate-200 pt-2">
                {taskPreviews.map(({ template, applicable, waivedReason }) => (
                  <div
                    key={template.id}
                    className="py-2 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div
                        className={
                          applicable
                            ? "font-semibold text-[#172B3A]"
                            : "text-slate-500"
                        }
                      >
                        {template.title}
                      </div>
                      {!applicable && waivedReason && (
                        <div className="text-[11px] text-slate-500">
                          {waivedReason}
                        </div>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${
                        applicable
                          ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {applicable ? "Aplicável" : "Não exigida"}
                    </span>
                  </div>
                ))}
              </div>
            </details>

            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                ← Voltar
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => submitDeal(false)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#0B3B70] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-sm transition disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {submitting
                    ? "Ativando Passaporte Digital..."
                    : "Confirmar e abrir Passaporte Digital"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
