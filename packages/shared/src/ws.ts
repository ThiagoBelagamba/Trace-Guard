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

/** Detalhe de um trace para drill-down no dashboard (APM + RASP). */
export interface TraceDetail {
  traceId: string;
  events: DashboardEvent[];
  raspEvents: RaspEvent[];
  spanCount: number;
  durationMs: number | null;
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
