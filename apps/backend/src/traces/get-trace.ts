import type { DashboardEvent, RaspEvent, TraceDetail } from "@traceguard/shared";
import { assembleTrace } from "./assemble.js";

export interface TraceLookup {
  listEventsByTraceId: (traceId: string) => Promise<DashboardEvent[]>;
  listRaspByTraceId: (traceId: string) => Promise<RaspEvent[]>;
}

export async function getTraceDetail(
  traceId: string,
  deps: TraceLookup
): Promise<TraceDetail | null> {
  const [events, raspEvents] = await Promise.all([
    deps.listEventsByTraceId(traceId),
    deps.listRaspByTraceId(traceId),
  ]);

  if (events.length === 0 && raspEvents.length === 0) {
    return null;
  }

  return assembleTrace(traceId, events, raspEvents);
}
