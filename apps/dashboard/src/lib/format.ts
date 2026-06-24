import type { LogLevel } from "@traceguard/shared";
import type { AlertSeverity } from "@traceguard/shared";
import clsx from "clsx";

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function truncateTraceId(traceId: string, len = 12): string {
  return traceId.length > len ? `${traceId.slice(0, len)}…` : traceId;
}

export function levelBadgeClass(level: LogLevel): string {
  return clsx("rounded px-2 py-0.5 text-xs font-medium uppercase", {
    "bg-blue-900/60 text-blue-300": level === "debug",
    "bg-emerald-900/60 text-emerald-300": level === "info",
    "bg-amber-900/60 text-amber-300": level === "warn",
    "bg-red-900/60 text-red-300": level === "error",
  });
}

export const LEVEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Todos os níveis" },
  { value: "debug", label: "Debug" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warn" },
  { value: "error", label: "Error" },
];

export function severityBadgeClass(severity: AlertSeverity): string {
  return clsx("rounded px-2 py-0.5 text-xs font-medium uppercase", {
    "bg-amber-900/60 text-amber-300": severity === "warning",
    "bg-red-900/60 text-red-300": severity === "critical",
  });
}
