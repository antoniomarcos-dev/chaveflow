import {
  assertInternalStaff,
  assertOrganizationAccess,
  assertPermission,
  canAccessDealRecord,
  hasPermission,
  isVehicleSellable,
} from "@/domain/permissions";
import {
  AuthenticatedContext,
  Deal,
  Vehicle,
  VehicleInputSchema,
  VehicleStockStatus,
} from "@/domain/types";
import { loadDatabaseState, withTransaction } from "@/infrastructure/database";
import crypto from "crypto";

export interface VehicleWithDealStatus extends Vehicle {
  branchName: string;
  activeDeal: Pick<
    Deal,
    "id" | "dealNumber" | "status" | "currentStage" | "buyerType"
  > | null;
  totalDealsCount: number;
}

export function isDealActiveStatus(status: Deal["status"]): boolean {
  return (
    status === "ACTIVE" ||
    status === "ELIGIBLE_FOR_AUTHORIZATION" ||
    status === "DELIVERY_AUTHORIZED"
  );
}

export async function listVehiclesForOrg(params: {
  ctx: AuthenticatedContext;
  search?: string;
  branchId?: string;
  stockStatus?: VehicleStockStatus | "ALL";
}): Promise<VehicleWithDealStatus[]> {
  const { ctx, search, branchId, stockStatus } = params;
  assertInternalStaff(ctx);

  const db = await loadDatabaseState();
  const orgVehicles = db.vehicles.filter(
    (v) => v.organizationId === ctx.organization.id,
  );

  const q = (search || "").trim().toLowerCase();

  return orgVehicles
    .filter((v) => {
      if (branchId && branchId !== "ALL" && v.branchId !== branchId) {
        return false;
      }
      if (
        stockStatus &&
        stockStatus !== "ALL" &&
        v.stockStatus !== stockStatus
      ) {
        return false;
      }
      if (q) {
        const hay = [
          v.internalCode,
          v.vin,
          v.brand,
          v.model,
          v.trim,
          v.color,
          v.plate || "",
          v.qrToken,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((v) => {
      const branch = db.branches.find((b) => b.id === v.branchId);
      const vehicleDeals = db.deals.filter(
        (d) => d.organizationId === ctx.organization.id && d.vehicleId === v.id,
      );
      const activeDeal =
        vehicleDeals.find((d) => isDealActiveStatus(d.status)) ?? null;

      return {
        ...v,
        branchName: branch?.name ?? "Unidade Padrão",
        activeDeal: activeDeal
          ? {
              id: activeDeal.id,
              dealNumber: activeDeal.dealNumber,
              status: activeDeal.status,
              currentStage: activeDeal.currentStage,
              buyerType: activeDeal.buyerType,
            }
          : null,
        totalDealsCount: vehicleDeals.length,
      };
    });
}

export async function getVehicleDetails(params: {
  ctx: AuthenticatedContext;
  vehicleId: string;
}): Promise<{
  vehicle: VehicleWithDealStatus;
  dealHistory: Array<{
    id: string;
    dealNumber: string;
    status: Deal["status"];
    currentStage: Deal["currentStage"];
    customerName: string;
    sellerName: string;
    createdAt: string;
    updatedAt: string;
  }>;
}> {
  const { ctx, vehicleId } = params;
  assertInternalStaff(ctx);

  const db = await loadDatabaseState();
  const vehicle = db.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) {
    throw new Error("Veículo não encontrado.");
  }

  assertOrganizationAccess(ctx, vehicle.organizationId);

  const branch = db.branches.find((b) => b.id === vehicle.branchId);
  const canViewDeals = hasPermission(ctx, "deal:view");
  const allVehicleDeals = canViewDeals
    ? db.deals.filter(
        (d) =>
          d.organizationId === ctx.organization.id &&
          d.vehicleId === vehicle.id,
      )
    : [];

  const activeDeal =
    allVehicleDeals.find((d) => isDealActiveStatus(d.status)) ?? null;

  const visibleDeals = allVehicleDeals.filter((d) =>
    canAccessDealRecord(ctx, d),
  );

  const dealHistory = visibleDeals.map((d) => {
    const customer = db.customers.find((c) => c.id === d.customerId);
    const seller = db.profiles.find((p) => p.id === d.sellerId);
    return {
      id: d.id,
      dealNumber: d.dealNumber,
      status: d.status,
      currentStage: d.currentStage,
      customerName: customer?.fullName ?? "Comprador",
      sellerName: seller?.fullName ?? "Vendedor",
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  });

  return {
    vehicle: {
      ...vehicle,
      branchName: branch?.name ?? "Unidade Padrão",
      activeDeal: activeDeal
        ? {
            id: activeDeal.id,
            dealNumber: activeDeal.dealNumber,
            status: activeDeal.status,
            currentStage: activeDeal.currentStage,
            buyerType: activeDeal.buyerType,
          }
        : null,
      totalDealsCount: visibleDeals.length,
    },
    dealHistory,
  };
}

export async function createOrUpdateVehicle(params: {
  ctx: AuthenticatedContext;
  vehicleId?: string;
  input: unknown;
}): Promise<Vehicle> {
  const { ctx, vehicleId, input } = params;
  assertInternalStaff(ctx);
  assertPermission(
    ctx,
    "vehicle:manage",
    "Sua função não possui permissão para cadastrar ou editar veículos.",
  );

  const parsed = VehicleInputSchema.parse(input);

  return await withTransaction((db) => {
    if (
      !db.branches.some(
        (b) =>
          b.id === parsed.branchId &&
          b.organizationId === ctx.organization.id &&
          b.isActive,
      )
    )
      throw new Error("Unidade inválida para esta organização.");
    const cleanVin = parsed.vin.trim().toUpperCase();
    const cleanInternalCode = parsed.internalCode.trim().toUpperCase();

    const duplicateVin = db.vehicles.find(
      (v) =>
        v.organizationId === ctx.organization.id &&
        v.vin.toUpperCase() === cleanVin &&
        v.id !== vehicleId,
    );
    if (duplicateVin) {
      throw new Error(
        `Chassi duplicado na organização: o chassi '${cleanVin}' já pertence ao veículo ${duplicateVin.internalCode} (${duplicateVin.brand} ${duplicateVin.model}).`,
      );
    }

    const duplicateCode = db.vehicles.find(
      (v) =>
        v.organizationId === ctx.organization.id &&
        v.internalCode.toUpperCase() === cleanInternalCode &&
        v.id !== vehicleId,
    );
    if (duplicateCode) {
      throw new Error(
        `Código interno duplicado na organização: '${cleanInternalCode}' já está em uso.`,
      );
    }

    const nowIso = new Date().toISOString();

    if (vehicleId) {
      const existing = db.vehicles.find((v) => v.id === vehicleId);
      if (!existing) throw new Error("Veículo não encontrado.");
      assertOrganizationAccess(ctx, existing.organizationId);

      existing.internalCode = cleanInternalCode;
      existing.vin = cleanVin;
      existing.brand = parsed.brand;
      existing.model = parsed.model;
      existing.trim = parsed.trim;
      existing.manufacturingYear = parsed.manufacturingYear;
      existing.modelYear = parsed.modelYear;
      existing.color = parsed.color;
      existing.plate = parsed.plate ? parsed.plate.toUpperCase() : null;
      existing.condition = parsed.condition;
      existing.branchId = parsed.branchId;
      existing.photos =
        parsed.photos.length > 0 ? parsed.photos : existing.photos;
      existing.stockStatus = parsed.stockStatus;
      existing.entryDate = parsed.entryDate;
      existing.internalNotes = parsed.internalNotes ?? null;
      existing.updatedAt = nowIso;

      db.auditEvents.unshift({
        id: `aud-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: ctx.organization.id,
        dealId: null,
        vehicleId: existing.id,
        actorId: ctx.profile.id,
        actorName: ctx.profile.fullName,
        actorRole: ctx.roles.join(","),
        action: "VEHICLE_UPDATED",
        entityType: "VEHICLE",
        entityId: existing.id,
        summary: `Cadastro do veículo ${existing.internalCode} (${existing.brand} ${existing.model}) atualizado.`,
        metadata: { vin: existing.vin, stockStatus: existing.stockStatus },
        isCustomerVisible: false,
        createdAt: nowIso,
      });

      return existing;
    }

    const newVehicle: Vehicle = {
      id: `veh-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      branchId: parsed.branchId,
      internalCode: cleanInternalCode,
      qrToken: `qr-${cleanInternalCode.toLowerCase()}-${crypto
        .randomUUID()
        .slice(0, 6)}`,
      vin: cleanVin,
      brand: parsed.brand,
      model: parsed.model,
      trim: parsed.trim,
      manufacturingYear: parsed.manufacturingYear,
      modelYear: parsed.modelYear,
      color: parsed.color,
      plate: parsed.plate ? parsed.plate.toUpperCase() : null,
      condition: parsed.condition,
      photos:
        parsed.photos.length > 0 ? parsed.photos : ["/vehicle-placeholder.svg"],
      stockStatus: parsed.stockStatus,
      entryDate: parsed.entryDate,
      internalNotes: parsed.internalNotes ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.vehicles.unshift(newVehicle);

    db.auditEvents.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: ctx.organization.id,
      dealId: null,
      vehicleId: newVehicle.id,
      actorId: ctx.profile.id,
      actorName: ctx.profile.fullName,
      actorRole: ctx.roles.join(","),
      action: "VEHICLE_CREATED",
      entityType: "VEHICLE",
      entityId: newVehicle.id,
      summary: `Novo veículo cadastrado no estoque: ${newVehicle.internalCode} (${newVehicle.brand} ${newVehicle.model} — Chassi ${newVehicle.vin}).`,
      metadata: { vin: newVehicle.vin, qrToken: newVehicle.qrToken },
      isCustomerVisible: false,
      createdAt: nowIso,
    });

    return newVehicle;
  });
}

// ============================================================================
// IMPORTAÇÃO DE VEÍCULOS VIA CSV COM PRÉVIA, VALIDAÇÃO E RELATÓRIO DE ERROS
// ============================================================================

export interface CsvVehicleRowReport {
  rowNumber: number;
  rawLine: string;
  valid: boolean;
  errors: string[];
  parsedVehicle?: {
    internalCode: string;
    vin: string;
    brand: string;
    model: string;
    trim: string;
    manufacturingYear: number;
    modelYear: number;
    color: string;
    plate: string | null;
    condition: "NEW" | "USED";
    entryDate: string;
    internalNotes: string | null;
  };
}

export interface CsvImportResult {
  mode: "PREVIEW" | "COMMIT";
  totalRows: number;
  validCount: number;
  errorCount: number;
  importedCount: number;
  rows: CsvVehicleRowReport[];
}

export async function processVehicleCsvImport(params: {
  ctx: AuthenticatedContext;
  csvText: string;
  branchId: string;
  commit: boolean;
}): Promise<CsvImportResult> {
  const { ctx, csvText, branchId, commit } = params;
  assertInternalStaff(ctx);
  assertPermission(ctx, "vehicle:manage");

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error("O conteúdo CSV enviado está vazio.");
  }

  // Ignora linha de cabeçalho se começar com codigo_interno ou internalCode
  const startIdx =
    lines[0].toLowerCase().includes("chassi") ||
    lines[0].toLowerCase().includes("vin") ||
    lines[0].toLowerCase().includes("internalcode") ||
    lines[0].toLowerCase().includes("codigo")
      ? 1
      : 0;

  const dataLines = lines.slice(startIdx);
  const db = await loadDatabaseState();
  const existingVins = new Set(
    db.vehicles
      .filter((v) => v.organizationId === ctx.organization.id)
      .map((v) => v.vin.toUpperCase()),
  );
  const existingCodes = new Set(
    db.vehicles
      .filter((v) => v.organizationId === ctx.organization.id)
      .map((v) => v.internalCode.toUpperCase()),
  );

  const seenVinsInBatch = new Set<string>();
  const seenCodesInBatch = new Set<string>();
  const rows: CsvVehicleRowReport[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const rawLine = dataLines[i];
    const rowNumber = startIdx + i + 1;
    const cols = rawLine.split(/[;,]/).map((c) => c.trim());

    // Formato esperado: codigo_interno;chassi;marca;modelo;versao;ano_fab;ano_mod;cor;condicao;placa;data_entrada;observacoes
    if (cols.length < 9) {
      rows.push({
        rowNumber,
        rawLine,
        valid: false,
        errors: [
          "Número insuficiente de colunas. Esperado: codigo_interno;chassi;marca;modelo;versao;ano_fab;ano_mod;cor;condicao;[placa];[data_entrada];[obs]",
        ],
      });
      continue;
    }

    const [
      internalCode,
      vin,
      brand,
      model,
      trim,
      mfgYearStr,
      modYearStr,
      color,
      condRaw,
      plateRaw,
      entryDateRaw,
      notesRaw,
    ] = cols;

    const conditionNormalized =
      condRaw?.toUpperCase() === "USADO" || condRaw?.toUpperCase() === "USED"
        ? "USED"
        : "NEW";

    const candidate = {
      internalCode: (internalCode || "").toUpperCase(),
      vin: (vin || "").toUpperCase(),
      brand: brand || "",
      model: model || "",
      trim: trim || "",
      manufacturingYear: Number(mfgYearStr),
      modelYear: Number(modYearStr),
      color: color || "",
      plate: plateRaw ? plateRaw.toUpperCase() : null,
      condition: conditionNormalized as "NEW" | "USED",
      branchId,
      photos: ["/vehicle-placeholder.svg"],
      stockStatus: "AVAILABLE" as const,
      entryDate: entryDateRaw || new Date().toISOString().slice(0, 10),
      internalNotes: notesRaw || null,
    };

    const zodRes = VehicleInputSchema.safeParse(candidate);
    const rowErrors: string[] = [];

    if (!zodRes.success) {
      for (const issue of zodRes.error.issues) {
        rowErrors.push(issue.message);
      }
    }

    if (existingVins.has(candidate.vin) || seenVinsInBatch.has(candidate.vin)) {
      rowErrors.push(
        `Chassi '${candidate.vin}' duplicado no estoque ou no próprio arquivo CSV.`,
      );
    }

    if (
      existingCodes.has(candidate.internalCode) ||
      seenCodesInBatch.has(candidate.internalCode)
    ) {
      rowErrors.push(
        `Código interno '${candidate.internalCode}' duplicado no estoque ou no arquivo CSV.`,
      );
    }

    if (rowErrors.length > 0) {
      rows.push({
        rowNumber,
        rawLine,
        valid: false,
        errors: rowErrors,
      });
    } else {
      seenVinsInBatch.add(candidate.vin);
      seenCodesInBatch.add(candidate.internalCode);
      rows.push({
        rowNumber,
        rawLine,
        valid: true,
        errors: [],
        parsedVehicle: {
          internalCode: candidate.internalCode,
          vin: candidate.vin,
          brand: candidate.brand,
          model: candidate.model,
          trim: candidate.trim,
          manufacturingYear: candidate.manufacturingYear,
          modelYear: candidate.modelYear,
          color: candidate.color,
          plate: candidate.plate,
          condition: candidate.condition,
          entryDate: candidate.entryDate,
          internalNotes: candidate.internalNotes,
        },
      });
    }
  }

  const validRows = rows.filter((r) => r.valid && r.parsedVehicle);
  let importedCount = 0;

  if (commit && validRows.length > 0) {
    await withTransaction((txDb) => {
      const nowIso = new Date().toISOString();
      for (const vr of validRows) {
        const pv = vr.parsedVehicle!;
        txDb.vehicles.unshift({
          id: `veh-${crypto.randomUUID().slice(0, 8)}`,
          organizationId: ctx.organization.id,
          branchId,
          internalCode: pv.internalCode,
          qrToken: `qr-${pv.internalCode.toLowerCase()}-${crypto
            .randomUUID()
            .slice(0, 6)}`,
          vin: pv.vin,
          brand: pv.brand,
          model: pv.model,
          trim: pv.trim,
          manufacturingYear: pv.manufacturingYear,
          modelYear: pv.modelYear,
          color: pv.color,
          plate: pv.plate,
          condition: pv.condition,
          photos: ["/vehicle-placeholder.svg"],
          stockStatus: "AVAILABLE",
          entryDate: pv.entryDate,
          internalNotes: pv.internalNotes,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        importedCount++;
      }

      txDb.auditEvents.unshift({
        id: `aud-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: ctx.organization.id,
        dealId: null,
        vehicleId: null,
        actorId: ctx.profile.id,
        actorName: ctx.profile.fullName,
        actorRole: ctx.roles.join(","),
        action: "VEHICLES_CSV_IMPORTED",
        entityType: "VEHICLE_BATCH",
        entityId: branchId,
        summary: `Importação CSV concluída: ${importedCount} veículo(s) importado(s) com sucesso.`,
        metadata: { totalRows: rows.length, importedCount },
        isCustomerVisible: false,
        createdAt: nowIso,
      });
    });
  }

  return {
    mode: commit ? "COMMIT" : "PREVIEW",
    totalRows: rows.length,
    validCount: validRows.length,
    errorCount: rows.length - validRows.length,
    importedCount,
    rows,
  };
}

// ============================================================================
// FUNCIONALIDADE 3 — RESOLUÇÃO DE ESCANEAMENTO DE QR CODE INTERNO
// ============================================================================

export type QrScanResolutionResult =
  | {
      outcome: "UNAUTHENTICATED";
      message: string;
      loginRedirectUrl: string;
    }
  | {
      outcome: "UNKNOWN_CODE";
      scannedCode: string;
      message: string;
    }
  | {
      outcome: "IDENTIFIED_WITH_ACTIVE_DEAL";
      scannedCode: string;
      vehicle: VehicleWithDealStatus;
      activeDealId: string;
      activeDealNumber: string;
      canAccessDeal: boolean;
      nextStepLabel: string;
      nextStepUrl: string;
    }
  | {
      outcome: "IDENTIFIED_NO_ACTIVE_DEAL";
      scannedCode: string;
      vehicle: VehicleWithDealStatus;
      canStartDeal: boolean;
      nextStepLabel: string;
      nextStepUrl: string;
      vehicleDetailsUrl: string;
    };

export function extractOpaqueTokenFromQrPayload(rawInput: string): string {
  const trimmed = (rawInput || "").trim();
  if (!trimmed) return "";

  // Suporta formatos: "cf://v/qr-pin-byd-001-songplus", URLs com ?code=... ou o próprio token/código interno
  if (trimmed.startsWith("cf://v/")) {
    return trimmed.replace("cf://v/", "").trim();
  }

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const codeParam = url.searchParams.get("code");
      if (codeParam) return codeParam.trim();
      const segs = url.pathname.split("/").filter(Boolean);
      return segs[segs.length - 1] ?? trimmed;
    }
  } catch {
    // Segue como string direta
  }

  return trimmed;
}

export async function resolveScannedVehicleCode(params: {
  ctx: AuthenticatedContext | null;
  rawQrCode: string;
}): Promise<QrScanResolutionResult> {
  const token = extractOpaqueTokenFromQrPayload(params.rawQrCode);

  // Regra: Se o usuário não estiver autenticado, solicitar login sem expor dados restritos
  if (!params.ctx) {
    return {
      outcome: "UNAUTHENTICATED",
      message:
        "Autenticação obrigatória para identificar o veículo e acessar dados operacionais. Faça login para continuar.",
      loginRedirectUrl: `/login?redirect=${encodeURIComponent(
        `/app/escanear?code=${encodeURIComponent(token)}`,
      )}`,
    };
  }

  // Regra: O QR Code do veículo não concede acesso à área do comprador
  if (params.ctx.profile.isCustomerOnly) {
    return {
      outcome: "UNKNOWN_CODE",
      scannedCode: token,
      message:
        "O QR Code operacional do veículo é exclusivo para a equipe interna da concessionária e não concede acesso pela conta de cliente.",
    };
  }

  const db = await loadDatabaseState();
  const normalizedToken = token.toLowerCase();

  // Busca somente dentro da organização do usuário autenticado (Isolamento Multi-Tenant)
  const vehicle = db.vehicles.find(
    (v) =>
      v.organizationId === params.ctx!.organization.id &&
      (v.qrToken.toLowerCase() === normalizedToken ||
        v.internalCode.toLowerCase() === normalizedToken ||
        v.vin.toLowerCase() === normalizedToken),
  );

  if (!vehicle) {
    return {
      outcome: "UNKNOWN_CODE",
      scannedCode: token,
      message: `Código '${token}' não reconhecido no estoque da organização ${params.ctx.organization.name}. Nenhum dado foi criado automaticamente.`,
    };
  }

  const details = await getVehicleDetails({
    ctx: params.ctx,
    vehicleId: vehicle.id,
  });

  if (details.vehicle.activeDeal) {
    const activeDealRecord = db.deals.find(
      (d) => d.id === details.vehicle.activeDeal!.id,
    );
    const canAccessDeal =
      hasPermission(params.ctx, "deal:view") &&
      Boolean(
        activeDealRecord && canAccessDealRecord(params.ctx, activeDealRecord),
      );
    return {
      outcome: "IDENTIFIED_WITH_ACTIVE_DEAL",
      scannedCode: token,
      vehicle: details.vehicle,
      activeDealId: details.vehicle.activeDeal.id,
      activeDealNumber: details.vehicle.activeDeal.dealNumber,
      canAccessDeal,
      nextStepLabel: canAccessDeal
        ? `Abrir Passaporte Digital (${details.vehicle.activeDeal.dealNumber})`
        : "Negociação vinculada a outro responsável — Ver veículo",
      nextStepUrl: canAccessDeal
        ? `/app/negociacoes/${details.vehicle.activeDeal.id}`
        : `/app/veiculos/${vehicle.id}`,
    };
  }

  const sellable = isVehicleSellable(vehicle, false);
  const canStartDeal = hasPermission(params.ctx, "deal:create") && sellable;
  return {
    outcome: "IDENTIFIED_NO_ACTIVE_DEAL",
    scannedCode: token,
    vehicle: details.vehicle,
    canStartDeal,
    nextStepLabel: canStartDeal
      ? "Iniciar Abertura de Negociação"
      : !sellable
        ? "Ver Cadastro do Veículo (indisponível para venda)"
        : "Ver Cadastro do Veículo",
    nextStepUrl: canStartDeal
      ? `/app/negociacoes/nova?vehicleId=${vehicle.id}`
      : `/app/veiculos/${vehicle.id}`,
    vehicleDetailsUrl: `/app/veiculos/${vehicle.id}`,
  };
}
