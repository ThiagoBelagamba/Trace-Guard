import { describe, expect, it } from "vitest";
import type { DashboardEvent } from "@traceguard/shared";
import type { RaspEvent } from "@traceguard/shared";
import { assembleTrace } from "./assemble.js";

function event(
  partial: Pick<DashboardEvent, "id" | "spanId" | "createdAt" | "message">
): DashboardEvent {
  return {
    traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    service: "demo-api",
    level: "info",
    metadata: {},
    durationMs: 12,
    ...partial,
  };
}

function rasp(partial: Pick<RaspEvent, "spanId" | "timestamp" | "action">): RaspEvent {
  return {
    traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    service: "demo-api",
    threatType: "bot_user_agent",
    clientIp: "1.2.3.4",
    path: "/api/products/1",
    method: "GET",
    score: 70,
    ...partial,
  };
}

describe("assembleTrace", () => {
  it("orders APM and RASP events chronologically and counts unique spans", () => {
    const detail = assembleTrace(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      [
        event({
          id: "e2",
          spanId: "span-b",
          createdAt: "2026-01-01T00:00:02.000Z",
          message: "second",
        }),
        event({
          id: "e1",
          spanId: "span-a",
          createdAt: "2026-01-01T00:00:01.000Z",
          message: "first",
        }),
      ],
      [
        rasp({
          spanId: "span-c",
          timestamp: "2026-01-01T00:00:01.500Z",
          action: "blocked",
        }),
      ]
    );

    expect(detail.traceId).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(detail.events.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(detail.raspEvents).toHaveLength(1);
    expect(detail.spanCount).toBe(3);
    expect(detail.durationMs).toBe(1000);
  });

  it("returns null duration when there is a single timestamp", () => {
    const detail = assembleTrace(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      [
        event({
          id: "e1",
          spanId: "span-a",
          createdAt: "2026-01-01T00:00:01.000Z",
          message: "only",
        }),
      ],
      []
    );

    expect(detail.durationMs).toBeNull();
    expect(detail.spanCount).toBe(1);
  });
});
