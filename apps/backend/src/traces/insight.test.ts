import { describe, expect, it } from "vitest";
import type { TraceDetail } from "@traceguard/shared";
import { generateTraceInsight, synthesizeTraceInsight } from "./insight.js";

describe("synthesizeTraceInsight", () => {
  it("diagnoses a blocked RASP scraping attempt and explains the heuristic score", () => {
    const detail: TraceDetail = {
      traceId: "11111111111111111111111111111111",
      spanCount: 1,
      durationMs: 2,
      events: [
        {
          id: "ev-1",
          traceId: "11111111111111111111111111111111",
          spanId: "aaaa1111aaaa1111",
          service: "demo-api",
          level: "warn",
          message: "GET /api/products/1 403",
          metadata: {},
          durationMs: 2,
          createdAt: "2026-11-07T04:00:00.000Z",
        },
      ],
      raspEvents: [
        {
          traceId: "11111111111111111111111111111111",
          spanId: "aaaa1111aaaa1111",
          service: "demo-api",
          threatType: "bot_user_agent",
          action: "blocked",
          clientIp: "203.0.113.42",
          userAgent: "python-requests/2.31.0",
          path: "/api/products/1",
          method: "GET",
          score: 70,
          metadata: {
            threats: ["bot_user_agent", "missing_headers"],
          },
          timestamp: "2026-11-07T04:00:00.001Z",
        },
      ],
      alerts: [],
    };

    const insight = synthesizeTraceInsight(detail);

    expect(insight.verdict).toBe("attack_blocked");
    expect(insight.severity).toBe("critical");
    expect(insight.correlatedPillars).toEqual(["apm", "rasp"]);
    expect(insight.rootCause.category).toBe("rasp");
    expect(insight.rootCause.spanId).toBe("aaaa1111aaaa1111");
    expect(insight.narrative).toContain("70");
    expect(insight.narrative).toContain("203.0.113.42");
    expect(insight.causalChain.length).toBeGreaterThanOrEqual(3);
    expect(insight.recommendations.length).toBeGreaterThanOrEqual(2);
    expect(insight.source).toBe("causal-engine");
  });

  it("diagnoses an application error burst and highlights alert cooldown suppression", () => {
    const detail: TraceDetail = {
      traceId: "22222222222222222222222222222222",
      spanCount: 2,
      durationMs: 140,
      events: [
        {
          id: "ev-1",
          traceId: "22222222222222222222222222222222",
          spanId: "bbbb1111bbbb1111",
          service: "demo-app",
          level: "error",
          message: "Connection timeout on checkout-db",
          metadata: {},
          durationMs: 120,
          createdAt: "2026-11-07T04:01:00.000Z",
        },
        {
          id: "ev-2",
          traceId: "22222222222222222222222222222222",
          spanId: "bbbb2222bbbb2222",
          service: "demo-app",
          level: "error",
          message: "Retry exhausted for order #841",
          metadata: { parentSpanId: "bbbb1111bbbb1111" },
          durationMs: 20,
          createdAt: "2026-11-07T04:01:00.120Z",
        },
      ],
      raspEvents: [],
      alerts: [
        {
          id: "al-1",
          ruleId: "rule-burst",
          ruleName: "Rajada no mesmo trace",
          service: "demo-app",
          severity: "critical",
          title: "Rajada de erros no trace 22222222…",
          message: "3 erros no trace",
          eventCount: 3,
          suppressed: false,
          firedAt: "2026-11-07T04:01:00.130Z",
          metadata: { traceId: "22222222222222222222222222222222" },
        },
        {
          id: "al-2",
          ruleId: "rule-burst",
          ruleName: "Rajada no mesmo trace",
          service: "demo-app",
          severity: "critical",
          title: "Rajada de erros no trace 22222222…",
          message: "4 erros no trace",
          eventCount: 4,
          suppressed: true,
          firedAt: "2026-11-07T04:01:00.140Z",
          metadata: { traceId: "22222222222222222222222222222222" },
        },
      ],
    };

    const insight = synthesizeTraceInsight(detail);

    expect(insight.verdict).toBe("incident");
    expect(insight.severity).toBe("critical");
    expect(insight.correlatedPillars).toEqual(["apm", "alert"]);
    expect(insight.rootCause.category).toBe("application_error");
    expect(insight.rootCause.spanId).toBe("bbbb1111bbbb1111");
    expect(insight.narrative).toContain("Connection timeout on checkout-db");
    expect(insight.narrative).toMatch(/suprimid/i);
  });

  it("marks a clean trace without errors or threats as normal", () => {
    const detail: TraceDetail = {
      traceId: "33333333333333333333333333333333",
      spanCount: 1,
      durationMs: 12,
      events: [
        {
          id: "ev-ok",
          traceId: "33333333333333333333333333333333",
          spanId: "cccc1111cccc1111",
          service: "demo-api",
          level: "info",
          message: "GET /health 200",
          metadata: {},
          durationMs: 12,
          createdAt: "2026-11-07T04:02:00.000Z",
        },
      ],
      raspEvents: [],
      alerts: [],
    };

    const insight = synthesizeTraceInsight(detail);

    expect(insight.verdict).toBe("normal");
    expect(insight.severity).toBe("ok");
    expect(insight.rootCause.category).toBe("healthy");
  });
});

describe("generateTraceInsight", () => {
  const sampleDetail: TraceDetail = {
    traceId: "44444444444444444444444444444444",
    spanCount: 1,
    durationMs: 5,
    events: [],
    raspEvents: [
      {
        traceId: "44444444444444444444444444444444",
        spanId: "dddd1111dddd1111",
        service: "demo-api",
        threatType: "sequential_scan",
        action: "blocked",
        clientIp: "198.51.100.7",
        path: "/api/products/25",
        method: "GET",
        score: 80,
        metadata: { threats: ["sequential_scan", "missing_headers"] },
        timestamp: "2026-11-07T04:03:00.000Z",
      },
    ],
    alerts: [],
  };

  it("refines the narrative via LLM when an OpenAI-compatible endpoint responds", async () => {
    const insight = await generateTraceInsight(sampleDetail, {
      apiUrl: "http://llm.local/v1",
      model: "qwen2.5-coder:7b",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    headline: "Varredura sequencial bloqueada por RASP em /api/products/25",
                    narrative: "O IP 198.51.100.7 enumerou rotas sequenciais sem cabeçalhos de navegador.",
                    recommendations: ["Aplicar bloqueio temporário no IP 198.51.100.7 via Redis"],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
    });

    expect(insight.source).toBe("llm");
    expect(insight.model).toBe("qwen2.5-coder:7b");
    expect(insight.headline).toContain("Varredura sequencial");
    expect(insight.recommendations).toEqual([
      "Aplicar bloqueio temporário no IP 198.51.100.7 via Redis",
    ]);
  });

  it("falls back to the deterministic causal engine when the LLM endpoint fails", async () => {
    const insight = await generateTraceInsight(sampleDetail, {
      apiUrl: "http://llm.local/v1",
      fetchImpl: async () => {
        throw new Error("ECONNREFUSED");
      },
    });

    expect(insight.source).toBe("causal-engine");
    expect(insight.verdict).toBe("attack_blocked");
    expect(insight.narrative).toContain("198.51.100.7");
  });
});
