import { describe, expect, it } from "vitest";
import {
  continueOrCreateContext,
  formatTraceparent,
  outgoingTraceHeaders,
  parseTraceparent,
} from "./traceparent.js";

const TRACE_ID = "a".repeat(32);
const SPAN_ID = "b".repeat(16);

describe("formatTraceparent / parseTraceparent", () => {
  it("round-trips a valid W3C traceparent", () => {
    const header = formatTraceparent({ traceId: TRACE_ID, spanId: SPAN_ID });
    expect(header).toBe(`00-${TRACE_ID}-${SPAN_ID}-01`);
    expect(parseTraceparent(header)).toEqual({
      traceId: TRACE_ID,
      spanId: SPAN_ID,
    });
  });

  it("rejects malformed headers", () => {
    expect(parseTraceparent("not-a-trace")).toBeNull();
    expect(parseTraceparent(undefined)).toBeNull();
  });
});

describe("continueOrCreateContext", () => {
  it("continues a W3C trace with a new child span", () => {
    const ctx = continueOrCreateContext({
      traceparent: `00-${TRACE_ID}-${SPAN_ID}-01`,
    });

    expect(ctx.traceId).toBe(TRACE_ID);
    expect(ctx.parentSpanId).toBe(SPAN_ID);
    expect(ctx.spanId).toHaveLength(16);
    expect(ctx.spanId).not.toBe(SPAN_ID);
  });

  it("falls back to X-Trace-Id when traceparent is absent", () => {
    const ctx = continueOrCreateContext({
      "x-trace-id": TRACE_ID,
      "x-span-id": SPAN_ID,
    });

    expect(ctx.traceId).toBe(TRACE_ID);
    expect(ctx.parentSpanId).toBe(SPAN_ID);
  });

  it("creates a root context when no incoming headers exist", () => {
    const ctx = continueOrCreateContext({});
    expect(ctx.traceId).toHaveLength(32);
    expect(ctx.spanId).toHaveLength(16);
    expect(ctx.parentSpanId).toBeUndefined();
  });
});

describe("outgoingTraceHeaders", () => {
  it("emits W3C traceparent plus legacy X-Trace headers", () => {
    const headers = outgoingTraceHeaders({
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      parentSpanId: "c".repeat(16),
    });

    expect(headers.traceparent).toBe(`00-${TRACE_ID}-${SPAN_ID}-01`);
    expect(headers["X-Trace-Id"]).toBe(TRACE_ID);
    expect(headers["X-Span-Id"]).toBe(SPAN_ID);
  });
});
