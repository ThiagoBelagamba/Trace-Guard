import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAYA_DATASET, type LayaCase, type LayaLabel } from "./laya-dataset.ts";
import { checkDatasetIntegrity, loadLayaDatasetFile } from "./laya-dataset-loader.ts";

function writeJson(value: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), "laya-validation-"));
  const file = path.join(dir, "validation.json");
  writeFileSync(file, JSON.stringify(value), "utf8");
  return file;
}

function makeCase(label: LayaLabel, n: number, overrides: Partial<LayaCase> = {}): LayaCase {
  const lang = n % 2 === 0 ? "pt" : "en";
  const text =
    label === "secret_leak"
      ? `credencial de teste número ${n} EXAMPLE${n}`
      : `${label} texto de validação número ${n}`;
  return {
    id: `${label}-${n}`,
    lang,
    label,
    hard: label === "benign" && n % 2 === 0,
    category: "test",
    text,
    ...overrides,
  };
}

function validSet(): LayaCase[] {
  const out: LayaCase[] = [];
  for (const label of ["prompt_injection", "secret_leak", "benign"] as const) {
    for (let n = 0; n < 100; n++) out.push(makeCase(label, n));
  }
  return out;
}

describe("loadLayaDatasetFile", () => {
  it("expands provider prefix placeholders", () => {
    const file = writeJson([
      makeCase("secret_leak", 1, { text: "key {{AWS}}IOSFODNN7EXAMPLE token {{GH}}EXAMPLEabc {{STRIPE}}EXAMPLE1" }),
    ]);
    const [loaded] = loadLayaDatasetFile(file);
    expect(loaded?.text).toBe(`key ${"AK" + "IA"}IOSFODNN7EXAMPLE token ${"gh" + "p_"}EXAMPLEabc ${"sk" + "_live_"}EXAMPLE1`);
  });

  it("names the case when a field is invalid", () => {
    const file = writeJson([makeCase("benign", 1), { ...makeCase("benign", 2), label: "outro" }]);
    expect(() => loadLayaDatasetFile(file)).toThrow(/benign-2/);
  });

  it("rejects a file that is not an array", () => {
    expect(() => loadLayaDatasetFile(writeJson({ cases: [] }))).toThrow(/array/);
  });
});

describe("checkDatasetIntegrity", () => {
  it("accepts 100 balanced cases per class", () => {
    expect(checkDatasetIntegrity(validSet(), { minPerClass: 100, disjointFrom: LAYA_DATASET })).toEqual([]);
  });

  it("reports a class below the minimum", () => {
    const cases = validSet().filter((c) => c.id !== "secret_leak-0");
    expect(checkDatasetIntegrity(cases, { minPerClass: 100 }).join("\n")).toMatch(/secret_leak/);
  });

  it("reports a text copied from the development set, even with other casing and spacing", () => {
    const copied = LAYA_DATASET[0]!;
    const cases = validSet();
    cases[0] = { ...cases[0]!, text: `  ${copied.text.toUpperCase().replace(/ /g, "   ")} ` };
    expect(checkDatasetIntegrity(cases, { minPerClass: 100, disjointFrom: LAYA_DATASET }).join("\n")).toMatch(
      /desenvolvimento/
    );
  });

  it("reports a credential without the EXAMPLE marker", () => {
    const cases = validSet();
    const index = cases.findIndex((c) => c.label === "secret_leak");
    cases[index] = { ...cases[index]!, text: "password=hunter2" };
    expect(checkDatasetIntegrity(cases, { minPerClass: 100 }).join("\n")).toMatch(/EXAMPLE/);
  });

  it("reports duplicated ids and too few hard benign cases", () => {
    const cases = validSet().map((c) => (c.label === "benign" ? { ...c, hard: false } : c));
    cases[1] = { ...cases[1]!, id: cases[0]!.id };
    const problems = checkDatasetIntegrity(cases, { minPerClass: 100 }).join("\n");
    expect(problems).toMatch(/id repetido/);
    expect(problems).toMatch(/difíceis/);
  });

  it("reports fewer hard benign cases than an absolute minimum", () => {
    const problems = checkDatasetIntegrity(validSet(), { minPerClass: 100, minHardBenign: 100 }).join("\n");
    expect(problems).toMatch(/legítimos difíceis: 50, mínimo 100/);
  });

  it("reports a text reused from any earlier set", () => {
    const validation = [makeCase("benign", 999, { id: "val-bn-1", text: "texto já usado na validação" })];
    const cases = validSet();
    cases[0] = { ...cases[0]!, text: "Texto já usado na   validação" };
    const problems = checkDatasetIntegrity(cases, { minPerClass: 100, disjointFrom: [...LAYA_DATASET, ...validation] });
    expect(problems.join("\n")).toMatch(/conjunto anterior/);
  });
});
