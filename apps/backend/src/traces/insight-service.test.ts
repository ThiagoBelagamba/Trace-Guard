import { describe, expect, it, vi } from "vitest";
import type {
  AlertFired,
  DashboardEvent,
  RaspEvent,
  TraceDetail,
  TraceInsight,
} from "@traceguard/shared";
import { createInsightService } from "./insight-service.js";

function makeDetail(traceId: string, extra: Partial<TraceDetail> = {}): TraceDetail {
  return { traceId, events: [], raspEvents: [], alerts: [], spanCount: 0, durationMs: null, ...extra };
}

function makeInsight(traceId: string, overrides: Partial<TraceInsight> = {}): TraceInsight {
  return {
    traceId,
    verdict: "normal",
    severity: "ok",
    headline: "h",
    narrative: "n",
    rootCause: { category: "healthy", summary: "s", service: "svc", spanId: null },
    causalChain: [],
    recommendations: [],
    correlatedPillars: [],
    source: "llm",
    model: "m",
    generatedAt: "2026-11-11T10:00:00.000Z",
    ...overrides,
  };
}

const fakeEvent = { spanId: "s1" } as unknown as DashboardEvent;
const fakeRasp = { spanId: "s1" } as unknown as RaspEvent;
const fakeAlert = { id: "a1" } as unknown as AlertFired;

function setup(options: { maxLlmCallsPerMinute?: number; ttlMs?: number; apiUrl?: string } = {}) {
  let clock = 1_000_000;
  const logs: string[] = [];
  const generate = vi.fn(async (detail: TraceDetail, opts?: { apiUrl?: string }) =>
    opts?.apiUrl === ""
      ? makeInsight(detail.traceId, { source: "causal-engine", model: undefined })
      : makeInsight(detail.traceId)
  );
  const service = createInsightService({
    apiUrl: "http://llm",
    ttlMs: 60_000,
    now: () => clock,
    generate: generate as never,
    logger: (message) => logs.push(message),
    ...options,
  });
  return {
    service,
    generate,
    logs,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("createInsightService", () => {
  it("reuses a cached LLM insight for the same trace within the TTL", async () => {
    const { service, generate } = setup();
    const detail = makeDetail("t1");

    const first = await service.getInsight(detail);
    const second = await service.getInsight(detail);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("shares one in-flight generation between concurrent calls", async () => {
    const { service, generate } = setup();
    const detail = makeDetail("t1");

    const results = await Promise.all(Array.from({ length: 20 }, () => service.getInsight(detail)));

    expect(generate).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(20);
  });

  it("regenerates when the trace gains events, RASP events or alerts", async () => {
    const { service, generate } = setup();

    await service.getInsight(makeDetail("t1"));
    await service.getInsight(makeDetail("t1", { events: [fakeEvent] }));
    await service.getInsight(makeDetail("t1", { events: [fakeEvent], raspEvents: [fakeRasp] }));
    await service.getInsight(
      makeDetail("t1", { events: [fakeEvent], raspEvents: [fakeRasp], alerts: [fakeAlert] })
    );

    expect(generate).toHaveBeenCalledTimes(4);
  });

  it("regenerates after the TTL expires", async () => {
    const { service, generate, advance } = setup({ ttlMs: 5_000 });
    const detail = makeDetail("t1");

    await service.getInsight(detail);
    advance(5_000 + 1);
    await service.getInsight(detail);

    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("does not cache fallback results", async () => {
    const { service, generate } = setup();
    generate.mockImplementation(async (detail: TraceDetail) =>
      makeInsight(detail.traceId, {
        source: "causal-engine",
        model: undefined,
        llmFallback: "timeout",
      })
    );
    const detail = makeDetail("t1");

    await service.getInsight(detail);
    await service.getInsight(detail);

    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("stops calling the LLM above the per-minute budget and reports rate_limited", async () => {
    const { service, generate, logs } = setup({ maxLlmCallsPerMinute: 2 });

    await service.getInsight(makeDetail("t1"));
    await service.getInsight(makeDetail("t2"));
    const third = await service.getInsight(makeDetail("t3"));

    expect(third.llmFallback).toBe("rate_limited");
    expect(third.source).toBe("causal-engine");
    expect(generate).toHaveBeenCalledTimes(3);
    expect(generate).toHaveBeenLastCalledWith(expect.objectContaining({ traceId: "t3" }), {
      apiUrl: "",
    });
    expect(logs).toContain("[insight] LLM fallback (rate_limited) trace=t3");
  });

  it("restores the budget after 60 seconds", async () => {
    const { service, generate, advance } = setup({ maxLlmCallsPerMinute: 1 });

    await service.getInsight(makeDetail("t1"));
    const limited = await service.getInsight(makeDetail("t2"));
    expect(limited.llmFallback).toBe("rate_limited");

    advance(60_001);
    const restored = await service.getInsight(makeDetail("t2"));

    expect(restored.source).toBe("llm");
    expect(restored.llmFallback).toBeUndefined();
    expect(generate).toHaveBeenLastCalledWith(
      expect.objectContaining({ traceId: "t2" }),
      expect.objectContaining({ apiUrl: "http://llm" })
    );
  });

  it("bypasses cache and budget when no AI_API_URL is configured", async () => {
    const { service, generate } = setup({ apiUrl: "", maxLlmCallsPerMinute: 1 });
    generate.mockImplementation(async (detail: TraceDetail) =>
      makeInsight(detail.traceId, { source: "causal-engine", model: undefined })
    );
    const detail = makeDetail("t1");

    const first = await service.getInsight(detail);
    await service.getInsight(detail);
    await service.getInsight(detail);

    expect(generate).toHaveBeenCalledTimes(3);
    expect(first.llmFallback).toBeUndefined();
  });
});
