import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import jsQR from "jsqr";
import { buildAuthenticatedContext } from "@/application/auth-service";
import {
  createOrUpdateVehicle,
  getVehicleDetails,
  listVehiclesForOrg,
  processVehicleCsvImport,
  resolveScannedVehicleCode,
} from "@/application/vehicle-service";
import { getVehiclePhoto } from "@/application/vehicle-photo-service";
import { generateVehicleQrLabels } from "@/application/vehicle-qr-service";
import { getCustomerSafeDealView } from "@/application/customer-portal-service";
import {
  loadDatabaseState,
  saveDatabaseState,
} from "@/infrastructure/database";
import { VehicleInputSchema } from "@/domain/types";
import { parseVehicleCsv } from "@/lib/vehicle-csv";
import {
  createInitialSeedState,
  DEMO_BRANCH_ID,
  OTHER_BRANCH_ID,
} from "./fixtures/seed-data";

process.env.CHAVEFLOW_TEST_IN_MEMORY = "true";
const input = {
  internalCode: "PHOTO-001",
  vin: "9BWZZZ377VT004251",
  brand: "BYD",
  model: "Dolphin",
  trim: "Plus",
  manufacturingYear: 2026,
  modelYear: 2027,
  color: "Branco",
  condition: "NEW",
  branchId: DEMO_BRANCH_ID,
  stockStatus: "AVAILABLE",
  entryDate: "2026-11-12",
};
const csv =
  'codigo_interno;chassi;marca;modelo;versao;ano_fab;ano_mod;cor;condicao;placa;data_entrada;observacoes\nCSV-001;9BWZZZ377VT004252;BYD;Dolphin;Plus;2026;2027;Branco;NOVO;;2026-11-12;"Conferir cor; acessórios, manual"';

async function manager() {
  return (await buildAuthenticatedContext("user-gestor"))!;
}
async function photo() {
  return {
    contentBuffer: await sharp({
      create: { width: 100, height: 80, channels: 3, background: "#1684D8" },
    })
      .png()
      .toBuffer(),
    mimeType: "image/png",
    originalFilename: "carro.png",
  };
}

describe("Cadastro de veículos, fotos e etiquetas", () => {
  beforeEach(() => {
    saveDatabaseState(createInitialSeedState());
    vi.stubEnv("CHAVEFLOW_APP_URL", "https://chaveflow.example");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("salva uma foto real, normaliza para WEBP e mantém a foto ao editar outros dados", async () => {
    const ctx = await manager();
    const vehicle = await createOrUpdateVehicle({
      ctx,
      input,
      photo: await photo(),
    });
    expect(vehicle.photos[0]).toMatch(/^\/api\/vehicles\/.+\/photo\?v=/);
    const saved = await getVehiclePhoto(ctx, vehicle.id);
    expect((await sharp(saved!.content).metadata()).format).toBe("webp");
    const edited = await createOrUpdateVehicle({
      ctx,
      vehicleId: vehicle.id,
      input: { ...vehicle, color: "Azul" },
    });
    expect(edited.photoFile).toEqual(vehicle.photoFile);
    expect(edited.photos).toEqual(vehicle.photos);
    const removed = await createOrUpdateVehicle({
      ctx,
      vehicleId: vehicle.id,
      input: edited,
      removePhoto: true,
    });
    expect(removed.photos).toEqual([]);
    expect(await getVehiclePhoto(ctx, vehicle.id)).toBeNull();
  });

  it("rejeita conteúdo falso e arquivos maiores que 4 MB sem criar o carro", async () => {
    const ctx = await manager();
    const before = (await loadDatabaseState()).vehicles.length;
    await expect(
      createOrUpdateVehicle({
        ctx,
        input,
        photo: {
          contentBuffer: Buffer.from("not an image"),
          mimeType: "image/png",
          originalFilename: "fake.png",
        },
      }),
    ).rejects.toThrow(/foto não pôde ser lida/);
    await expect(
      createOrUpdateVehicle({
        ctx,
        input,
        photo: {
          contentBuffer: Buffer.alloc(4 * 1024 * 1024 + 1),
          mimeType: "image/jpeg",
          originalFilename: "large.jpg",
        },
      }),
    ).rejects.toThrow(/4 MB/);
    expect((await loadDatabaseState()).vehicles.length).toBe(before);
  });

  it("permite foto somente ao comprador vinculado e à equipe da mesma organização", async () => {
    const ctx = await manager();
    const original = (await loadDatabaseState()).vehicles.find(
      (v) => v.id === "veh-001",
    )!;
    await createOrUpdateVehicle({
      ctx,
      vehicleId: original.id,
      input: original,
      photo: await photo(),
    });
    expect(
      await getVehiclePhoto(
        (await buildAuthenticatedContext("user-cliente-helena"))!,
        original.id,
      ),
    ).not.toBeNull();
    await expect(
      getVehiclePhoto(
        (await buildAuthenticatedContext("user-cliente-agro"))!,
        original.id,
      ),
    ).rejects.toThrow(/outro comprador/);
    await expect(
      getVehiclePhoto(
        (await buildAuthenticatedContext("user-other-org"))!,
        original.id,
      ),
    ).rejects.toThrow(/outra organização/);
    await expect(
      createOrUpdateVehicle({
        ctx: (await buildAuthenticatedContext("user-vendedor"))!,
        input,
        photo: await photo(),
      }),
    ).rejects.toThrow(/permissão/);
  });

  it("protege chassi, condição, unidade e situação de veículo com negociação ativa", async () => {
    const ctx = await manager();
    const original = (await loadDatabaseState()).vehicles.find(
      (v) => v.id === "veh-001",
    )!;
    await expect(
      createOrUpdateVehicle({
        ctx,
        vehicleId: original.id,
        input: { ...original, stockStatus: "AVAILABLE" },
      }),
    ).rejects.toThrow(/negociação ativa/);
    await expect(
      createOrUpdateVehicle({
        ctx,
        vehicleId: original.id,
        input: { ...original, vin: input.vin },
      }),
    ).rejects.toThrow(/negociação ativa/);
    await expect(
      createOrUpdateVehicle({
        ctx,
        input: { ...input, stockStatus: "SOLD_DELIVERED" },
      }),
    ).rejects.toThrow(/disponível ou bloqueado/);
  });

  it("valida data real e relação entre os anos de fabricação e modelo", () => {
    expect(
      VehicleInputSchema.safeParse({ ...input, entryDate: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      VehicleInputSchema.safeParse({ ...input, modelYear: 2024 }).success,
    ).toBe(false);
  });

  it("mantém foto disponível para convite válido sem confundi-lo com QR operacional", async () => {
    const ctx = await manager();
    const original = (await loadDatabaseState()).vehicles.find(
      (v) => v.id === "veh-001",
    )!;
    await createOrUpdateVehicle({
      ctx,
      vehicleId: original.id,
      input: original,
      photo: await photo(),
    });
    const token = "tok-cliente-helena-neg0001";
    const view = await getCustomerSafeDealView({
      ctx: null,
      accessToken: token,
    });
    expect(view.vehicle.photos[0]).toContain(`accessToken=${token}`);
    expect(await getVehiclePhoto(null, original.id, token)).not.toBeNull();
    await expect(
      getVehiclePhoto(null, original.id, original.qrToken),
    ).rejects.toThrow(/Convite/);
    const db = await loadDatabaseState();
    db.customerAccessGrants.find((g) => g.accessToken === token)!.revokedAt =
      new Date().toISOString();
    saveDatabaseState(db);
    await expect(getVehiclePhoto(null, original.id, token)).rejects.toThrow(
      /Convite/,
    );
  });

  it("gera QR decodificável com URL de login e mantém identidade ao editar o carro", async () => {
    const ctx = await manager();
    const [label] = await generateVehicleQrLabels({
      ctx,
      vehicleIds: ["veh-001"],
      origin: "https://ignored.example",
    });
    const bitmap = await sharp(Buffer.from(label.svg))
      .resize(600, 600)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = jsQR(
      new Uint8ClampedArray(bitmap.data),
      bitmap.info.width,
      bitmap.info.height,
    );
    expect(decoded?.data).toBe(label.payload);
    expect(label.payload).toBe(
      "https://chaveflow.example/q/qr-pin-byd-001-songplus",
    );
    // URL and legacy cf:// payloads identify the same vehicle.
    const result = await resolveScannedVehicleCode({
      ctx,
      rawQrCode: label.payload,
    });
    expect(result.outcome).toBe("IDENTIFIED_WITH_ACTIVE_DEAL");
    const details = await getVehicleDetails({ ctx, vehicleId: "veh-001" });
    await createOrUpdateVehicle({
      ctx,
      vehicleId: "veh-001",
      input: { ...details.vehicle, color: "Azul" },
    });
    expect(
      (
        await generateVehicleQrLabels({
          ctx,
          vehicleIds: ["veh-001"],
          origin: "https://ignored.example",
        })
      )[0].payload,
    ).toBe(label.payload);
  });

  it("recusa etiquetas de outra organização, seleção excessiva e vendedor na aba do gestor", async () => {
    const ctx = await manager();
    await expect(
      generateVehicleQrLabels({
        ctx: (await buildAuthenticatedContext("user-vendedor"))!,
        vehicleIds: ["veh-001"],
        origin: "https://app.example",
      }),
    ).rejects.toThrow(/permissão/i);
    const otherVehicle = (await loadDatabaseState()).vehicles.find(
      (v) => v.organizationId !== ctx.organization.id,
    )!;
    await expect(
      generateVehicleQrLabels({
        ctx,
        vehicleIds: [otherVehicle.id],
        origin: "https://app.example",
      }),
    ).rejects.toThrow(/organização/);
    await expect(
      generateVehicleQrLabels({
        ctx,
        vehicleIds: Array.from({ length: 41 }, (_, i) => String(i)),
        origin: "https://app.example",
      }),
    ).rejects.toThrow(/40/);
  });

  it("não apresenta acesso ao passaporte de outro vendedor", async () => {
    const db = await loadDatabaseState();
    db.deals.find((d) => d.id === "deal-001")!.sellerId = "someone-else";
    saveDatabaseState(db);
    const ctx = (await buildAuthenticatedContext("user-vendedor"))!;
    expect(
      (await listVehiclesForOrg({ ctx })).find((v) => v.id === "veh-001")!
        .canAccessActiveDeal,
    ).toBe(false);
    expect(
      (await getVehicleDetails({ ctx, vehicleId: "veh-001" })).vehicle
        .canAccessActiveDeal,
    ).toBe(false);
  });

  it("importa CSV de planilha com delimitadores dentro de aspas e conserva as observações", async () => {
    const ctx = await manager();
    const preview = await processVehicleCsvImport({
      ctx,
      csvText: csv,
      branchId: DEMO_BRANCH_ID,
      commit: false,
    });
    expect(preview.validCount).toBe(1);
    expect(preview.rows[0].parsedVehicle?.internalNotes).toBe(
      "Conferir cor; acessórios, manual",
    );
    const saved = await processVehicleCsvImport({
      ctx,
      csvText: csv,
      branchId: DEMO_BRANCH_ID,
      commit: true,
    });
    expect(saved.importedCount).toBe(1);
    expect(
      (await loadDatabaseState()).vehicles.filter(
        (v) => v.internalCode === "CSV-001",
      ),
    ).toHaveLength(1);
  });

  it("rejeita unidade de outra organização, cabeçalho vazio, aspas abertas e condição desconhecida", async () => {
    const ctx = await manager();
    await expect(
      processVehicleCsvImport({
        ctx,
        csvText: csv,
        branchId: OTHER_BRANCH_ID,
        commit: true,
      }),
    ).rejects.toThrow(/unidade ativa/);
    await expect(
      processVehicleCsvImport({
        ctx,
        csvText: csv.split("\n")[0],
        branchId: DEMO_BRANCH_ID,
        commit: false,
      }),
    ).rejects.toThrow(/cabeçalho/);
    expect(() => parseVehicleCsv('a;b\n"incompleto;b')).toThrow(/aspas/);
    const result = await processVehicleCsvImport({
      ctx,
      csvText: csv.replace(";NOVO;", ";INVALIDO;"),
      branchId: DEMO_BRANCH_ID,
      commit: true,
    });
    expect(result.importedCount).toBe(0);
    expect(result.rows[0].errors.join(" ")).toMatch(/Condição inválida/);
  });

  it("evita duplicidade quando duas importações confirmam o mesmo veículo ao mesmo tempo", async () => {
    const ctx = await manager();
    await Promise.allSettled(
      [1, 2].map(() =>
        processVehicleCsvImport({
          ctx,
          csvText: csv,
          branchId: DEMO_BRANCH_ID,
          commit: true,
        }),
      ),
    );
    expect(
      (await loadDatabaseState()).vehicles.filter(
        (v) => v.internalCode === "CSV-001",
      ),
    ).toHaveLength(1);
  });
});
