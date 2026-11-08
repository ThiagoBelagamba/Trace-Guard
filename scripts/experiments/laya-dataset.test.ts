import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  extractInspectableText,
  LAYA_MAX_PAYLOAD_CHARS,
} from "../../packages/sdk/src/rasp/laya-shadow.ts";
import { LAYA_DATASET, type LayaLabel } from "./laya-dataset.ts";

function byLabel(label: LayaLabel) {
  return LAYA_DATASET.filter((item) => item.label === label);
}

describe("LAYA_DATASET", () => {
  it("has 12 prompt injection, 10 secret leak and 18 benign cases", () => {
    expect(byLabel("prompt_injection")).toHaveLength(12);
    expect(byLabel("secret_leak")).toHaveLength(10);
    expect(byLabel("benign")).toHaveLength(18);
  });

  it("marks at least 9 benign cases as hard and no threat as hard", () => {
    expect(byLabel("benign").filter((item) => item.hard).length).toBeGreaterThanOrEqual(9);
    expect(LAYA_DATASET.filter((item) => item.label !== "benign" && item.hard)).toHaveLength(0);
  });

  it("uses unique ids", () => {
    const ids = LAYA_DATASET.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("splits languages close to half", () => {
    const pt = LAYA_DATASET.filter((item) => item.lang === "pt").length;
    expect(pt).toBeGreaterThanOrEqual(18);
    expect(pt).toBeLessThanOrEqual(22);
    for (const label of ["prompt_injection", "secret_leak", "benign"] as const) {
      const langs = new Set(byLabel(label).map((item) => item.lang));
      expect(langs).toEqual(new Set(["pt", "en"]));
    }
  });

  it("covers at least 6 injection categories and 5 secret categories", () => {
    expect(new Set(byLabel("prompt_injection").map((i) => i.category)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(byLabel("secret_leak").map((i) => i.category)).size).toBeGreaterThanOrEqual(5);
  });

  it("keeps every secret_leak text marked as EXAMPLE", () => {
    for (const item of byLabel("secret_leak")) {
      expect(item.text, item.id).toMatch(/example/i);
    }
  });

  it("never writes provider secret prefixes literally in the source", () => {
    const source = readFileSync(new URL("./laya-dataset.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/sk_live_|ghp_|AKIA[0-9A-Z]{4}/);
  });

  it("keeps every text within LAYA_MAX_PAYLOAD_CHARS", () => {
    for (const item of LAYA_DATASET) {
      expect(item.text.trim().length, item.id).toBeGreaterThan(0);
      expect(item.text.length, item.id).toBeLessThanOrEqual(LAYA_MAX_PAYLOAD_CHARS);
    }
  });

  it("reaches the sidecar as the plain text the SDK extracts from { message }", () => {
    for (const item of LAYA_DATASET) {
      expect(extractInspectableText({ message: item.text }), item.id).toBe(item.text.trim());
    }
  });
});
