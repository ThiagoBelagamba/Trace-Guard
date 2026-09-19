import { describe, expect, it } from "vitest";
import { RaspDetector } from "./detector.js";
import { InMemoryRateLimiter } from "./rate-limiter.js";
import { DEFAULT_RASP_CONFIG } from "./types.js";

function detector() {
  return new RaspDetector(
    {
      ...DEFAULT_RASP_CONFIG,
      maxRequestsPerMinute: 2,
      sequentialScanThreshold: 2,
    },
    new InMemoryRateLimiter()
  );
}

describe("RaspDetector", () => {
  it("scores a scraper user agent on an API path as blockable", async () => {
    const result = await detector().analyze(
      {
        method: "GET",
        path: "/api/products/1",
        headers: { "user-agent": "python-requests/2.31.0" },
      },
      "203.0.113.10"
    );

    expect(result.threats).toContain("bot_user_agent");
    expect(result.threats).toContain("missing_headers");
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("flags sequential scans after the path threshold", async () => {
    const rasp = detector();
    const headers = {
      "user-agent": "Mozilla/5.0 Chrome/120.0.0.0",
      accept: "application/json",
      "accept-language": "pt-BR",
    };

    await rasp.analyze({ method: "GET", path: "/api/products/1", headers }, "10.0.0.1");
    await rasp.analyze({ method: "GET", path: "/api/products/2", headers }, "10.0.0.1");
    const third = await rasp.analyze(
      { method: "GET", path: "/api/products/3", headers },
      "10.0.0.1"
    );

    expect(third.threats).toContain("sequential_scan");
    expect(third.score).toBeGreaterThanOrEqual(60);
  });

  it("picks sequential_scan as the primary threat when present", () => {
    const primary = detector().primaryThreat([
      "missing_headers",
      "bot_user_agent",
      "sequential_scan",
    ]);
    expect(primary).toBe("sequential_scan");
  });
});
