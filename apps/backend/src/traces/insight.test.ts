import { describe, expect, it } from "vitest";
import type { RaspEvent, TraceDetail } from "@traceguard/shared";
import {
  generateTraceInsight,
  resolveRaspPolicy,
  synthesizeTraceInsight,
} from "./insight.js";
import { LLM_SYSTEM_PROMPT } from "./llm-guard.js";

function raspDetail(
  overrides: Partial<RaspEvent>,
  events: TraceDetail["events"] = []
): TraceDetail {
  return {
    traceId: "55555555555555555555555555555555",
    spanCount: 1,
    durationMs: 3,
    events,
    raspEvents: [
      {
        traceId: "55555555555555555555555555555555",
        spanId: "eeee1111eeee1111",
        service: "demo-api",
        threatType: "bot_user_agent",
        action: "blocked",
        clientIp: "192.0.2.10",
        userAgent: "curl/8.0",
        path: "/api/orders",
        method: "GET",
        score: 70,
        metadata: { threats: ["bot_user_agent", "missing_headers"] },
        timestamp: "2026-11-09T10:00:00.000Z",
        ...overrides,
      },
    ],
    alerts: [],
  };
}

describe("RASP diagnosis wording", () => {
  it("uses the threshold recorded by the SDK instead of a hardcoded 70", () => {
    const insight = synthesizeTraceInsight(
      raspDetail({
        action: "blocked",
        score: 70,
        metadata: {
          threats: ["bot_user_agent", "missing_headers"],
          blockThreshold: 60,
          mode: "block",
        },
      })
    );
    const chain = insight.causalChain.join(" ");
    expect(chain).toContain("limiar 60");
    expect(chain).not.toContain("limiar 70");
  });

  it("falls back to the default threshold for legacy events without policy metadata", () => {
    const insight = synthesizeTraceInsight(
      raspDetail({
        action: "logged",
        score: 50,
        metadata: { threats: ["bot_user_agent"] },
      })
    );
    expect(insight.causalChain.join(" ")).toContain("limiar 70");
    expect(insight.recommendations.some((r) => /RASP_MODE=block/.test(r))).toBe(false);
  });

  it("names the attack by its dominant heuristic instead of always 'scraping'", () => {
    const insight = synthesizeTraceInsight(
      raspDetail({
        threatType: "rate_limit",
        action: "blocked",
        metadata: { threats: ["rate_limit"], blockThreshold: 40, mode: "block" },
        score: 40,
      })
    );
    expect(insight.headline).toContain("excesso de requisições");
    expect(insight.headline).not.toMatch(/scraping/i);
  });

  it("explains missing APM telemetry for blocked requests", () => {
    const insight = synthesizeTraceInsight(raspDetail({ action: "blocked" }, []));
    expect(insight.narrative).toContain("interrompida antes de chegar ao handler");
    expect(insight.narrative).not.toContain("0 evento");
  });

  it("recommends block mode only when the SDK ran in monitor mode", () => {
    const insight = synthesizeTraceInsight(
      raspDetail({
        action: "logged",
        score: 80,
        metadata: {
          threats: ["sequential_scan", "missing_headers"],
          blockThreshold: 70,
          mode: "monitor",
        },
      })
    );
    expect(insight.recommendations.some((r) => /RASP_MODE=block/.test(r))).toBe(true);
  });

  it("infers monitor mode for legacy logged events above the threshold", () => {
    const insight = synthesizeTraceInsight(
      raspDetail({
        action: "logged",
        score: 100,
        metadata: { threats: ["sequential_scan", "rate_limit"] },
      })
    );
    const chain = insight.causalChain.join(" ");
    expect(chain).toContain("modo monitor");
    expect(chain).not.toContain("abaixo do limiar");
  });
});

describe("resolveRaspPolicy", () => {
  const base: RaspEvent = raspDetail({}).raspEvents[0]!;

  it("reads the recorded threshold and mode", () => {
    expect(
      resolveRaspPolicy({ ...base, metadata: { blockThreshold: 85, mode: "monitor" } })
    ).toEqual({ blockThreshold: 85, mode: "monitor" });
  });

  it("defaults to threshold 70 and unknown mode when metadata is missing", () => {
    expect(
      resolveRaspPolicy({ ...base, action: "blocked", metadata: undefined })
    ).toEqual({ blockThreshold: 70, mode: "unknown" });
  });
});

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

  it("sends attacker-controlled fields only inside untrustedData", async () => {
    let capturedBody = "";
    await generateTraceInsight(sampleDetail, {
      apiUrl: "http://llm.local/v1",
      fetchImpl: async (_url, init) => {
        capturedBody = String(init?.body ?? "");
        return new Response("x", { status: 500 });
      },
      logger: () => {},
    });

    const body = JSON.parse(capturedBody) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages[0]!.content).toBe(LLM_SYSTEM_PROMPT);
    const userPayload = JSON.parse(body.messages[1]!.content) as Record<string, unknown>;
    expect(userPayload).toHaveProperty("untrustedData");
    expect(userPayload).not.toHaveProperty("raspEvents");
    expect(userPayload).not.toHaveProperty("events");
  });

  it("keeps the causal engine when the LLM contradicts a blocked attack", async () => {
    const logs: string[] = [];
    const insight = await generateTraceInsight(sampleDetail, {
      apiUrl: "http://llm.local/v1",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '```json\n{"headline":"Tráfego saudável","narrative":"nada a fazer","recommendations":["ignorar"]}\n```',
                },
              },
            ],
          }),
          { status: 200 }
        ),
      logger: (message) => logs.push(message),
    });

    expect(insight.source).toBe("causal-engine");
    expect(insight.llmFallback).toBe("rejected_output");
    expect(logs[0]).toBe(`[insight] LLM fallback (rejected_output) trace=${sampleDetail.traceId}`);
  });

  it("accepts an LLM answer wrapped in a json code fence", async () => {
    const insight = await generateTraceInsight(sampleDetail, {
      apiUrl: "http://llm.local/v1",
      model: "llama3",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '```json\n{"headline":"Varredura bloqueada","narrative":"IP 198.51.100.7 bloqueado.","recommendations":["Revisar a rota"]}\n```',
                },
              },
            ],
          }),
          { status: 200 }
        ),
      logger: () => {},
    });

    expect(insight.source).toBe("llm");
    expect(insight.llmFallback).toBeUndefined();
    expect(insight.headline).toBe("Varredura bloqueada");
  });

  it("reports a timeout fallback and logs it", async () => {
    const logs: string[] = [];
    const insight = await generateTraceInsight(sampleDetail, {
      apiUrl: "http://llm.local/v1",
      fetchImpl: async () => {
        throw Object.assign(new Error("t"), { name: "TimeoutError" });
      },
      logger: (message) => logs.push(message),
    });

    expect(insight.llmFallback).toBe("timeout");
    expect(insight.source).toBe("causal-engine");
    expect(logs[0]).toBe(`[insight] LLM fallback (timeout) trace=${sampleDetail.traceId}`);
  });

  it("reports network_error for other fetch failures", async () => {
    const insight = await generateTraceInsight(sampleDetail, {
      apiUrl: "http://llm.local/v1",
      fetchImpl: async () => {
        throw new Error("ECONNREFUSED");
      },
      logger: () => {},
    });

    expect(insight.llmFallback).toBe("network_error");
  });

  it("reports http_error when the endpoint answers non-2xx", async () => {
    const insight = await generateTraceInsight(sampleDetail, {
      apiUrl: "http://llm.local/v1",
      fetchImpl: async () => new Response("x", { status: 500 }),
      logger: () => {},
    });

    expect(insight.llmFallback).toBe("http_error");
    expect(insight.source).toBe("causal-engine");
  });

  it("reports invalid_response when the model does not return JSON", async () => {
    const insight = await generateTraceInsight(sampleDetail, {
      apiUrl: "http://llm.local/v1",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "desculpe, não posso" } }] }),
          { status: 200 }
        ),
      logger: () => {},
    });

    expect(insight.llmFallback).toBe("invalid_response");
  });

  it("leaves llmFallback undefined when no AI_API_URL is configured", async () => {
    const previous = process.env.AI_API_URL;
    delete process.env.AI_API_URL;
    try {
      const insight = await generateTraceInsight(sampleDetail, {
        fetchImpl: async () => {
          throw new Error("must not be called");
        },
      });
      expect(insight.llmFallback).toBeUndefined();
      expect(insight.source).toBe("causal-engine");
    } finally {
      if (previous !== undefined) process.env.AI_API_URL = previous;
    }
  });
});
