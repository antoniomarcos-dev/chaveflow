import sharp from "sharp";
import {
  AuthorizationError,
  assertOrganizationAccess,
} from "@/domain/permissions";
import type { AuthenticatedContext } from "@/domain/types";
import {
  loadDatabaseState,
  readPrivateFileBlob,
  validateServerUploadFile,
} from "@/infrastructure/database";

export interface VehiclePhotoUpload {
  contentBuffer: Buffer;
  originalFilename: string;
  mimeType: string;
}

export async function prepareVehiclePhoto(upload: VehiclePhotoUpload) {
  validateServerUploadFile({
    ...upload,
    sizeBytes: upload.contentBuffer.length,
  });
  if (!["image/jpeg", "image/png", "image/webp"].includes(upload.mimeType)) {
    throw new Error("Envie uma foto JPG, PNG ou WEBP de até 4 MB.");
  }
  try {
    const image = sharp(upload.contentBuffer, {
      limitInputPixels: 40_000_000,
      animated: false,
    });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || ""))
      throw new Error("format");
    // Reencode real image data, remove metadata and normalize phone orientation.
    const contentBuffer = await image
      .rotate()
      .resize(1600, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return {
      contentBuffer,
      mimeType: "image/webp",
      originalFilename: upload.originalFilename,
    };
  } catch {
    throw new Error(
      "A foto não pôde ser lida. Escolha uma imagem JPG, PNG ou WEBP válida.",
    );
  }
}

export async function getVehiclePhoto(
  ctx: AuthenticatedContext | null,
  vehicleId: string,
  accessToken?: string,
) {
  if (!ctx && !accessToken)
    throw new AuthorizationError(
      "Entre na sua conta para acessar a foto.",
      "UNAUTHENTICATED",
      401,
    );
  const db = await loadDatabaseState();
  const vehicle = db.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return null;
  if (accessToken) {
    const grant = db.customerAccessGrants.find(
      (g) => g.accessToken === accessToken,
    );
    const expiresAt = grant ? Date.parse(grant.expiresAt) : NaN;
    const deal =
      grant &&
      db.deals.find(
        (d) =>
          d.id === grant.dealId &&
          d.customerId === grant.customerId &&
          d.organizationId === grant.organizationId &&
          d.vehicleId === vehicle.id &&
          d.status !== "DRAFT",
      );
    if (
      !grant ||
      grant.revokedAt ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() ||
      grant.organizationId !== vehicle.organizationId ||
      !deal
    )
      throw new AuthorizationError(
        "Convite de comprador inválido para esta foto.",
      );
  } else if (ctx) {
    assertOrganizationAccess(ctx, vehicle.organizationId);
    if (
      ctx.profile.isCustomerOnly ||
      ctx.roles.every((role) => role === "CUSTOMER")
    ) {
      const customerIds = new Set(
        db.customers
          .filter(
            (c) =>
              c.organizationId === ctx.organization.id &&
              c.profileId === ctx.profile.id,
          )
          .map((c) => c.id),
      );
      if (
        !db.deals.some(
          (d) =>
            d.organizationId === ctx.organization.id &&
            d.vehicleId === vehicleId &&
            d.status !== "DRAFT" &&
            customerIds.has(d.customerId),
        )
      ) {
        throw new AuthorizationError("Esta foto pertence a outro comprador.");
      }
    }
  }
  if (!vehicle.photoFile) return null;
  return {
    content: await readPrivateFileBlob(vehicle.photoFile.storageKey),
    mimeType: vehicle.photoFile.mimeType,
  };
}
