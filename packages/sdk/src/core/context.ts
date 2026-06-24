import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import type { TraceContext } from "@traceguard/shared";

/**
 * AsyncLocalStorage é a API de alto nível construída sobre async_hooks do Node.js.
 * Permite armazenar contexto (traceId/spanId) que persiste automaticamente através
 * de callbacks, Promises e microtasks — sem precisar passar o contexto manualmente.
 *
 * Decisão técnica (monografia): mesma abordagem usada pelo OpenTelemetry Node SDK,
 * com overhead mínimo pois o store é consultado apenas no início/fim de operações.
 */
const storage = new AsyncLocalStorage<TraceContext>();

export function getContext(): TraceContext | undefined {
  return storage.getStore();
}

export function runWithContext<T>(ctx: TraceContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function createRootContext(): TraceContext {
  return {
    traceId: randomBytes(16).toString("hex"),
    spanId: randomBytes(8).toString("hex"),
  };
}

export function createChildContext(parent: TraceContext): TraceContext {
  return {
    traceId: parent.traceId,
    spanId: randomBytes(8).toString("hex"),
    parentSpanId: parent.spanId,
  };
}

export { storage as traceStorage };
