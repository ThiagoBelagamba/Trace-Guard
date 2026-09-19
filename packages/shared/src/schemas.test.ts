import { describe, expect, it } from "vitest";
import { logEventBatchSchema, raspEventSchema } from "./schemas.js";

describe("logEventBatchSchema", () => {
  it("rejects an empty batch", () => {
    const parsed = logEventBatchSchema.safeParse([]);
    expect(parsed.success).toBe(false);
  });

  it("accepts a valid telemetry event", () => {
    const parsed = logEventBatchSchema.safeParse([
      {
        traceId: "a".repeat(32),
        spanId: "b".repeat(16),
        service: "demo-app",
        level: "error",
        message: "HTTP GET failed",
        timestamp: "2026-01-01T00:00:00.000Z",
      },
    ]);

    expect(parsed.success).toBe(true);
  });
});

describe("raspEventSchema", () => {
  it("rejects a score outside 0–100", () => {
    const parsed = raspEventSchema.safeParse({
      traceId: "a".repeat(32),
      spanId: "b".repeat(16),
      service: "demo-api",
      threatType: "bot_user_agent",
      action: "blocked",
      clientIp: "1.2.3.4",
      path: "/api/products/1",
      method: "GET",
      score: 140,
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    expect(parsed.success).toBe(false);
  });
});
