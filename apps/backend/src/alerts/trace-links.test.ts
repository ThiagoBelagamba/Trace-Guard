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

  it("truncates to the maximum number of linked traces", () => {
    const ids = Array.from({ length: 60 }, (_, i) => `t${i}`);
    const links = buildTraceLinks(ids);
    expect(MAX_LINKED_TRACES).toBe(50);
    expect(links.traceIds).toHaveLength(50);
    expect(links.traceId).toBe("t0");
  });
});
