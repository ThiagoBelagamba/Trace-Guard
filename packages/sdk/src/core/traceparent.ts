import { randomBytes } from "node:crypto";
import type { TraceContext } from "@traceguard/shared";
import { createRootContext } from "./context.js";

const TRACEPARENT_RE =
  /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;

export function formatTraceparent(ctx: {
  traceId: string;
  spanId: string;
}): string {
  return `00-${ctx.traceId}-${ctx.spanId}-01`;
}

export function parseTraceparent(
  header: string | undefined
): { traceId: string; spanId: string } | null {
  if (!header) return null;
  const match = TRACEPARENT_RE.exec(header.trim());
  if (!match) return null;
  return {
    traceId: match[1].toLowerCase(),
    spanId: match[2].toLowerCase(),
  };
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function newSpanId(): string {
  return randomBytes(8).toString("hex");
}

/**
 * Continua um trace incoming (W3C traceparent ou X-Trace-Id) ou cria um root.
 * Sempre gera um spanId novo — o span recebido vira parentSpanId.
 */
export function continueOrCreateContext(
  headers: Record<string, string | string[] | undefined>
): TraceContext {
  const w3c = parseTraceparent(headerValue(headers, "traceparent"));
  if (w3c) {
    return {
      traceId: w3c.traceId,
      spanId: newSpanId(),
      parentSpanId: w3c.spanId,
    };
  }

  const legacyTrace = headerValue(headers, "x-trace-id");
  if (legacyTrace && legacyTrace.length >= 16) {
    const legacySpan = headerValue(headers, "x-span-id");
    return {
      traceId: legacyTrace.slice(0, 32),
      spanId: newSpanId(),
      parentSpanId: legacySpan,
    };
  }

  return createRootContext();
}

export function outgoingTraceHeaders(ctx: TraceContext): Record<string, string> {
  return {
    traceparent: formatTraceparent(ctx),
    "X-Trace-Id": ctx.traceId,
    "X-Span-Id": ctx.spanId,
  };
}
