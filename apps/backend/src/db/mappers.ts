import type { DashboardEvent } from "@traceguard/shared";
import type { TelemetryRow } from "./pool.js";

export function toDashboardEvent(row: TelemetryRow): DashboardEvent {
  return {
    id: row.id,
    traceId: row.trace_id,
    spanId: row.span_id,
    service: row.service,
    level: row.level as DashboardEvent["level"],
    message: row.message,
    metadata: row.metadata ?? {},
    durationMs: row.duration_ms !== null ? Number(row.duration_ms) : null,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}
