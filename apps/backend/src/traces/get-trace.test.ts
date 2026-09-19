import { describe, expect, it } from "vitest";
import type { DashboardEvent, RaspEvent } from "@traceguard/shared";
import { getTraceDetail } from "./get-trace.js";

describe("getTraceDetail", () => {
  it("returns null when the trace has no APM or RASP events", async () => {
    const detail = await getTraceDetail("missing-trace", {
      listEventsByTraceId: async () => [],
      listRaspByTraceId: async () => [],
    });

    expect(detail).toBeNull();
  });

  it("assembles APM and RASP events for the same traceId", async () => {
    const events: DashboardEvent[] = [
      {
        id: "e1",
        traceId: "trace-1",
        spanId: "span-a",
        service: "demo-api",
        level: "info",
        message: "GET /api/products/1",
        metadata: {},
        durationMs: 8,
        createdAt: "2026-01-01T00:00:01.000Z",
      },
    ];
    const raspEvents: RaspEvent[] = [
      {
        traceId: "trace-1",
        spanId: "span-a",
        service: "demo-api",
        threatType: "bot_user_agent",
        action: "blocked",
        clientIp: "1.2.3.4",
        path: "/api/products/1",
        method: "GET",
        score: 70,
        timestamp: "2026-01-01T00:00:01.000Z",
      },
    ];

    const detail = await getTraceDetail("trace-1", {
      listEventsByTraceId: async (id) => (id === "trace-1" ? events : []),
      listRaspByTraceId: async (id) => (id === "trace-1" ? raspEvents : []),
    });

    expect(detail).not.toBeNull();
    expect(detail?.traceId).toBe("trace-1");
    expect(detail?.events).toHaveLength(1);
    expect(detail?.raspEvents).toHaveLength(1);
    expect(detail?.raspEvents[0]?.action).toBe("blocked");
  });
});
