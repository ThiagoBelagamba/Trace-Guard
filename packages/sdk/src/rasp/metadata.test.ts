import { describe, expect, it } from "vitest";
import { DEFAULT_RASP_BLOCK_THRESHOLD, RASP_THREAT_WEIGHTS } from "@traceguard/shared";
import { buildRaspMetadata } from "./metadata.js";

describe("buildRaspMetadata", () => {
  it("records the effective threshold and mode alongside the threats", () => {
    expect(buildRaspMetadata(["bot_user_agent"], { blockThreshold: 85, mode: "monitor" }))
      .toEqual({ threats: ["bot_user_agent"], blockThreshold: 85, mode: "monitor" });
  });
});

describe("shared RASP constants", () => {
  it("keeps the published heuristic weights and default threshold", () => {
    expect(RASP_THREAT_WEIGHTS).toEqual({
      sequential_scan: 60, bot_user_agent: 50, rate_limit: 40, missing_headers: 20,
    });
    expect(DEFAULT_RASP_BLOCK_THRESHOLD).toBe(70);
  });
});
