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

export const LEVEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Todos os níveis" },
  { value: "debug", label: "Debug" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warn" },
  { value: "error", label: "Error" },
];
