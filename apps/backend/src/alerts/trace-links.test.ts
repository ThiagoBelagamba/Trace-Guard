import { describe, expect, it } from "vitest";
import { buildTraceLinks, MAX_LINKED_TRACES } from "./trace-links.js";

describe("buildTraceLinks", () => {
  it("drops empty and unknown ids and removes duplicates preserving order", () => {
    expect(buildTraceLinks(["b", "unknown", "", "a", "b"])).toEqual({
      traceId: "b",
      traceIds: ["b", "a"],
    });
  });

  it("returns an empty object when there are no valid ids", () => {
    expect(buildTraceLinks(["unknown"])).toEqual({});
    expect(buildTraceLinks([])).toEqual({});
  });

  it("trims ids and drops blank, UNKNOWN in any case and the all-zero W3C id", () => {
    expect(
      buildTraceLinks(["  ", " a ", "a", "UNKNOWN", "0".repeat(32), "b"])
    ).toEqual({ traceId: "a", traceIds: ["a", "b"] });
  });

  it("returns an empty object when max is below 1", () => {
    expect(buildTraceLinks(["a"], 0)).toEqual({});
  });

  it("truncates to the maximum number of linked traces", () => {
    const ids = Array.from({ length: 60 }, (_, i) => `t${i}`);
    const links = buildTraceLinks(ids);
    expect(MAX_LINKED_TRACES).toBe(50);
    expect(links.traceIds).toHaveLength(50);
    expect(links.traceId).toBe("t0");
  });
});
