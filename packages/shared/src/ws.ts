import type { LogLevel } from "./events.js";
import type { AlertFired } from "./alerts.js";
import type { RaspEvent } from "./rasp.js";
import type { UptimeCheckWithMonitor } from "./uptime.js";

/** Evento de telemetria formatado para exibição no dashboard. */
export interface DashboardEvent {
  id: string;
  traceId: string;
  spanId: string | null;
  service: string;
  level: LogLevel;
  message: string;
  metadata: Record<string, unknown>;
  durationMs: number | null;
  createdAt: string;
}

export type WsMessage =
  | { type: "event"; data: DashboardEvent }
  | { type: "alert"; data: AlertFired }
  | { type: "rasp"; data: RaspEvent }
  | { type: "uptime"; data: UptimeCheckWithMonitor }
  | { type: "connected"; clientId: string }
  | { type: "ping" };

/** Detalhe de um trace para drill-down no dashboard (APM + RASP + Alertas). */
export interface TraceDetail {
  traceId: string;
  events: DashboardEvent[];
  raspEvents: RaspEvent[];
  alerts?: AlertFired[];
  spanCount: number;
  durationMs: number | null;
}

export type TraceVerdict =
  | "attack_blocked"
  | "attack_monitored"
  | "incident"
  | "degraded"
  | "normal";

/** Motivo pelo qual o refinamento por LLM foi descartado e o motor causal foi usado. */
export type LlmFallbackReason =
  | "timeout"
  | "http_error"
  | "network_error"
  | "invalid_response"
  | "rejected_output"
  | "rate_limited";

export interface TraceInsight {
  traceId: string;
  verdict: TraceVerdict;
  severity: "critical" | "warning" | "info" | "ok";
  headline: string;
  narrative: string;
  rootCause: {
    category: "rasp" | "application_error" | "latency" | "healthy";
    summary: string;
    service: string;
    spanId: string | null;
  };
  causalChain: string[];
  recommendations: string[];
  correlatedPillars: Array<"apm" | "rasp" | "alert">;
  source: "causal-engine" | "llm";
  model?: string;
  /** Presente quando um LLM estava configurado mas falhou ou foi rejeitado. */
  llmFallback?: LlmFallbackReason;
  generatedAt: string;
}

export interface EventStats {
  timeline: Array<{ bucket: string; count: number }>;
  byLevel: Record<string, number>;
  byService: Record<string, number>;
}

export interface WsClientFilters {
  service?: string;
  level?: string;
}
