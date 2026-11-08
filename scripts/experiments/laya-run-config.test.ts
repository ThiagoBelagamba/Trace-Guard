import { describe, expect, it } from "vitest";
import { parseLayaConfig, type LayaConfig } from "./laya-registry.ts";
import {
  assertCommitted,
  cleanCommit,
  codeRevision,
  configCommit,
  refuseTestOverwrite,
  resolveRunPlan,
  sdkPolicy,
} from "./laya-run-config.ts";

const C02 = parseLayaConfig({
  id: "C02",
  titulo: "multilingual forçado",
  status: "exploratoria",
  motivada_por: ["C01"],
  variante: "sdk",
  checkpoint: "multilingual",
  limiares: { prompt_injection: 0.85, secret_leak: 0.85 },
  min_confidence: 0.8,
  padroes_credencial: false,
  conjunto_ajuste: [],
  conjunto_teste: "validation",
  criterio: "tres-condicoes-v1",
  referencia: "C00",
});

const load = (over: Partial<LayaConfig> = {}) => () => ({ ...C02, ...over });

describe("resolveRunPlan", () => {
  it("keeps the old behavior without LAYA_CONFIG", () => {
    expect(resolveRunPlan({}, load())).toBeNull();
  });

  it("uses the configuration's test set by default", () => {
    expect(resolveRunPlan({ LAYA_CONFIG: "C02" }, load())).toEqual({ config: C02, dataset: "validation" });
    expect(resolveRunPlan({ LAYA_CONFIG: "C02", LAYA_DATASET: "dev" }, load())?.dataset).toBe("dev");
  });

  it("refuses loose variables next to LAYA_CONFIG", () => {
    expect(() => resolveRunPlan({ LAYA_CONFIG: "C02", LAYA_MODEL: "english" }, load())).toThrow(/LAYA_MODEL/);
    expect(() => resolveRunPlan({ LAYA_CONFIG: "C02", LAYA_VARIANTS: "sdk" }, load())).toThrow(/LAYA_VARIANTS/);
    expect(() => resolveRunPlan({ LAYA_CONFIG: "C02", LAYA_STAGES: "all" }, load())).toThrow(/LAYA_STAGES/);
    expect(() => resolveRunPlan({ LAYA_CONFIG: "C02", LAYA_REPS: "3" }, load())).toThrow(/LAYA_REPS/);
    expect(resolveRunPlan({ LAYA_CONFIG: "C02", LAYA_STAGES: "accuracy" }, load())).not.toBeNull();
  });

  it("refuses a per-question checkpoint and a retuned baseline", () => {
    const hybrid = load({ checkpoint: { prompt_injection: "english", secret_leak: "multilingual" } });
    expect(() => resolveRunPlan({ LAYA_CONFIG: "C02" }, hybrid)).toThrow(/híbrido/);
    const baseline = load({ variante: "baseline", limiares: { prompt_injection: 0.9, secret_leak: 0.8 } });
    expect(() => resolveRunPlan({ LAYA_CONFIG: "C02" }, baseline)).toThrow(/baseline/);
    const frozen = { variante: "baseline" as const, checkpoint: "roteamento" as const, limiares: { prompt_injection: 0.8, secret_leak: 0.8 } };
    expect(resolveRunPlan({ LAYA_CONFIG: "C02" }, load(frozen))).not.toBeNull();
    expect(() => resolveRunPlan({ LAYA_CONFIG: "C02" }, load({ ...frozen, checkpoint: "multilingual" }))).toThrow(/checkpoint/);
    expect(() => resolveRunPlan({ LAYA_CONFIG: "C02" }, load({ ...frozen, min_confidence: 0.9 }))).toThrow(/min_confidence/);
    expect(() => resolveRunPlan({ LAYA_CONFIG: "C02" }, load({ ...frozen, padroes_credencial: true }))).toThrow(/padroes_credencial/);
  });

  it("refuses an unknown dataset", () => {
    expect(() => resolveRunPlan({ LAYA_CONFIG: "C02", LAYA_DATASET: "prod" }, load())).toThrow(/LAYA_DATASET/);
  });
});

describe("assertCommitted", () => {
  const git = (status: string, log: string) => (args: string[]) => (args[0] === "status" ? status : log);

  it("refuses a configuration with uncommitted changes", () => {
    expect(() => assertCommitted("C10.json", git(" M C10.json", "abc123"))).toThrow(/não commitad/);
  });

  it("refuses a configuration that was never committed", () => {
    expect(() => assertCommitted("C10.json", git("", ""))).toThrow(/não commitad/);
  });

  it("returns the commit hash of a clean configuration", () => {
    expect(assertCommitted("C10.json", git("", "abc123"))).toBe("abc123");
    expect(configCommit("C10.json", git("", ""))).toBeNull();
  });
});

describe("sdkPolicy", () => {
  it("applies the threshold of each question", () => {
    const policy = sdkPolicy({ prompt_injection: 0.995, secret_leak: 0.99 });
    const signal = { noul: 0.992, question: "prompt_injection" as const };
    expect(policy.isHit(signal, "prompt_injection")).toBe(false);
    expect(policy.isHit({ ...signal, question: "sensitive_data" }, "secret_leak")).toBe(true);
  });
});

describe("cleanCommit", () => {
  const git = (status: string, log: string) => (args: string[]) => (args[0] === "status" ? status : log);

  it("returns no commit when the configuration has local changes", () => {
    expect(cleanCommit("C02.json", git(" M C02.json", "abc123"))).toBeNull();
    expect(cleanCommit("C02.json", git("", "abc123"))).toBe("abc123");
  });
});

describe("codeRevision", () => {
  it("records HEAD and whether the tree has changes", () => {
    const git = (status: string) => (args: string[]) => (args[0] === "status" ? status : "def456");
    expect(codeRevision(git(""))).toEqual({ commit: "def456", modificado: false });
    expect(codeRevision(git(" M scripts/x.ts"))).toEqual({ commit: "def456", modificado: true });
  });
});

describe("refuseTestOverwrite", () => {
  it("refuses to overwrite a test-set result", () => {
    expect(() => refuseTestOverwrite("test", "resultados/C10--test.json", () => true)).toThrow(/já existe/);
    expect(() => refuseTestOverwrite("test", "resultados/C10--test.json", () => false)).not.toThrow();
    expect(() => refuseTestOverwrite("validation", "resultados/C02--validation.json", () => true)).not.toThrow();
  });
});
