import { describe, expect, it } from "vitest";
import type { RaspEvent } from "../../packages/shared/src/rasp.ts";
import type { LayaInspectionResult } from "../../packages/sdk/src/rasp/laya-inspector.ts";
import type { LayaCase } from "./laya-dataset.ts";
import {
  buildAccuracyReport,
  formatNoul,
  majorityVerdict,
  matchDeliveries,
  pendingCheckpoints,
  summarizeLatency,
  type CaseVerdict,
  type SentCase,
} from "./laya-stats.ts";

function run(pi: number, sl: number, abstained = false): LayaInspectionResult {
  const abstention = abstained ? "abstained" : undefined;
  return {
    flagged: pi >= 0.8 || sl >= 0.8,
    score: 0,
    reasons: [],
    modelUsed: "multilingual",
    latencyMs: 10,
    signals: {
      prompt_injection: { noul: pi, ...(abstention ? { abstention } : {}) },
      secret_leak: { noul: sl, ...(abstention ? { abstention } : {}) },
    },
  };
}

function item(id: string, label: LayaCase["label"], lang: LayaCase["lang"], hard = false): LayaCase {
  return { id, label, lang, hard, category: "test", text: id };
}

function verdict(flagged: boolean, piHit = false, slHit = false): CaseVerdict {
  return {
    flagged,
    piHit,
    slHit,
    piNoul: null,
    slNoul: null,
    piAbstained: false,
    slAbstained: false,
    validRuns: 3,
    totalRuns: 3,
    stable: true,
  };
}

function event(traceId: string, threatType: RaspEvent["threatType"], timestamp: string, source?: string): RaspEvent {
  return {
    traceId,
    spanId: "s".repeat(16),
    service: "demo-api",
    threatType,
    action: "logged",
    clientIp: "10.0.0.1",
    path: "/api/chat",
    method: "POST",
    score: 90,
    metadata: source ? { source } : {},
    timestamp,
  };
}

describe("summarizeLatency", () => {
  it("computes avg, p50 and p95 with the overhead.ts percentile", () => {
    expect(summarizeLatency([5, 1, 3, 2, 4])).toEqual({ avg: 3, p50: 3, p95: 5 });
  });

  it("returns zeros for no samples", () => {
    expect(summarizeLatency([])).toEqual({ avg: 0, p50: 0, p95: 0 });
  });
});

describe("majorityVerdict", () => {
  it("returns null when every run failed", () => {
    expect(majorityVerdict([null, null, null])).toBeNull();
  });

  it("takes the majority and the median noul", () => {
    expect(majorityVerdict([run(0.9, 0.1), run(0.85, 0.1), run(0.2, 0.1)])).toMatchObject({
      flagged: true,
      piHit: true,
      slHit: false,
      threatType: "prompt_injection",
      piNoul: 0.85,
      validRuns: 3,
      stable: false,
    });
  });

  it("treats a tie between two valid runs as not flagged and unstable", () => {
    expect(majorityVerdict([run(0.9, 0), null, run(0.1, 0)])).toMatchObject({
      flagged: false,
      stable: false,
      validRuns: 2,
    });
  });

  it("does not count abstained signals as hits", () => {
    const result = majorityVerdict([run(0.95, 0, true), run(0.95, 0, true), run(0.95, 0, true)]);
    expect(result?.piHit).toBe(false);
  });

  it("picks the threat type with the higher median noul", () => {
    const result = majorityVerdict([run(0.82, 0.97), run(0.82, 0.97), run(0.82, 0.97)]);
    expect(result?.threatType).toBe("secret_leak");
  });
});

describe("buildAccuracyReport", () => {
  it("excludes transport errors and splits metrics by type, hard cases and language", () => {
    const report = buildAccuracyReport([
      { item: item("pi", "prompt_injection", "pt"), verdict: verdict(true, true) },
      { item: item("sl", "secret_leak", "en"), verdict: verdict(false) },
      { item: item("hard", "benign", "pt", true), verdict: verdict(true, true) },
      { item: item("easy", "benign", "en"), verdict: verdict(false) },
      { item: item("err", "prompt_injection", "en"), verdict: null },
    ]);

    expect(report.evaluated).toBe(4);
    expect(report.transportErrors).toBe(1);
    expect(report.binary).toMatchObject({ tp: 1, fn: 1, fp: 1, tn: 1 });
    expect(report.hardBenign).toEqual({ total: 1, falsePositives: 1 });
    expect(report.recallByLang).toEqual({ pt: 1, en: 0 });
  });

  it("counts failed calls and texts decided on fewer runs than requested", () => {
    const partial = majorityVerdict([run(0.9, 0), null, run(0.9, 0)]);
    const full = majorityVerdict([run(0.1, 0), run(0.1, 0), run(0.1, 0)]);
    expect(partial).toMatchObject({ validRuns: 2, totalRuns: 3 });

    const report = buildAccuracyReport([
      { item: item("partial", "prompt_injection", "pt"), verdict: partial },
      { item: item("full", "benign", "en"), verdict: full },
      { item: item("err", "benign", "pt"), verdict: null },
    ]);
    expect(report.partialTexts).toBe(1);
  });
});

describe("matchDeliveries", () => {
  it("matches laya events by traceId and ignores foreign or heuristic events", () => {
    const sent: SentCase[] = [
      { caseId: "a", traceId: "a".repeat(32), sentAt: Date.parse("2026-10-28T10:00:00.000Z"), expectedThreatType: "prompt_injection" },
      { caseId: "b", traceId: "b".repeat(32), sentAt: Date.parse("2026-10-28T10:00:01.000Z"), expectedThreatType: "secret_leak" },
      { caseId: "c", traceId: "c".repeat(32), sentAt: Date.parse("2026-10-28T10:00:02.000Z") },
    ];
    const events = [
      event("a".repeat(32), "prompt_injection", "2026-10-28T10:00:00.250Z", "laya"),
      event("b".repeat(32), "prompt_injection", "2026-10-28T10:00:01.300Z", "laya"),
      event("c".repeat(32), "prompt_injection", "2026-10-28T10:00:02.300Z", "laya"),
      event("f".repeat(32), "prompt_injection", "2026-10-28T10:00:03.000Z", "laya"),
      event("b".repeat(32), "bot_user_agent", "2026-10-28T10:00:01.010Z"),
    ];

    const report = matchDeliveries(sent, events);

    expect(report).toMatchObject({
      expected: 2,
      delivered: 2,
      typeMismatch: 1,
      unexpected: 1,
      lost: 0,
      deliveryRate: 1,
    });
    expect(report.delaysMs[0]).toBe(250);
    expect(report.lostCaseIds).toEqual([]);
  });

  it("names the expected cases that never arrived", () => {
    const sent: SentCase[] = [
      { caseId: "a", traceId: "a".repeat(32), sentAt: 0, expectedThreatType: "prompt_injection" },
      { caseId: "b", traceId: "b".repeat(32), sentAt: 0, expectedThreatType: "secret_leak" },
    ];
    const report = matchDeliveries(sent, [
      event("a".repeat(32), "prompt_injection", "1970-01-01T00:00:00.100Z", "laya"),
    ]);
    expect(report.lost).toBe(1);
    expect(report.lostCaseIds).toEqual(["b"]);
  });

  it("reports a zero delivery rate when nothing was expected", () => {
    expect(matchDeliveries([], []).deliveryRate).toBe(0);
  });
});

describe("pendingCheckpoints", () => {
  const required = ["multilingual", "english"] as const;

  it("lists every required checkpoint before any answer", () => {
    expect(pendingCheckpoints(new Set(), required)).toEqual(["multilingual", "english"]);
  });

  it("keeps only the checkpoints that have not answered yet", () => {
    expect(pendingCheckpoints(new Set(["english"]), required)).toEqual(["multilingual"]);
  });

  it("is empty once every required checkpoint answered, ignoring extras", () => {
    expect(pendingCheckpoints(new Set(["english", "multilingual", "x"]), required)).toEqual([]);
  });
});

describe("formatNoul", () => {
  it("prints three decimals so 0.795 does not read as the 0.80 threshold", () => {
    expect(formatNoul(0.795, false)).toBe("0.795");
  });

  it("marks an abstained answer", () => {
    expect(formatNoul(0.48, true)).toBe("0.480 (abst.)");
  });

  it("prints a dash when there is no signal", () => {
    expect(formatNoul(null, false)).toBe("—");
  });
});

describe("majorityVerdict abstention", () => {
  it("flags both signals as abstained when most runs abstained", () => {
    expect(majorityVerdict([run(0.5, 0.1, true), run(0.5, 0.1, true), run(0.5, 0.1, true)])).toMatchObject({
      piAbstained: true,
      slAbstained: true,
    });
  });

  it("does not mark a confident answer as abstained", () => {
    expect(majorityVerdict([run(0.95, 0.05), run(0.95, 0.05), run(0.95, 0.05)])).toMatchObject({
      piAbstained: false,
      slAbstained: false,
    });
  });
});
