import { describe, expect, it } from "vitest";
import { BACKFILL, backfillAll } from "./laya-registry-backfill.ts";

const results = backfillAll();
const get = (config: string, conjunto = "validation") => {
  const r = results.find((x) => x.config === config && x.conjunto === conjunto);
  if (!r) throw new Error(`sem resultado ${config}--${conjunto}`);
  return r.metricas;
};

describe("backfill reproduces the published numbers", () => {
  it("covers every entry", () => {
    expect(results).toHaveLength(BACKFILL.length);
    expect(results.every((r) => r.origem === "extraido-de-saida" && r.commit_config === null)).toBe(true);
  });

  it("C01 and C00 on validation (report §14.2)", () => {
    const c01 = get("C01");
    expect([c01.tp, c01.fp, c01.fn, c01.tn]).toEqual([171, 15, 39, 91]);
    expect(c01.f1).toBeCloseTo(0.864, 3);
    expect(c01.recallSl).toBeCloseTo(0.615, 3);
    expect(c01.hardFp).toBe(15);
    expect(c01.latencyMeanMs).toBeCloseTo(784.1, 1);
    const c00 = get("C00");
    expect([c00.tp, c00.fp, c00.fn, c00.tn]).toEqual([73, 8, 137, 98]);
    expect(c00.hardFp).toBe(8);
  });

  it("C01 and C00 on dev (report §13)", () => {
    const c01 = get("C01", "dev");
    expect([c01.tp, c01.fp, c01.fn, c01.tn]).toEqual([20, 2, 2, 16]);
    const c00 = get("C00", "dev");
    expect([c00.tp, c00.fp, c00.fn, c00.tn]).toEqual([13, 3, 9, 15]);
  });

  it("forced and calibrated checkpoints (report §15–§16)", () => {
    const c02 = get("C02");
    expect([c02.tp, c02.fp, c02.fn, c02.tn]).toEqual([184, 20, 26, 86]);
    expect(c02.hardFp).toBe(19);
    expect([get("C03").tp, get("C03").fp]).toEqual([167, 21]);
    expect([get("C04").tp, get("C04").fp, get("C04").hardFp]).toEqual([142, 8, 7]);
    expect([get("C05").tp, get("C05").fp, get("C05").hardFp]).toEqual([125, 6, 5]);
  });

  it("exploratory rescorings", () => {
    const c06 = get("C06");
    expect(c06.f1).toBeCloseTo(0.801, 3);
    expect(c06.recallSl).toBeCloseTo(0.49, 3);
    const c07 = get("C07");
    expect(c07.f1).toBeCloseTo(0.91, 3);
    expect(c07.recallSl).toBeCloseTo(0.913, 3);
    expect(c07.hardFp).toBe(14);
    const c08 = get("C08");
    expect(c08.f1).toBeCloseTo(0.885, 3);
    expect(c08.recallSl).toBeCloseTo(0.74, 3);
    expect(c08.recallPi).toBeCloseTo(0.802, 3);
    expect(c08.hardFp).toBe(8);
    expect(c08.latencyMeanMs).toBeNull();
    const c09 = get("C09");
    expect(c09.f1).toBeCloseTo(0.814, 3);
    expect(c09.recallSl).toBeCloseTo(0.74, 3);
    expect(c09.recallPi).toBeCloseTo(0.519, 3);
    expect(c09.hardFp).toBe(9);
  });
});
