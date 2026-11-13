import type { Vehicle } from "@/domain/types";
import { Download } from "lucide-react";

export interface GeneratedVehicleQr {
  vehicleId: string;
  payload: string;
  svg: string;
}

export function VehicleQrLabel({
  vehicle,
  label,
}: {
  vehicle: Pick<
    Vehicle,
    "internalCode" | "brand" | "model" | "color" | "vin" | "plate"
  >;
  label: GeneratedVehicleQr;
}) {
  const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(label.svg)}`;
  return (
    <article className="qr-label flex flex-col items-center gap-2 rounded-xl border-2 border-[#0B3B70] bg-white p-5 text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#0B3B70]">
        AUTOFLOW · Identificação do veículo
      </p>
      <h2 className="text-lg font-extrabold">{vehicle.internalCode}</h2>
      <p className="text-sm font-semibold">
        {vehicle.brand} {vehicle.model} · {vehicle.color}
      </p>
      <img
        src={imageUrl}
        alt={`QR Code do veículo ${vehicle.internalCode}`}
        width={200}
        height={200}
        className="qr-image h-48 w-48 max-w-full"
      />
      <p className="font-mono text-xs break-all">Chassi: {vehicle.vin}</p>
      {vehicle.plate && (
        <p className="font-mono text-xs">Placa: {vehicle.plate}</p>
      )}
      <p className="text-[11px] text-slate-600">
        Leia com a câmera do celular. Acesso da equipe com login.
      </p>
      <a
        href={imageUrl}
        download={`qr-${vehicle.internalCode.replace(/[^a-zA-Z0-9_-]/g, "-")}.svg`}
        className="no-print inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-[#0B3B70]"
      >
        <Download className="h-4 w-4" />
        Baixar QR Code
      </a>
    </article>
  );
}
