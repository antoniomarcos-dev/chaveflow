"use client";

import {
  Branch,
  Vehicle,
  VehicleInputSchema,
  VEHICLE_STOCK_STATUS_LABELS,
} from "@/domain/types";
import { apiRequest } from "@/lib/api-client";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
  type FormEvent,
} from "react";

function Field({
  name,
  label,
  error,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-sm font-semibold text-slate-700"
      >
        {label}
      </label>
      {children}
      {error && (
        <p id={`${name}-error`} className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function VehicleFormClient({
  branches,
  existingVehicle,
  onSaved,
  onCancel,
  lockedIdentity = false,
}: {
  branches: Branch[];
  existingVehicle?: Vehicle;
  onSaved?: () => void;
  onCancel?: () => void;
  lockedIdentity?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(() => ({
    internalCode: existingVehicle?.internalCode || "",
    vin: existingVehicle?.vin || "",
    brand: existingVehicle?.brand || "",
    model: existingVehicle?.model || "",
    trim: existingVehicle?.trim || "",
    manufacturingYear: String(
      existingVehicle?.manufacturingYear || new Date().getFullYear(),
    ),
    modelYear: String(existingVehicle?.modelYear || new Date().getFullYear()),
    color: existingVehicle?.color || "",
    plate: existingVehicle?.plate || "",
    condition: existingVehicle?.condition || "NEW",
    branchId: existingVehicle?.branchId || branches[0]?.id || "",
    stockStatus: existingVehicle?.stockStatus || "AVAILABLE",
    entryDate:
      existingVehicle?.entryDate ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date()),
    internalNotes: existingVehicle?.internalNotes || "",
  }));
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedPhoto, setSavedPhoto] = useState(
    existingVehicle?.photos.find((url) => url !== "/vehicle-placeholder.svg"),
  );
  const initialForm = useRef(JSON.stringify(form));
  const dirty =
    JSON.stringify(form) !== initialForm.current ||
    Boolean(photo) ||
    removePhoto;
  const requiredFields = [
    "internalCode",
    "vin",
    "brand",
    "model",
    "trim",
    "manufacturingYear",
    "modelYear",
    "color",
    "branchId",
    "entryDate",
  ] as const;
  const completed = requiredFields.filter(
    (name) => form[name].trim().length > 0,
  ).length;
  const photoSrc = preview || (!removePhoto ? savedPhoto : null);
  const stockControlled =
    lockedIdentity ||
    Boolean(
      existingVehicle &&
        ["RESERVED", "IN_PREPARATION", "SOLD_DELIVERED"].includes(
          existingVehicle.stockStatus,
        ),
    );

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  function change(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }
  function choosePhoto(file?: File) {
    setPhotoError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Escolha uma foto JPG, PNG ou WEBP.");
      return;
    }
    if (!file.size || file.size > 4 * 1024 * 1024) {
      setPhotoError("A foto deve ter até 4 MB. Escolha uma imagem menor.");
      return;
    }
    setPhoto(file);
    setRemovePhoto(false);
  }
  function input(
    name: keyof typeof form,
    type = "text",
    extra: InputHTMLAttributes<HTMLInputElement> = {},
  ) {
    return (
      <input
        id={name}
        name={name}
        type={type}
        value={form[name]}
        onChange={(e) =>
          change(
            name,
            ["vin", "plate", "internalCode"].includes(name)
              ? e.target.value.toUpperCase()
              : e.target.value,
          )
        }
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        className="form-control"
        {...extra}
      />
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    const parsed = VehicleInputSchema.safeParse({
      ...form,
      plate: form.plate.trim() || null,
    });
    if (!parsed.success) {
      const next = Object.fromEntries(
        parsed.error.issues.map((issue) => [
          String(issue.path[0]),
          issue.message,
        ]),
      );
      setErrors(next);
      setError(
        "Revise os campos destacados. Os dados preenchidos foram mantidos.",
      );
      document.getElementById(Object.keys(next)[0])?.focus();
      return;
    }
    setSaving(true);
    try {
      const body = new FormData();
      body.set("input", JSON.stringify(parsed.data));
      if (existingVehicle) body.set("vehicleId", existingVehicle.id);
      if (photo) body.set("photo", photo);
      body.set("removePhoto", String(removePhoto));
      const result = await apiRequest<{ vehicle: Vehicle }>("/api/vehicles", {
        method: "POST",
        body,
      });
      initialForm.current = JSON.stringify(form);
      setSavedPhoto(result.vehicle.photos[0]);
      setPhoto(null);
      setRemovePhoto(false);
      onSaved?.();
      router.push(`/app/veiculos/${result.vehicle.id}?saved=1`);
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar. Tente novamente.",
      );
      formRef.current?.scrollIntoView({ block: "start" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/app/veiculos"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Veículos e estoque
      </Link>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-8">
        <h1 className="text-2xl font-extrabold">
          {existingVehicle
            ? `Editar ${existingVehicle.internalCode}`
            : "Cadastrar veículo"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Preencha os dados do carro e adicione uma foto para facilitar a
          identificação. Campos com * são obrigatórios.
        </p>
        <div className="my-5 rounded-xl bg-slate-50 p-4">
          <div className="mb-2 flex justify-between text-xs font-semibold">
            <span>Preenchimento do cadastro</span>
            <span>
              {completed} de {requiredFields.length} campos
            </span>
          </div>
          <progress
            className="h-2 w-full accent-[#1684D8]"
            value={completed}
            max={requiredFields.length}
            aria-label="Campos obrigatórios preenchidos"
          />
        </div>
        <form
          ref={formRef}
          onSubmit={submit}
          className="space-y-7"
          aria-busy={saving}
        >
          {error && (
            <div
              role="alert"
              className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
            >
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <strong>O cadastro ainda não foi salvo</strong>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          )}
          <fieldset disabled={saving} className="space-y-4">
            <legend className="mb-4 text-base font-bold">
              1. Identificação do veículo
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="internalCode"
                label="Código interno *"
                error={errors.internalCode}
              >
                {input("internalCode", "text", {
                  required: true,
                  minLength: 3,
                  maxLength: 60,
                  placeholder: "Ex.: PATIO-001",
                })}
              </Field>
              <Field name="vin" label="Chassi (VIN) *" error={errors.vin}>
                {input("vin", "text", {
                  required: true,
                  disabled: lockedIdentity,
                  minLength: 11,
                  maxLength: 17,
                  autoCapitalize: "characters",
                  placeholder: "De 11 a 17 caracteres",
                })}
              </Field>
            </div>
          </fieldset>
          <fieldset
            disabled={saving}
            className="space-y-4 border-t border-slate-200 pt-5"
          >
            <legend className="px-1 text-base font-bold">
              2. Características do carro
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="brand" label="Marca *" error={errors.brand}>
                {input("brand", "text", {
                  required: true,
                  minLength: 2,
                  placeholder: "Ex.: BYD",
                })}
              </Field>
              <Field name="model" label="Modelo *" error={errors.model}>
                {input("model", "text", {
                  required: true,
                  minLength: 2,
                  placeholder: "Ex.: Dolphin",
                })}
              </Field>
              <Field
                name="trim"
                label="Versão / motorização *"
                error={errors.trim}
              >
                {input("trim", "text", {
                  required: true,
                  placeholder: "Ex.: Plus elétrico",
                })}
              </Field>
              <Field name="color" label="Cor *" error={errors.color}>
                {input("color", "text", {
                  required: true,
                  minLength: 2,
                  placeholder: "Ex.: Branco",
                })}
              </Field>
              <Field
                name="manufacturingYear"
                label="Ano de fabricação *"
                error={errors.manufacturingYear}
              >
                {input("manufacturingYear", "number", {
                  required: true,
                  min: 1900,
                  max: new Date().getFullYear() + 1,
                })}
              </Field>
              <Field
                name="modelYear"
                label="Ano do modelo *"
                error={errors.modelYear}
              >
                {input("modelYear", "number", {
                  required: true,
                  min: Number(form.manufacturingYear) || 1900,
                  max: new Date().getFullYear() + 2,
                })}
              </Field>
              <Field name="condition" label="Condição *">
                <select
                  id="condition"
                  disabled={lockedIdentity}
                  value={form.condition}
                  onChange={(e) => change("condition", e.target.value)}
                  className="form-control"
                >
                  <option value="NEW">Novo (0 km)</option>
                  <option value="USED">Usado / seminovo</option>
                </select>
              </Field>
              <Field name="plate" label="Placa (opcional)">
                {input("plate", "text", {
                  maxLength: 8,
                  placeholder: "ABC1D23",
                })}
              </Field>
            </div>
          </fieldset>
          <fieldset
            disabled={saving}
            className="space-y-4 border-t border-slate-200 pt-5"
          >
            <legend className="px-1 text-base font-bold">
              3. Foto do veículo (opcional)
            </legend>
            <p id="photo-help" className="text-sm text-slate-600">
              Escolha uma imagem ou use a câmera do celular. JPG, PNG ou WEBP,
              até 4 MB.
            </p>
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {photoSrc ? (
                  <img
                    src={photoSrc}
                    alt="Prévia da foto do veículo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera
                    aria-hidden="true"
                    className="h-10 w-10 text-slate-400"
                  />
                )}
              </div>
              <div
                className="flex flex-col justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!saving) choosePhoto(e.dataTransfer.files[0]);
                }}
              >
                <label
                  htmlFor="vehicle-photo"
                  className="text-sm font-semibold"
                >
                  {photo ? photo.name : "Adicione uma foto do carro"}
                </label>
                <input
                  ref={fileRef}
                  id="vehicle-photo"
                  tabIndex={-1}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-describedby="photo-help"
                  className="sr-only"
                  onChange={(e) => {
                    choosePhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold"
                >
                  <Upload className="h-4 w-4" />
                  {photoSrc ? "Trocar foto" : "Escolher foto"}
                </button>
                <p className="text-xs text-slate-500">
                  Você também pode arrastar a imagem para esta área.
                </p>
                {photoSrc && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto(null);
                      setRemovePhoto(true);
                      setPhotoError(null);
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover foto
                  </button>
                )}
                {removePhoto && savedPhoto && (
                  <button
                    type="button"
                    onClick={() => setRemovePhoto(false)}
                    className="min-h-11 text-sm font-semibold text-[#0B3B70]"
                  >
                    Desfazer remoção
                  </button>
                )}
              </div>
            </div>
            {photoError && (
              <p role="alert" className="text-sm text-red-700">
                {photoError}
              </p>
            )}
            {photo && (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Foto selecionada. Ela será enviada ao salvar o cadastro.
              </p>
            )}
          </fieldset>
          <fieldset
            disabled={saving}
            className="space-y-4 border-t border-slate-200 pt-5"
          >
            <legend className="px-1 text-base font-bold">
              4. Entrada no estoque
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="branchId" label="Unidade *" error={errors.branchId}>
                <select
                  id="branchId"
                  required
                  disabled={lockedIdentity}
                  value={form.branchId}
                  onChange={(e) => change("branchId", e.target.value)}
                  className="form-control"
                >
                  {!branches.length && (
                    <option value="">Nenhuma unidade ativa</option>
                  )}
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                name="entryDate"
                label="Data de entrada *"
                error={errors.entryDate}
              >
                {input("entryDate", "date", { required: true })}
              </Field>
              <Field name="stockStatus" label="Situação no estoque *">
                <select
                  id="stockStatus"
                  disabled={stockControlled}
                  value={form.stockStatus}
                  onChange={(e) => change("stockStatus", e.target.value)}
                  className="form-control"
                >
                  {Object.entries(VEHICLE_STOCK_STATUS_LABELS)
                    .filter(([status]) =>
                      [
                        "AVAILABLE",
                        "BLOCKED",
                        existingVehicle?.stockStatus,
                      ].includes(status),
                    )
                    .map(([status, label]) => (
                      <option key={status} value={status}>
                        {label}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            {stockControlled && (
              <p className="text-xs text-slate-500">
                A situação no estoque é atualizada pelas etapas do passaporte
                desta negociação.
              </p>
            )}
            {lockedIdentity && (
              <p className="text-xs text-slate-500">
                Chassi, condição e unidade ficam protegidos enquanto houver
                negociação ativa.
              </p>
            )}
            <details
              className="rounded-xl border border-slate-200 p-4"
              open={form.internalNotes ? true : undefined}
            >
              <summary className="cursor-pointer text-sm font-semibold">
                Observações internas (opcional)
              </summary>
              <label
                htmlFor="internalNotes"
                className="mt-3 block text-xs text-slate-600"
              >
                Informações para a equipe da concessionária
              </label>
              <textarea
                id="internalNotes"
                rows={3}
                value={form.internalNotes}
                onChange={(e) => change("internalNotes", e.target.value)}
                className="form-control mt-2"
              />
            </details>
          </fieldset>
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white py-4">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="min-h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold"
              >
                Cancelar
              </button>
            ) : (
              <Link
                href="/app/veiculos"
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-5 text-sm font-semibold"
              >
                Cancelar
              </Link>
            )}
            <button
              type="submit"
              disabled={saving || !branches.length}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1684D8] px-5 text-sm font-bold text-white hover:bg-[#126FB8] disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving
                ? "Salvando veículo…"
                : existingVehicle
                  ? "Salvar alterações"
                  : "Cadastrar veículo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
