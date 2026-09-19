import { describe, expect, it } from "vitest";
import { computeClassificationMetrics } from "./metrics.js";

describe("computeClassificationMetrics", () => {
  it("computes precision, recall and F1 from a labeled confusion matrix", () => {
    const metrics = computeClassificationMetrics([
      { expectedThreat: true, detected: true },
      { expectedThreat: true, detected: true },
      { expectedThreat: true, detected: false },
      { expectedThreat: false, detected: false },
      { expectedThreat: false, detected: true },
    ]);

    expect(metrics).toEqual({
      tp: 2,
      fp: 1,
      fn: 1,
      tn: 1,
      precision: 2 / 3,
      recall: 2 / 3,
      f1: 2 / 3,
      youden: 2 / 3 - 1 / 2,
    });
  });

  it("returns zeros when there are no positive predictions or labels", () => {
    const metrics = computeClassificationMetrics([
      { expectedThreat: false, detected: false },
      { expectedThreat: false, detected: false },
    ]);

    expect(metrics).toEqual({
      tp: 0,
      fp: 0,
      fn: 0,
      tn: 2,
      precision: 0,
      recall: 0,
      f1: 0,
      youden: 0,
    });
  });
});
