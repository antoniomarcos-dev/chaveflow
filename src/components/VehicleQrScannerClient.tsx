"use client";

import type {
  QrScanResolutionResult,
  VehicleWithDealStatus,
} from "@/application/vehicle-service";
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
  Upload,
} from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StockStatusBadge } from "./StatusBadge";

export function VehicleQrScannerClient({
  initialCode,
  canManageVehicles = false,
}: {
  initialCode?: string;
  canManageVehicles?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cameraSessionRef = useRef(0);
  const lastScannedCodeRef = useRef<{ code: string; timestamp: number } | null>(
    null,
  );

  const [cameraState, setCameraState] = useState<
    "IDLE" | "REQUESTING" | "ACTIVE" | "DENIED" | "UNAVAILABLE"
  >("IDLE");
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState(initialCode || "");
  const [loadingResolve, setLoadingResolve] = useState(false);
  const [scanResult, setScanResult] = useState<QrScanResolutionResult | null>(
    null,
  );
  const resolvingRef = useRef(false);

  const stopCamera = useCallback(() => {
    cameraSessionRef.current++;
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
      cameraSessionRef.current++;
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

  useEffect(() => {
    if (cameraState !== "ACTIVE" || !videoRef.current || !streamRef.current)
      return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {
      stopCamera();
      setCameraErrorMsg(
        "Não foi possível iniciar o vídeo. Tente novamente ou use a busca manual.",
      );
    });
  }, [cameraState, stopCamera]);

  const resolveCodeOnServer = useCallback(
    async (rawCode: string) => {
      const cleaned = rawCode.trim();
      if (!cleaned || resolvingRef.current) return;

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
      resolvingRef.current = true;
      setCameraErrorMsg(null);
      stopCamera();
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
        if (!res.ok || !data.ok)
          throw new Error(
            data.error || "Não foi possível identificar o veículo.",
          );
        if (data.ok && data.result) {
          setScanResult(data.result);
          stopCamera();
        }
      } catch (reason) {
        lastScannedCodeRef.current = null;
        setCameraErrorMsg(
          reason instanceof Error && reason.message !== "Failed to fetch"
            ? reason.message
            : "Falha de conexão. Tente novamente ou use a busca manual.",
        );
      } finally {
        resolvingRef.current = false;
        setLoadingResolve(false);
      }
    },
    [stopCamera],
  );

  // Se veio com ?code= na URL, resolve automaticamente uma vez
  useEffect(() => {
    if (initialCode && initialCode.trim().length > 0) {
      resolveCodeOnServer(initialCode);
    }
  }, [initialCode, resolveCodeOnServer]);

  async function startCameraAfterUserAction() {
    stopCamera();
    const cameraSession = cameraSessionRef.current;
    setCameraErrorMsg(null);
    setScanResult(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraState("UNAVAILABLE");
      setCameraErrorMsg(
        "Câmera indisponível neste dispositivo ou navegador. Utilize a busca manual com o código interno do veículo.",
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
      if (cameraSession !== cameraSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      setCameraState("ACTIVE");

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
              canvas.height,
            );
            const code = jsQR(
              imageData.data,
              imageData.width,
              imageData.height,
              {
                inversionAttempts: "dontInvert",
              },
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
      if (cameraSession !== cameraSessionRef.current) return;
      stopCamera();
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraState("DENIED");
        setCameraErrorMsg(
          "Permissão de acesso à câmera foi negada. Autorize a câmera nas configurações do navegador ou utilize a busca manual abaixo.",
        );
      } else {
        setCameraState("UNAVAILABLE");
        setCameraErrorMsg(
          "Não foi possível acessar a câmera neste dispositivo. Utilize a busca manual com o código interno do veículo.",
        );
      }
    }
  }

  async function handleImageQrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) {
      setCameraErrorMsg("Escolha uma imagem de QR Code de até 4 MB.");
      e.target.value = "";
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setCameraErrorMsg(
        "Não foi possível abrir esta imagem. Escolha outra foto do QR Code.",
      );
    };
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx2d = canvas.getContext("2d");
      if (ctx2d) {
        ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);
        if (decoded && decoded.data) {
          resolveCodeOnServer(decoded.data);
        } else {
          setCameraErrorMsg(
            "Nenhum QR Code válido foi detectado na imagem enviada.",
          );
        }
      }
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
    e.target.value = "";
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {cameraErrorMsg && cameraState === "IDLE" && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          {cameraErrorMsg}
        </div>
      )}
      {/* Cabeçalho (4.4 Escaneamento / Identificação do veículo) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#1684D8]">
            <QrCode className="h-4 w-4" />
            <span>Identificação Rápida no Pátio ou Showroom</span>
          </span>
          <h1 className="text-2xl font-extrabold text-[#172B3A] mt-1">
            Escaneamento de Veículo
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Escaneie a etiqueta do carro ou informe o chassi ou código interno.
            Você também pode enviar uma imagem do QR Code.
          </p>
        </div>

        {canManageVehicles && (
          <Link
            href="/app/qr-codes"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-[#172B3A]"
          >
            <Printer className="h-4 w-4" />
            Gerar QR Code e etiquetas
          </Link>
        )}
      </div>

      {/* Confirmação Visual do Veículo Identificado */}
      {scanResult && (
        <div
          role="region"
          aria-label="Resultado do escaneamento"
          className="rounded-2xl border-2 border-[#1684D8] bg-white p-6 shadow-md space-y-4"
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
                className="inline-flex items-center gap-2 rounded-lg bg-[#0B3B70] hover:bg-[#1684D8] px-4 py-2.5 text-xs font-bold text-white transition"
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
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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

      {/* Área de Câmera + Busca Manual (Tela 9 da prancha) */}
      <div className="grid md:grid-cols-12 gap-6">
        {/* Leitor de Câmera Traseira */}
        <div className="md:col-span-7 bg-[#0B3B70] text-white rounded-2xl p-6 border border-[#1684D8]/30 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center text-[#7CC4FA]">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">
                  Identificar Veículo (Leitor QR)
                </h2>
                <p className="text-[11px] text-slate-200">
                  Escaneie o QR Code de pátio para abrir a ficha ou passaporte
                </p>
              </div>
            </div>
            <span className="text-[11px] bg-white/10 text-blue-100 border border-white/15 px-2.5 py-1 rounded-md font-medium">
              Câmera Traseira
            </span>
          </div>

          {cameraState === "IDLE" && (
            <div className="rounded-2xl border-2 border-dashed border-white/25 bg-[#082B54]/85 p-8 text-center space-y-4">
              <div className="mx-auto h-20 w-20 rounded-2xl bg-white/10 border-2 border-[#7CC4FA]/40 flex items-center justify-center text-white shadow-inner">
                <QrCode className="h-11 w-11 text-[#7CC4FA]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm sm:text-base font-bold text-white">
                  Aponte a câmera para o QR Code do veículo
                </p>
                <p className="text-xs text-blue-100/80 max-w-sm mx-auto">
                  O acesso à câmera só é ativado após o seu clique e é encerrado
                  imediatamente ao sair desta tela.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={startCameraAfterUserAction}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-md transition"
                >
                  <Camera className="h-4 w-4" />
                  <span>Ativar Câmera Traseira</span>
                </button>

                <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 hover:bg-white/15 px-4 py-3 text-xs font-semibold text-white transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white">
                  <Upload className="h-4 w-4 text-[#7CC4FA]" />
                  <span>Ler Imagem QR</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageQrUpload}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          )}

          {cameraState === "REQUESTING" && (
            <div className="rounded-xl bg-[#082B54] p-8 text-center text-xs text-blue-100">
              Aguardando autorização de câmera no navegador...
            </div>
          )}

          {cameraState === "ACTIVE" && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video border-2 border-[#1684D8]">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-44 w-44 rounded-2xl border-2 border-[#7CC4FA] shadow-[0_0_0_9999px_rgba(11,59,112,0.5)]" />
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#7CC4FA] font-medium">
                  Aponte a câmera para o QR Code interno do veículo...
                </span>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/20 border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-600/30"
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
              className="rounded-xl bg-red-950/70 border border-red-400/50 p-4 text-xs text-red-100 space-y-3"
            >
              <div className="flex items-center gap-2 font-bold text-red-200">
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
                className="rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Voltar
              </button>
            </div>
          )}

          <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5 text-[11px] text-blue-100 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#7CC4FA] shrink-0" />
            <span>
              A leitura do QR Code apenas localiza o cadastro e a negociação
              vinculada; a liberação do veículo permanece condicionada aos
              requisitos obrigatórios.
            </span>
          </div>
        </div>

        {/* Busca Manual Alternativa */}
        <div className="md:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#EAF3FC] flex items-center justify-center text-[#1684D8]">
                <Search className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-[#172B3A]">
                Inserir Chassi ou Código Manualmente
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              Caso a etiqueta esteja danificada ou você esteja em um computador
              sem câmera, informe o código interno, chassi (VIN) ou token QR:
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
                  placeholder="Ex: PIN-BYD-001 ou chassi 9BW..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-[#172B3A]"
                />
              </div>

              <button
                type="submit"
                disabled={loadingResolve || !manualInput.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white transition disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                <span>
                  {loadingResolve
                    ? "Localizando veículo..."
                    : "Identificar Veículo"}
                </span>
              </button>
            </form>
          </div>

          <div className="rounded-xl bg-[#F4F7FA] border border-slate-200 p-3.5 text-xs text-slate-600 space-y-1">
            <div className="font-bold text-[#172B3A]">
              Alternativa rápida pelo estoque
            </div>
            <p>
              Você também pode consultar toda a disponibilidade e etiquetas em{" "}
              <Link
                href="/app/veiculos"
                className="font-bold text-[#1684D8] hover:underline"
              >
                Veículos e Estoque
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
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
      outcome: "IDENTIFIED_WITH_ACTIVE_DEAL" | "IDENTIFIED_NO_ACTIVE_DEAL";
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
            src={v.photos[0] || "/vehicle-placeholder.svg"}
            alt={`${v.brand} ${v.model}`}
            className="w-full rounded-xl border border-slate-200 object-cover"
          />
        </div>
        <div className="sm:col-span-8 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold bg-[#0B3B70] text-white px-2.5 py-1 rounded">
              {v.internalCode}
            </span>
            <span className="font-mono text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-300">
              Chassi: {v.vin}
            </span>
            <span className="text-xs font-semibold bg-[#EAF3FC] text-[#0B3B70] px-2.5 py-1 rounded border border-[#1684D8]/30">
              {v.condition === "NEW" ? "0km / Novo" : "Seminovo / Usado"}
            </span>
          </div>

          <h3 className="text-xl font-extrabold text-[#172B3A]">
            {v.brand} {v.model} — {v.trim}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600 pt-1">
            <div>
              <span className="text-slate-400 block">Ano Fab/Mod:</span>
              <strong className="text-[#172B3A]">
                {v.manufacturingYear}/{v.modelYear}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block">Cor:</span>
              <strong className="text-[#172B3A]">{v.color}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">Unidade:</span>
              <strong className="text-[#172B3A]">{v.branchName}</strong>
            </div>
          </div>

          {result.outcome === "IDENTIFIED_WITH_ACTIVE_DEAL" ? (
            <div className="mt-3 rounded-xl bg-[#EAF3FC] border border-[#1684D8]/40 p-3 text-xs text-[#0B3B70] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-[#1684D8]" />
                  <span>
                    Negociação Ativa Vinculada: {result.activeDealNumber}
                  </span>
                </div>
                <p className="text-slate-700 mt-0.5">
                  Este veículo possui passaporte digital em andamento.
                </p>
              </div>
              <Link
                href={result.nextStepUrl}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs font-bold text-white shadow-sm shrink-0 transition"
              >
                <span>{result.nextStepLabel}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-[#172B3A] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <Car className="h-4 w-4 text-slate-700" />
                  <span>Sem negociação ativa no momento</span>
                </div>
                <p className="text-slate-600 mt-0.5">
                  Você pode consultar o cadastro completo ou iniciar a abertura
                  guiada de uma negociação.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Link
                  href={result.vehicleDetailsUrl}
                  className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-[#172B3A]"
                >
                  Abrir Cadastro
                </Link>
                {result.canStartDeal && (
                  <Link
                    href={result.nextStepUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2 text-xs font-bold text-white transition"
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
          className="text-xs font-semibold text-slate-500 hover:text-[#172B3A]"
        >
          Escanear outro veículo
        </button>
      </div>
    </div>
  );
}
