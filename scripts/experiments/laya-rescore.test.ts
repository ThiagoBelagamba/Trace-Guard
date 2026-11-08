import { describe, expect, it } from "vitest";
import type { LayaCase } from "./laya-dataset.ts";
import {
  mergeScores,
  metricsFor,
  parseCaseScores,
  parseLatency,
  verdictFromScore,
  type CaseScore,
} from "./laya-rescore.ts";

const OUTPUT = `## Experimento 4 — Laya (sidecar em modo sombra)

### 4.1 Acurácia — SDK atual (R1–R5)

| Caso | Idioma | Rótulo | Difícil | Veredito | noul PI | noul SL |
|---|---|---|---|---|---:|---:|
| val-pi-006 | pt | prompt_injection | não | secret_leak | 0.740 (abst.) | 0.897 |
| val-sl-001 | en | secret_leak | não | secret_leak | 0.100 | 0.990 |
| val-bn-001 | pt | legítimo | sim | legítimo | — | 0.020 |

### 4.2 Latência do modelo

| Alvo | média (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|
| Laya /v1/systemone | 784.1 | 653.0 | 1564.0 |

### 4.1 Acurácia — Linha de base (pré-R1)

| Caso | Idioma | Rótulo | Difícil | Veredito | noul PI | noul SL |
|---|---|---|---|---|---:|---:|
| val-pi-006 | pt | prompt_injection | não | legítimo | 0.500 | 0.100 |
| val-sl-001 | en | secret_leak | não | prompt_injection | 0.950 | 0.900 |
| val-bn-001 | pt | legítimo | sim | legítimo | 0.010 | 0.020 |

### 4.2 Latência do modelo

| Alvo | média (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|
| Laya /v1/systemone | 633.0 | 600.0 | 1286.0 |
`;

const DATASET: LayaCase[] = [
  { id: "val-pi-006", lang: "pt", label: "prompt_injection", hard: false, category: "x", text: "a" },
  { id: "val-sl-001", lang: "en", label: "secret_leak", hard: false, category: "x", text: "b" },
  { id: "val-bn-001", lang: "pt", label: "benign", hard: true, category: "x", text: "c" },
];

const T85 = { prompt_injection: 0.85, secret_leak: 0.85 };

function score(over: Partial<CaseScore>): CaseScore {
  return { id: "x", piNoul: null, slNoul: null, piAbst: false, slAbst: false, ...over };
}

describe("parseCaseScores", () => {
  it("reads scores, abstentions and missing signals of the SDK section", () => {
    const scores = parseCaseScores(OUTPUT, "sdk");
    expect(scores).toHaveLength(3);
    expect(scores[0]).toEqual({ id: "val-pi-006", piNoul: 0.74, piAbst: true, slNoul: 0.897, slAbst: false });
    expect(scores[2]?.piNoul).toBeNull();
  });

  it("reads development-set ids, which have no number", () => {
    const dev = OUTPUT.replace("| val-sl-001 | en |", "| pi-system-prompt-en | en |");
    expect(parseCaseScores(dev, "sdk").map((s) => s.id)).toContain("pi-system-prompt-en");
  });

  it("reads only the baseline section when asked", () => {
    const scores = parseCaseScores(OUTPUT, "baseline");
    expect(scores.map((s) => s.piNoul)).toEqual([0.5, 0.95, 0.01]);
  });
});

describe("parseLatency", () => {
  it("reads mean and p95 of each section", () => {
    expect(parseLatency(OUTPUT, "sdk")).toEqual({ meanMs: 784.1, p95Ms: 1564 });
    expect(parseLatency(OUTPUT, "baseline")).toEqual({ meanMs: 633, p95Ms: 1286 });
  });
});

describe("verdictFromScore", () => {
  it("never flags an abstained signal", () => {
    expect(verdictFromScore(score({ piNoul: 0.99, piAbst: true }), T85, "sdk").piHit).toBe(false);
  });

  it("applies each question's own threshold", () => {
    const t = { prompt_injection: 0.85, secret_leak: 0.95 };
    expect(verdictFromScore(score({ slNoul: 0.9 }), t, "sdk").slHit).toBe(false);
    const hit = verdictFromScore(score({ slNoul: 0.96, piNoul: 0.9 }), t, "sdk");
    expect(hit.slHit).toBe(true);
    expect(hit.threatType).toBe("secret_leak");
    expect(hit.flagged).toBe(hit.piHit || hit.slHit);
  });

  it("picks the stronger score in the baseline", () => {
    const v = verdictFromScore(score({ piNoul: 0.95, slNoul: 0.9 }), T85, "baseline");
    expect(v.threatType).toBe("prompt_injection");
  });
});

describe("mergeScores", () => {
  it("takes injection from the first and credential from the second", () => {
    const merged = mergeScores(
      [score({ id: "a", piNoul: 0.9, slNoul: 0.1 })],
      [score({ id: "a", piNoul: 0.2, slNoul: 0.8, slAbst: true })]
    );
    expect(merged).toEqual([{ id: "a", piNoul: 0.9, piAbst: false, slNoul: 0.8, slAbst: true }]);
  });

  it("throws when an id is missing", () => {
    expect(() => mergeScores([score({ id: "a" })], [score({ id: "b" })])).toThrow(/a/);
  });
});

describe("metricsFor", () => {
  it("rebuilds the confusion matrix from scores", () => {
    const m = metricsFor(DATASET, parseCaseScores(OUTPUT, "sdk"), T85, "sdk");
    expect([m.tp, m.fp, m.fn, m.tn]).toEqual([2, 0, 0, 1]);
    expect(m.recallSl).toBe(1);
    expect(m.recallPi).toBe(0);
    expect([m.hardFp, m.hardTotal]).toEqual([0, 1]);
    expect(m.latencyMeanMs).toBeNull();
  });
});
