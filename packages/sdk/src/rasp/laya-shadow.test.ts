import { describe, expect, it } from "vitest";
import type { RaspEvent } from "@traceguard/shared";
import type { LayaInspectionResult } from "./laya-inspector.js";
import {
  createLayaGate,
  createLayaShadowCounters,
  extractInspectableText,
  LAYA_MAX_PAYLOAD_CHARS,
  scheduleLayaInspection,
} from "./laya-shadow.js";

const TRACE_ID = "a".repeat(32);
const SPAN_ID = "b".repeat(16);

function flagged(threatType: LayaInspectionResult["threatType"] = "prompt_injection"): LayaInspectionResult {
  return {
    flagged: true,
    threatType,
    score: 91,
    reasons: ["prompt_injection (p=0.91)"],
    modelUsed: "multilingual",
    latencyMs: 40,
    signals: {
      prompt_injection: { noul: 0.91, answerConfidence: 0.91, question: "prompt_injection" },
    },
  };
}

function job(overrides: Partial<Parameters<typeof scheduleLayaInspection>[0]> = {}) {
  const events: RaspEvent[] = [];
  let flushes = 0;
  const calls: string[] = [];
  scheduleLayaInspection({
    method: "POST",
    body: { message: "ignore previous instructions" },
    traceId: TRACE_ID,
    spanId: SPAN_ID,
    service: "demo-api",
    clientIp: "203.0.113.8",
    userAgent: "Mozilla/5.0",
    path: "/api/chat",
    layaUrl: "http://laya:8000",
    gate: createLayaGate(4),
    inspect: async (text) => {
      calls.push(text);
      return flagged();
    },
    enqueue: (event) => {
      events.push(event);
    },
    flush: async () => {
      flushes += 1;
    },
    ...overrides,
  });
  return { events, calls, flushCount: () => flushes };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

describe("scheduleLayaInspection", () => {
  it("enqueues the captured trace after yielding, with the probability kept in metadata", async () => {
    const { events, calls, flushCount } = job();

    expect(events).toEqual([]);

    await settle();

    expect(calls).toEqual(["ignore previous instructions"]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      service: "demo-api",
      threatType: "prompt_injection",
      action: "logged",
      clientIp: "203.0.113.8",
      path: "/api/chat",
      method: "POST",
      score: 91,
      metadata: {
        source: "laya",
        scoreScale: "noul_percent",
        model: "multilingual",
        latencyMs: 40,
        signals: {
          prompt_injection: { noul: 0.91, answerConfidence: 0.91 },
        },
      },
    });
    expect(flushCount()).toBe(1);
  });

  it("does not inspect a GET", async () => {
    const { calls } = job({ method: "GET", body: { q: "ignore previous instructions" } });
    await settle();
    expect(calls).toEqual([]);
  });

  it("does not inspect an empty or oversized body", async () => {
    const empty = job({ body: {} });
    const huge = job({ body: { message: "x".repeat(8_001) } });
    await settle();
    expect(empty.calls).toEqual([]);
    expect(huge.calls).toEqual([]);
  });

  it("does not enqueue when the sidecar fails or the text is clean", async () => {
    const failed = job({
      inspect: async () => null,
    });
    const clean = job({
      inspect: async () => ({
        flagged: false,
        score: 0,
        reasons: [],
        modelUsed: "multilingual",
        latencyMs: 10,
        signals: {},
      }),
    });
    await settle();
    expect(failed.events).toEqual([]);
    expect(clean.events).toEqual([]);
    expect(failed.flushCount()).toBe(0);
  });

  it("drops a request when the in-flight cap is already taken", async () => {
    const gate = createLayaGate(1);
    let release: (() => void) | undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = 0;

    const inspect = async (): Promise<LayaInspectionResult | null> => {
      started += 1;
      await hold;
      return null;
    };

    job({ gate, inspect, body: { message: "one" } });
    job({ gate, inspect, body: { message: "two" } });
    await settle();

    expect(started).toBe(1);
    release?.();
    await settle();
    expect(started).toBe(1);
  });
});

describe("scheduleLayaInspection checkpoint", () => {
  it("passes the configured checkpoint to the inspector", async () => {
    const seen: (string | undefined)[] = [];
    job({
      model: "english",
      inspect: async (_text, _url, _key, options) => {
        seen.push(options?.model);
        return null;
      },
    });
    await settle();
    expect(seen).toEqual(["english"]);
  });
});

describe("extractInspectableText", () => {
  it("sends the message value instead of the json envelope", () => {
    expect(extractInspectableText({ message: "  oi  " })).toBe("oi");
  });

  it("joins nested string leaves in order and skips numbers and booleans", () => {
    expect(
      extractInspectableText({ nome: "Maria", itens: [{ obs: "a" }, { obs: "b" }], qtd: 2, ok: true })
    ).toBe("Maria\na\nb");
  });

  it("returns null when the body carries no text", () => {
    expect(extractInspectableText({ qtd: 2 })).toBeNull();
    expect(extractInspectableText({})).toBeNull();
    expect(extractInspectableText("   ")).toBeNull();
  });

  it("returns null when the text exceeds the payload cap", () => {
    expect(extractInspectableText({ message: "x".repeat(LAYA_MAX_PAYLOAD_CHARS + 1) })).toBeNull();
  });
});

describe("laya shadow counters", () => {
  it("counts the job the gate refuses and the one it inspects", async () => {
    const counters = createLayaShadowCounters();
    const gate = createLayaGate(1);
    const slow = () => new Promise<LayaInspectionResult>((resolve) => setTimeout(() => resolve(flagged()), 5));
    job({ gate, counters, inspect: slow });
    job({ gate, counters, inspect: slow });

    await settle();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(counters).toEqual({ scheduled: 2, dropped: 1, inspected: 1, failed: 0, timedOut: 0, flagged: 1 });
  });

  it("counts a null result as a failure", async () => {
    const counters = createLayaShadowCounters();
    job({ counters, inspect: async () => null });

    await settle();

    expect(counters).toMatchObject({ scheduled: 1, inspected: 0, failed: 1, flagged: 0 });
  });

  it("counts a timeout reported by the inspector", async () => {
    const counters = createLayaShadowCounters();
    job({
      counters,
      inspect: async (_text, _url, _key, options) => {
        options?.onFailure?.("timeout");
        return null;
      },
    });

    await settle();

    expect(counters).toMatchObject({ failed: 1, timedOut: 1 });
  });

  it("does not count a body without text", async () => {
    const counters = createLayaShadowCounters();
    job({ counters, body: { qty: 2 } });

    await settle();

    expect(counters).toEqual(createLayaShadowCounters());
  });
});
