import { describe, expect, it } from "vitest";
import type { LayaCase } from "../core/laya-dataset.ts";
import { calibrationRecord, calibrationTargets } from "./laya-calibration-export.ts";

function item(label: LayaCase["label"], text = "texto"): LayaCase {
  return { id: `x-${label}`, lang: "pt", label, hard: false, category: "t", text };
}

describe("calibrationTargets", () => {
  it("marks both injection questions true for a prompt injection", () => {
    expect(calibrationTargets(item("prompt_injection"))).toEqual({
      jailbreak: true,
      prompt_injection: true,
      sensitive_data: false,
    });
  });

  it("marks only sensitive_data true for a secret leak", () => {
    expect(calibrationTargets(item("secret_leak"))).toEqual({
      jailbreak: false,
      prompt_injection: false,
      sensitive_data: true,
    });
  });

  it("marks every question false for a benign text", () => {
    expect(calibrationTargets(item("benign"))).toEqual({
      jailbreak: false,
      prompt_injection: false,
      sensitive_data: false,
    });
  });
});

describe("calibrationRecord", () => {
  it("puts the SDK-extracted text in state.prompt", () => {
    expect(calibrationRecord(item("benign", "  oi  "))).toEqual({
      id: "x-benign",
      state: { prompt: "oi" },
      targets: { jailbreak: false, prompt_injection: false, sensitive_data: false },
    });
  });
});
