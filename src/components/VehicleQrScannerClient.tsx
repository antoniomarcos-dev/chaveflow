"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import jsQR from "jsqr";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CameraOff,
  Car,
  CheckCircle2,
  FileSpreadsheet,
  PlusCircle,
  Printer,
  QrCode,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
} from "lucide-react";
import type {
  QrScanResolutionResult,
  VehicleWithDealStatus,
} from "@/application/vehicle-service";
import { StockStatusBadge } from "./StatusBadge";

interface DemoVehicleOption {
  id: string;
  internalCode: string;
  qrToken: string;
  brand: string;
  model: string;
  color: string;
  vin: string;
  activeDealNumber: string | null;
}

export function VehicleQrScannerClient({
  initialCode,
  demoVehicles,
  scannerCapabilities,
}: {
  initialCode?: string;
  demoVehicles: DemoVehicleOption[];
  scannerCapabilities: {
    qrCodeInternal: { implemented: true; description: string };
    barcode1D: { implemented: false; description: string };
    vinOcr: { implemented: false; description: string };
  };
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScannedCodeRef = useRef<{ code: string; timestamp: number } | null>(
    null
  );

  const [cameraState, setCameraState] = useState<
    "IDLE" | "REQUESTING" | "ACTIVE" | "DENIED" | "UNAVAILABLE"
  >("IDLE");
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState(initialCode || "");
  const [loadingResolve, setLoadingResolve] = useState(false);
  const [scanResult, setScanResult] = useState<QrScanResolutionResult | null>(
    null
  );
  const [showPrintableSheet, setShowPrintableSheet] = useState(false);
  const [qrSvgMap, setQrSvgMap] = useState<Record<string, string>>({});

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState((prev) => (prev === "ACTIVE" ? "IDLE" : prev));
  }, []);

  // Encerramento garantido da câmera ao desmontar/sair da tela
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, []);

  const resolveCodeOnServer = useCallback(
    async (rawCode: string) => {
      const cleaned = rawCode.trim();
      if (!cleaned) return;

      // Prevenção de leituras repetidas involuntárias (debounce de 3 segundos para o mesmo código)
      const now = Date.now();
      if (
        lastScannedCodeRef.current &&
        lastScannedCodeRef.current.code === cleaned &&
        now - lastScannedCodeRef.current.timestamp < 3000
      ) {
        return;
      }
      lastScannedCodeRef.current = { code: cleaned, timestamp: now };

      setLoadingResolve(true);
      try {
        const res = await fetch("/api/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "RESOLVE_QR_SCAN",
            rawQrCode: cleaned,
          }),
        });
        const data = await res.json();
        if (data.ok && data.result) {
          setScanResult(data.result);
          stopCamera();
        }
      } finally {
        setLoadingResolve(false);
      }
    },
    [stopCamera]
  );

  // Se veio com ?code= na URL, resolve automaticamente uma vez
  useEffect(() => {
    if (initialCode && initialCode.trim().length > 0) {
      resolveCodeOnServer(initialCode);
    }
  }, [initialCode, resolveCodeOnServer]);

  async function startCameraAfterUserAction() {
    setCameraErrorMsg(null);
    setScanResult(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraState("UNAVAILABLE");
      setCameraErrorMsg(
        "Câmera indisponível neste dispositivo ou navegador. Utilize a busca manual ou selecione uma etiqueta demonstrativa abaixo."
      );
      return;
    }

    setCameraState("REQUESTING");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraState("ACTIVE");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const tick = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (
          video &&
          canvas &&
          video.readyState === video.HAVE_ENOUGH_DATA &&
          video.videoWidth > 0
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx2d = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx2d) {
            ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx2d.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            );
            const code = jsQR(
              imageData.data,
              imageData.width,
              imageData.height,
              {
                inversionAttempts: "dontInvert",
              }
            );
            if (code && code.data && code.data.trim().length > 0) {
              resolveCodeOnServer(code.data);
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (
        name === "NotAllowedError" ||
        name === "PermissionDeniedError"
      ) {
        setCameraState("DENIED");
        setCameraErrorMsg(
          "Permissão de acesso à câmera foi negada. Autorize a câmera nas configurações do navegador ou utilize a busca manual abaixo."
        );
      } else {
        setCameraState("UNAVAILABLE");
        setCameraErrorMsg(
          "Não foi possível acessar a câmera traseira neste dispositivo. Utilize a busca manual ou as etiquetas demonstrativas."
        );
      }
    }
  }

  async function handleImageQrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx2d = canvas.getContext("2d");
      if (ctx2d) {
        ctx2d.drawImage(img, 0, 0);
        const imageData = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);
        if (decoded && decoded.data) {
          resolveCodeOnServer(decoded.data);
        } else {
          setCameraErrorMsg(
            "Nenhum QR Code válido foi detectado na imagem enviada."
          );
        }
      }
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  }

  async function togglePrintableLabels() {
    const next = !showPrintableSheet;
    setShowPrintableSheet(next);
    if (next && Object.keys(qrSvgMap).length === 0) {
      const map: Record<string, string> = {};
      for (const v of demoVehicles) {
        const res = await fetch("/api/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "GENERATE_QR_SVG",
            payload: `cf://v/${v.qrToken}`,
          }),
        });
        const data = await res.json();
        if (data.ok && data.svg) {
          map[v.id] = data.svg;
        }
      }
      setQrSvgMap(map);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700">
            <QrCode className="h-4 w-4" />
            <span>Identificação Rápida no Pátio ou Showroom</span>
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
            Escanear Veículo
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            O QR Code contém apenas um identificador opaco (<code>cf://v/...</code>), sem dados pessoais ou credenciais.
          </p>
        </div>

        <button
          type="button"
          onClick={togglePrintableLabels}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800 transition shrink-0"
        >
          <Printer className="h-4 w-4 text-teal-600" />
          <span>
            {showPrintableSheet
              ? "Ocultar Etiquetas QR"
              : "Ver / Imprimir Etiquetas QR de Demonstração"}
          </span>
        </button>
      </div>

      {/* Confirmação Visual do Veículo Identificado */}
      {scanResult && (
        <div
          role="region"
          aria-label="Resultado do escaneamento"
          className="rounded-2xl border-2 border-teal-500 bg-white p-6 shadow-lg space-y-4"
        >
          {scanResult.outcome === "UNAUTHENTICATED" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <span>Autenticação Necessária</span>
              </div>
              <p className="text-xs text-slate-600">{scanResult.message}</p>
              <Link
                href={scanResult.loginRedirectUrl}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white"
              >
                <span>Fazer Login para Continuar</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {scanResult.outcome === "UNKNOWN_CODE" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span>Código não reconhecido na organização</span>
              </div>
              <p className="text-xs text-slate-700">{scanResult.message}</p>
              <button
                type="button"
                onClick={() => setScanResult(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Tentar outra leitura
              </button>
            </div>
          )}

          {(scanResult.outcome === "IDENTIFIED_WITH_ACTIVE_DEAL" ||
            scanResult.outcome === "IDENTIFIED_NO_ACTIVE_DEAL") && (
            <IdentifiedVehicleCard
              result={scanResult}
              onReset={() => {
                lastScannedCodeRef.current = null;
                setScanResult(null);
              }}
            />
          )}
        </div>
      )}

      {/* Área de Câmera + Busca Manual */}
      <div className="grid md:grid-cols-12 gap-6">
        {/* Leitor de Câmera Traseira */}
        <div className="md:col-span-7 bg-[#0f172a] text-white rounded-2xl p-6 border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-teal-400" />
              <h2 className="text-base font-bold">Leitor de QR Code (Câmera)</h2>
            </div>
            <span className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md font-medium">
              Preferência: Câmera Traseira
            </span>
          </div>

          {cameraState === "IDLE" && (
            <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/70 p-8 text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <QrCode className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">
                  Pronto para escanear a etiqueta do veículo
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  O acesso à câmera só é solicitado após o seu clique e é encerrado imediatamente ao sair desta tela.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={startCameraAfterUserAction}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-400 px-5 py-3 text-xs sm:text-sm font-bold text-slate-950 shadow-md transition"
                >
                  <Camera className="h-4 w-4" />
                  <span>Ativar Câmera Traseira</span>
                </button>

                <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-3 text-xs font-semibold text-slate-200 transition">
                  <Upload className="h-4 w-4 text-teal-400" />
                  <span>Ler Imagem QR</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageQrUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {cameraState === "REQUESTING" && (
            <div className="rounded-xl bg-slate-900 p-8 text-center text-xs text-slate-300">
              Aguardando autorização de câmera no navegador...
            </div>
          )}

          {cameraState === "ACTIVE" && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video border-2 border-teal-500">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-44 w-44 rounded-2xl border-2 border-teal-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" />
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-teal-300 font-medium">
                  Aponte a câmera para o QR Code interno do veículo...
                </span>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/20 border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-600/30"
                >
                  <CameraOff className="h-3.5 w-3.5" />
                  <span>Encerrar Câmera</span>
                </button>
              </div>
            </div>
          )}

          {(cameraState === "DENIED" || cameraState === "UNAVAILABLE") && (
            <div
              role="alert"
              className="rounded-xl bg-red-950/60 border border-red-500/50 p-4 text-xs text-red-100 space-y-3"
            >
              <div className="flex items-center gap-2 font-bold text-red-300">
                <CameraOff className="h-4 w-4" />
                <span>
                  {cameraState === "DENIED"
                    ? "Permissão de câmera negada"
                    : "Câmera indisponível neste dispositivo"}
                </span>
              </div>
              <p>{cameraErrorMsg}</p>
              <button
                type="button"
                onClick={() => setCameraState("IDLE")}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Voltar
              </button>
            </div>
          )}

          {/* Interface de Evolução: Código de Barras 1D e OCR de Chassi */}
          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">
              Capacidades do Adaptador de Leitura:
            </div>
            <div>• {scannerCapabilities.qrCodeInternal.description}</div>
            <div>• Código de Barras 1D: {scannerCapabilities.barcode1D.description}</div>
            <div>• OCR de Chassi (VIN): {scannerCapabilities.vinOcr.description}</div>
          </div>
        </div>

        {/* Busca Manual Alternativa */}
        <div className="md:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-teal-600" />
              <h2 className="text-base font-bold text-slate-900">
                Busca Manual Alternativa
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              Caso a etiqueta esteja danificada ou você esteja em um computador sem câmera, informe o código interno, chassi (VIN) ou token QR:
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                lastScannedCodeRef.current = null;
                resolveCodeOnServer(manualInput);
              }}
              className="space-y-3"
            >
              <div>
                <label
                  htmlFor="manual-code-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Código Interno, Chassi (VIN) ou Token QR
                </label>
                <input
                  id="manual-code-input"
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Ex: PIN-BYD-001 ou 9BWSU19F08B301001"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900"
                />
              </div>

              <button
                type="submit"
                disabled={loadingResolve || !manualInput.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f172a] hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-white transition disabled:opacity-50"
              >
                <Search className="h-4 w-4 text-teal-400" />
                <span>
                  {loadingResolve ? "Localizando veículo..." : "Identificar Veículo"}
                </span>
              </button>
            </form>
          </div>

          {/* Alternativa explícita de Demonstração */}
          <div className="pt-4 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span>Abrir Veículo de Demonstração (Simulador de Leitura QR):</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Clique em um veículo demonstrativo abaixo para executar exatamente o mesmo fluxo pós-leitura do QR Code:
            </p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {demoVehicles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setManualInput(`cf://v/${v.qrToken}`);
                    lastScannedCodeRef.current = null;
                    resolveCodeOnServer(`cf://v/${v.qrToken}`);
                  }}
                  className="w-full text-left rounded-lg border border-slate-200 hover:border-teal-600 hover:bg-teal-50/40 p-2.5 transition flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {v.internalCode} • {v.brand} {v.model} ({v.color})
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      QR: cf://v/{v.qrToken}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${
                      v.activeDealNumber
                        ? "bg-teal-100 text-teal-900"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {v.activeDealNumber || "Sem negociação"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Folha de Etiquetas QR Code para Impressão / Teste com Celular */}
      {showPrintableSheet && (
        <section className="bg-white rounded-2xl border border-slate-300 p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                <ShieldAlert className="h-3.5 w-3.5" />
                ETIQUETAS INTERNAS DEMONSTRATIVAS — PINAUTO BYD CERES/GO
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                Aponte a câmera do celular para qualquer etiqueta ou imprima para o pátio
              </h3>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir Folha de Etiquetas</span>
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {demoVehicles.map((v) => (
              <div
                key={v.id}
                className="rounded-xl border-2 border-slate-800 p-4 flex flex-col items-center text-center space-y-2"
              >
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  CHAVEFLOW • ETIQUETA INTERNA DE PÁTIO
                </div>
                <div className="text-sm font-extrabold text-slate-900">
                  {v.internalCode} — {v.brand} {v.model}
                </div>
                <div className="text-xs text-slate-600">
                  Cor: {v.color} • Chassi: <code className="font-mono">{v.vin}</code>
                </div>
                {qrSvgMap[v.id] ? (
                  <div
                    className="w-36 h-36"
                    dangerouslySetInnerHTML={{ __html: qrSvgMap[v.id] }}
                  />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center bg-slate-100 text-xs text-slate-500 rounded">
                    Gerando QR...
                  </div>
                )}
                <div className="text-[10px] font-mono text-slate-500">
                  cf://v/{v.qrToken}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function IdentifiedVehicleCard({
  result,
  onReset,
}: {
  result: Extract<
    QrScanResolutionResult,
    {
      outcome:
        | "IDENTIFIED_WITH_ACTIVE_DEAL"
        | "IDENTIFIED_NO_ACTIVE_DEAL";
    }
  >;
  onReset: () => void;
}) {
  const v: VehicleWithDealStatus = result.vehicle;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>Veículo Identificado com Sucesso — Confirme os Dados</span>
        </div>
        <StockStatusBadge status={v.stockStatus} />
      </div>

      <div className="grid sm:grid-cols-12 gap-4 items-center">
        <div className="sm:col-span-4">
          <img
            src={v.photos[0] || "/vehicles/song-plus.svg"}
            alt={`${v.brand} ${v.model}`}
            className="w-full rounded-xl border border-slate-200 object-cover"
          />
        </div>
        <div className="sm:col-span-8 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2.5 py-1 rounded">
              {v.internalCode}
            </span>
            <span className="font-mono text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-300">
              Chassi: {v.vin}
            </span>
            <span className="text-xs font-semibold bg-teal-50 text-teal-900 px-2.5 py-1 rounded border border-teal-200">
              {v.condition === "NEW" ? "0km / Novo" : "Seminovo / Usado"}
            </span>
          </div>

          <h3 className="text-xl font-extrabold text-slate-900">
            {v.brand} {v.model} — {v.trim}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600 pt-1">
            <div>
              <span className="text-slate-400 block">Ano Fab/Mod:</span>
              <strong className="text-slate-900">
                {v.manufacturingYear}/{v.modelYear}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block">Cor:</span>
              <strong className="text-slate-900">{v.color}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">Unidade:</span>
              <strong className="text-slate-900">{v.branchName}</strong>
            </div>
          </div>

          {result.outcome === "IDENTIFIED_WITH_ACTIVE_DEAL" ? (
            <div className="mt-3 rounded-xl bg-teal-50 border border-teal-300 p-3 text-xs text-teal-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-teal-700" />
                  <span>
                    Negociação Ativa Vinculada: {result.activeDealNumber}
                  </span>
                </div>
                <p className="text-teal-800 mt-0.5">
                  Este veículo possui passaporte digital em andamento.
                </p>
              </div>
              <Link
                href={result.nextStepUrl}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm shrink-0"
              >
                <span>{result.nextStepLabel}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <Car className="h-4 w-4 text-slate-700" />
                  <span>Sem negociação ativa no momento</span>
                </div>
                <p className="text-slate-600 mt-0.5">
                  Você pode consultar o cadastro completo ou iniciar a abertura guiada de uma negociação.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Link
                  href={result.vehicleDetailsUrl}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                >
                  Abrir Cadastro
                </Link>
                {result.canStartDeal && (
                  <Link
                    href={result.nextStepUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2 text-xs font-bold text-white"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>Iniciar Negociação</span>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 flex justify-end">
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          Escanear outro veículo
        </button>
      </div>
    </div>
  );
}
