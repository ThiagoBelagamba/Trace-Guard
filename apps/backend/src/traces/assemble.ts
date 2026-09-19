import type { DashboardEvent, RaspEvent, TraceDetail } from "@traceguard/shared";

function eventTime(event: DashboardEvent): number {
  return new Date(event.createdAt).getTime();
}

function raspTime(event: RaspEvent): number {
  return new Date(event.timestamp).getTime();
}

export function assembleTrace(
  traceId: string,
  events: DashboardEvent[],
  raspEvents: RaspEvent[]
): TraceDetail {
  const orderedEvents = [...events].sort((a, b) => eventTime(a) - eventTime(b));
  const orderedRasp = [...raspEvents].sort((a, b) => raspTime(a) - raspTime(b));

  const spans = new Set<string>();
  for (const event of orderedEvents) {
    if (event.spanId) spans.add(event.spanId);
  }
  for (const event of orderedRasp) {
    if (event.spanId) spans.add(event.spanId);
  }

  const timestamps = [
    ...orderedEvents.map(eventTime),
    ...orderedRasp.map(raspTime),
  ].filter((value) => Number.isFinite(value));

  const durationMs =
    timestamps.length >= 2
      ? Math.max(...timestamps) - Math.min(...timestamps)
      : null;

  return {
    traceId,
    events: orderedEvents,
    raspEvents: orderedRasp,
    spanCount: spans.size,
    durationMs,
  };
}
