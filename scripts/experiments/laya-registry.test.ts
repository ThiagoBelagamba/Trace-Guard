import { describe, expect, it } from "vitest";
import {
  evaluateCriterion,
  parseLayaConfig,
  wilsonInterval,
  type LayaConfig,
  type LayaResult,
  type ResultMetrics,
} from "./laya-registry.ts";

const C10 = {
  id: "C10",
  titulo: "multilingual forçado, limiares por pergunta",
  status: "pre-registrada",
  motivada_por: ["C02", "C09"],
  variante: "sdk",
  checkpoint: "multilingual",
  limiares: { prompt_injection: 0.995, secret_leak: 0.99 },
  min_confidence: 0.8,
  padroes_credencial: false,
  conjunto_ajuste: ["dev", "validation"],
  conjunto_teste: "test",
  criterio: "tres-condicoes-v1",
  referencia: "C00",
};

function metrics(over: Partial<ResultMetrics>): ResultMetrics {
  return {
    tp: 0, fp: 0, fn: 0, tn: 0, precision: 0, recall: 0, f1: 0,
    recallPi: 0, recallSl: 0, hardFp: 0, hardTotal: 54,
    latencyMeanMs: null, latencyP95Ms: null,
    ...over,
  };
}

function result(config: string, conjunto: LayaResult["conjunto"], m: Partial<ResultMetrics>): LayaResult {
  return {
    config, conjunto, data: "2026-11-08", commit_config: null,
    origem: "extraido-de-saida", saida: "saidas/x.md", metricas: metrics(m),
  };
}

function config(over: Partial<LayaConfig>): LayaConfig {
  return { ...parseLayaConfig(C10), ...over };
}

const REF = result("C00", "validation", { f1: 0.502, recallSl: 0.144, hardFp: 8 });

describe("parseLayaConfig", () => {
  it("accepts the spec example", () => {
    expect(parseLayaConfig(C10).limiares).toEqual({ prompt_injection: 0.995, secret_leak: 0.99 });
  });

  it("names every problem it finds", () => {
    expect(() =>
      parseLayaConfig({ ...C10, id: "X1", limiares: { prompt_injection: 1.2, secret_leak: 0.9 } })
    ).toThrow(/id[\s\S]*limiares\.prompt_injection/);
  });

  it("requires a reference except on the reference itself", () => {
    expect(() => parseLayaConfig({ ...C10, referencia: null })).toThrow(/referencia/);
    expect(parseLayaConfig({ ...C10, status: "referencia", referencia: null }).referencia).toBeNull();
  });

  it("accepts a per-question checkpoint only when exploratory", () => {
    const hybrid = { prompt_injection: "english", secret_leak: "multilingual" };
    expect(() => parseLayaConfig({ ...C10, checkpoint: hybrid })).toThrow(/checkpoint/);
    expect(parseLayaConfig({ ...C10, status: "exploratoria", checkpoint: hybrid }).checkpoint).toEqual(hybrid);
  });
});

describe("evaluateCriterion", () => {
  const preregOnValidation = config({ id: "C01", conjunto_teste: "validation" });

  it("fails C01 on hard benign false positives", () => {
    const verdict = evaluateCriterion(
      preregOnValidation,
      result("C01", "validation", { f1: 0.864, recallSl: 0.615, hardFp: 15 }),
      REF
    );
    expect(verdict.atende).toBe(false);
    expect(verdict.rotulo).toBe("não passou");
    expect(verdict.condicoes[2]?.exigido).toBeCloseTo(0.198, 3);
  });

  it("passes when all three conditions hold", () => {
    const verdict = evaluateCriterion(
      preregOnValidation,
      result("C01", "validation", { f1: 0.864, recallSl: 0.615, hardFp: 5 }),
      REF
    );
    expect(verdict.rotulo).toBe("passou");
  });

  it("never says passed for an exploratory configuration", () => {
    const explo = config({ id: "C05", status: "exploratoria", conjunto_teste: "validation" });
    expect(evaluateCriterion(explo, result("C05", "validation", { f1: 0.733, recallSl: 0.615, hardFp: 5 }), REF).rotulo)
      .toBe("atende numericamente (sem pré-registro)");
    expect(evaluateCriterion(explo, result("C05", "validation", { f1: 0.9, recallSl: 0.9, hardFp: 19 }), REF).rotulo)
      .toBe("não atende");
  });

  it("treats a pre-registered configuration outside its test set as exploratory", () => {
    const onDev = evaluateCriterion(
      config({ id: "C10" }),
      result("C10", "validation", { f1: 0.9, recallSl: 0.9, hardFp: 5 }),
      REF
    );
    expect(onDev.rotulo).toBe("atende numericamente (sem pré-registro)");
  });

  it("refuses to compare results from different sets", () => {
    expect(() =>
      evaluateCriterion(preregOnValidation, result("C01", "dev", { f1: 0.9 }), REF)
    ).toThrow(/mesmo conjunto/);
  });
});

describe("wilsonInterval", () => {
  it("matches the 95% interval for 9 of 54", () => {
    const [lo, hi] = wilsonInterval(9, 54);
    expect(lo).toBeCloseTo(0.09, 3);
    expect(hi).toBeCloseTo(0.287, 3);
  });
});
