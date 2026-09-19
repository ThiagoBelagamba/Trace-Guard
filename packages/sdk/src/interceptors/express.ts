import type { RequestHandler } from "express";
import { getContext, runWithContext } from "../core/context.js";
import { bindContext } from "../core/hooks.js";
import { continueOrCreateContext } from "../core/traceparent.js";
import { getRaspRuntime } from "../runtime.js";
import { getHeader } from "../rasp/fingerprints.js";
import type { IncomingRequestLike, RaspConfig } from "../rasp/types.js";

function extractClientIp(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): string {
  const forwarded = getHeader(req.headers, "x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

function toIncomingRequest(req: {
  method: string;
  path: string;
  originalUrl?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}): IncomingRequestLike {
  return {
    method: req.method,
    path: req.originalUrl ?? req.url ?? req.path ?? "/",
    headers: req.headers,
    ip: req.ip,
    socket: req.socket,
  };
}

/**
 * Middleware Express RASP — detecção e bloqueio de scraping em runtime.
 */
export function raspMiddleware(options?: Partial<RaspConfig>): RequestHandler {
  return (req, res, next) => {
    const runtime = getRaspRuntime();
    if (!runtime) {
      console.warn("[traceguard-sdk] raspMiddleware sem init() — passando request");
      next();
      return;
    }

    const effectiveConfig: RaspConfig = {
      ...runtime.config,
      ...options,
    };

    if (!effectiveConfig.enabled) {
      next();
      return;
    }

    void (async () => {
      const ctx = continueOrCreateContext(
        req.headers as Record<string, string | string[] | undefined>
      );
      bindContext(ctx);
      await runWithContext(ctx, async () => {
        const clientIp = extractClientIp(req);
        const incoming = toIncomingRequest(req);
        const { score, threats } = await runtime.detector.analyze(
          incoming,
          clientIp
        );

        if (threats.length === 0) {
          next();
          return;
        }

        const context = getContext();
        const shouldBlock =
          effectiveConfig.mode === "block" &&
          score >= effectiveConfig.blockThreshold;
        const threatType = runtime.detector.primaryThreat(threats);
        const userAgent = getHeader(req.headers, "user-agent");

        const event = {
          traceId: context?.traceId ?? "unknown",
          spanId: context?.spanId ?? "unknown",
          service: runtime.serviceName,
          threatType,
          action: shouldBlock ? ("blocked" as const) : ("logged" as const),
          clientIp,
          userAgent,
          path: incoming.path,
          method: incoming.method,
          score,
          metadata: { threats },
          timestamp: new Date().toISOString(),
        };

        runtime.exporter.enqueue(event);

        if (shouldBlock) {
          res.status(403).json({
            error: "Request blocked by TraceGuard RASP",
            threatType,
            traceId: event.traceId,
            score,
          });
          return;
        }

        next();
      });
    })().catch((err) => {
      console.error("[traceguard-sdk] raspMiddleware erro:", err);
      next(err);
    });
  };
}

/** @deprecated Use raspMiddleware — placeholder legado */
export function traceGuardMiddleware(): void {
  throw new Error("Use raspMiddleware() de @traceguard/sdk/express");
}
