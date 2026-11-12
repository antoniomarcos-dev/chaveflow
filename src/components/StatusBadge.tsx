import React from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileWarning,
  Lock,
  PlayCircle,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  DEAL_STATUS_LABELS,
  DealStatus,
  DOCUMENT_STATUS_LABELS,
  DocumentStatus,
  TASK_STATE_LABELS,
  TaskState,
  VEHICLE_STOCK_STATUS_LABELS,
  VehicleStockStatus,
} from "@/domain/types";

export function DealStatusBadge({ status }: { status: DealStatus }) {
  const config: Record<
    DealStatus,
    { bg: string; text: string; border: string; Icon: React.ElementType }
  > = {
    DRAFT: {
      bg: "bg-slate-100",
      text: "text-slate-700",
      border: "border-slate-300",
      Icon: Clock,
    },
    ACTIVE: {
      bg: "bg-[#EAF3FC]",
      text: "text-[#0B3B70]",
      border: "border-[#1684D8]/35",
      Icon: PlayCircle,
    },
    ELIGIBLE_FOR_AUTHORIZATION: {
      bg: "bg-amber-50",
      text: "text-amber-900",
      border: "border-amber-300",
      Icon: FileCheck2,
    },
    DELIVERY_AUTHORIZED: {
      bg: "bg-emerald-50",
      text: "text-emerald-900",
      border: "border-emerald-300",
      Icon: ShieldCheck,
    },
    DELIVERED: {
      bg: "bg-emerald-100",
      text: "text-emerald-950",
      border: "border-emerald-400",
      Icon: CheckCircle2,
    },
    CANCELLED: {
      bg: "bg-red-50",
      text: "text-red-900",
      border: "border-red-300",
      Icon: Ban,
    },
  };

  const c = config[status] || config.ACTIVE;
  const Icon = c.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text} ${c.border}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{DEAL_STATUS_LABELS[status]}</span>
    </span>
  );
}

export function TaskStateBadge({ state }: { state: TaskState }) {
  const config: Record<
    TaskState,
    { bg: string; text: string; border: string; Icon: React.ElementType }
  > = {
    WAITING_PREREQUISITE: {
      bg: "bg-slate-100",
      text: "text-slate-700",
      border: "border-slate-300",
      Icon: Lock,
    },
    AVAILABLE: {
      bg: "bg-[#EAF3FC]",
      text: "text-[#0B3B70]",
      border: "border-[#1684D8]/35",
      Icon: PlayCircle,
    },
    IN_PROGRESS: {
      bg: "bg-[#EAF3FC]",
      text: "text-[#0B3B70]",
      border: "border-[#1684D8]/40",
      Icon: Clock,
    },
    WAITING_INFO: {
      bg: "bg-amber-50",
      text: "text-amber-900",
      border: "border-amber-300",
      Icon: AlertTriangle,
    },
    IN_REVIEW: {
      bg: "bg-[#EAF3FC]",
      text: "text-[#0B3B70]",
      border: "border-[#1684D8]/40",
      Icon: FileCheck2,
    },
    COMPLETED: {
      bg: "bg-emerald-50",
      text: "text-emerald-900",
      border: "border-emerald-300",
      Icon: CheckCircle2,
    },
    WAIVED_BY_RULE: {
      bg: "bg-slate-100",
      text: "text-slate-600",
      border: "border-slate-300",
      Icon: SlidersHorizontal,
    },
    CANCELLED: {
      bg: "bg-red-50",
      text: "text-red-900",
      border: "border-red-300",
      Icon: Ban,
    },
  };

  const c = config[state] || config.AVAILABLE;
  const Icon = c.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text} ${c.border}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{TASK_STATE_LABELS[state]}</span>
    </span>
  );
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const config: Record<
    DocumentStatus,
    { bg: string; text: string; border: string; Icon: React.ElementType }
  > = {
    REQUESTED: {
      bg: "bg-amber-50",
      text: "text-amber-900",
      border: "border-amber-300",
      Icon: Clock,
    },
    UPLOADED_PENDING_REVIEW: {
      bg: "bg-[#EAF3FC]",
      text: "text-[#0B3B70]",
      border: "border-[#1684D8]/40",
      Icon: FileCheck2,
    },
    APPROVED: {
      bg: "bg-emerald-50",
      text: "text-emerald-900",
      border: "border-emerald-300",
      Icon: CheckCircle2,
    },
    REJECTED: {
      bg: "bg-red-50",
      text: "text-red-900",
      border: "border-red-300",
      Icon: Ban,
    },
    CORRECTION_REQUESTED: {
      bg: "bg-red-50",
      text: "text-red-900",
      border: "border-red-300",
      Icon: FileWarning,
    },
    OUTDATED: {
      bg: "bg-amber-100",
      text: "text-amber-950",
      border: "border-amber-400",
      Icon: AlertTriangle,
    },
  };

  const c = config[status] || config.REQUESTED;
  const Icon = c.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text} ${c.border}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{DOCUMENT_STATUS_LABELS[status]}</span>
    </span>
  );
}

export function StockStatusBadge({ status }: { status: VehicleStockStatus }) {
  const config: Record<
    VehicleStockStatus,
    { bg: string; text: string; border: string; Icon: React.ElementType }
  > = {
    AVAILABLE: {
      bg: "bg-emerald-50",
      text: "text-emerald-900",
      border: "border-emerald-300",
      Icon: CheckCircle2,
    },
    RESERVED: {
      bg: "bg-[#EAF3FC]",
      text: "text-[#0B3B70]",
      border: "border-[#1684D8]/40",
      Icon: Lock,
    },
    IN_PREPARATION: {
      bg: "bg-amber-50",
      text: "text-amber-900",
      border: "border-amber-300",
      Icon: Clock,
    },
    SOLD_DELIVERED: {
      bg: "bg-slate-200",
      text: "text-slate-800",
      border: "border-slate-300",
      Icon: ShieldCheck,
    },
    BLOCKED: {
      bg: "bg-red-50",
      text: "text-red-900",
      border: "border-red-300",
      Icon: Ban,
    },
  };

  const c = config[status] || config.AVAILABLE;
  const Icon = c.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text} ${c.border}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{VEHICLE_STOCK_STATUS_LABELS[status]}</span>
    </span>
  );
}
