import { describe, expect, it } from "vitest";
import type { LayaCase } from "./laya-dataset.ts";
import type { CaseScore } from "./laya-rescore.ts";
import { compareSelections, selectThresholds, writeThresholds, type Selection } from "./laya-select-thresholds.ts";

function item(id: string, label: LayaCase["label"], hard = false): LayaCase {
  return { id, lang: "pt", label, hard, category: "x", text: id };
}

function score(id: string, piNoul: number, slNoul: number): CaseScore {
  return { id, piNoul, slNoul, piAbst: false, slAbst: false };
}

/**
 * Dois difíceis: um com injeção 0,96 (cai a partir de PI 0,97), outro com
 * credencial 0,92 (cai a partir de SL 0,93). Uma injeção real tem 0,98.
 */
const DATASET = [
  item("pi-1", "prompt_injection"),
  item("pi-2", "prompt_injection"),
  item("sl-1", "secret_leak"),
  item("bn-1", "benign", true),
  item("bn-2", "benign", true),
  item("bn-3", "benign"),
];
const SCORES = [
  score("pi-1", 1, 0),
  score("pi-2", 0.98, 0),
  score("sl-1", 0, 0.99),
  score("bn-1", 0.96, 0),
  score("bn-2", 0, 0.92),
  score("bn-3", 0, 0),
];

describe("selectThresholds", () => {
  it("drops pairs above the hard benign rate even with a higher F1", () => {
    // Taxa máxima 0: os dois difíceis precisam cair. O par mais baixo que faz isso é PI 0,97 / SL 0,93.
    const s = selectThresholds([{ dataset: DATASET, scores: SCORES }], [0.85, 0.93, 0.97, 0.99], 0);
    expect(s?.thresholds).toEqual({ prompt_injection: 0.97, secret_leak: 0.93 });
    expect(s?.metrics.hardFp).toBe(0);
    expect(s?.metrics.f1).toBe(1);
  });

  it("prefers higher F1, then the lowest thresholds among ties", () => {
    // PI 0,99 perde pi-2 (0,98): F1 menor. Entre os pares com F1 1, o desempate final é a menor soma de limiares.
    const s = selectThresholds([{ dataset: DATASET, scores: SCORES }], [0.97, 0.99], 0);
    expect(s?.thresholds).toEqual({ prompt_injection: 0.97, secret_leak: 0.97 });
    expect(s?.metrics.recallPi).toBe(1);
  });

  it("returns null when no pair respects the rate", () => {
    const always = SCORES.map((x) => (x.id === "bn-1" ? { ...x, piNoul: 1 } : x));
    expect(selectThresholds([{ dataset: DATASET, scores: always }], [0.85, 0.9], 0)).toBeNull();
  });

  it("adds counts across the pool before computing rates", () => {
    const s = selectThresholds(
      [
        { dataset: DATASET, scores: SCORES },
        { dataset: DATASET, scores: SCORES },
      ],
      [0.97],
      0
    );
    expect(s?.metrics.tp).toBe(6);
    expect(s?.metrics.hardTotal).toBe(4);
  });
});

describe("writeThresholds", () => {
  it("refuses a configuration that already has a commit", () => {
    expect(() =>
      writeThresholds("C10", { prompt_injection: 0.99, secret_leak: 0.99 }, { commitOf: () => "abc123" })
    ).toThrow(/congelad/);
  });
});

describe("compareSelections", () => {
  function sel(pi: number, sl: number, f1: number, recallPi: number, recallSl: number): Selection {
    return {
      thresholds: { prompt_injection: pi, secret_leak: sl },
      metrics: {
        tp: 0, fp: 0, fn: 0, tn: 0, precision: 0, recall: 0, f1, recallPi, recallSl,
        hardFp: 0, hardTotal: 0, latencyMeanMs: null, latencyP95Ms: null,
      },
      candidates: 0,
    };
  }

  it("ranks injection recall above a smaller threshold sum", () => {
    const a = sel(0.9, 0.999, 0.8, 1, 0);
    const b = sel(0.99, 0.85, 0.8, 0, 1);
    expect(compareSelections(a, b)).toBeLessThan(0);
    expect(compareSelections(b, a)).toBeGreaterThan(0);
  });

  it("breaks a full tie by the lower injection threshold", () => {
    expect(compareSelections(sel(0.99, 0.995, 0.8, 1, 1), sel(0.995, 0.99, 0.8, 1, 1))).toBeLessThan(0);
  });
});
