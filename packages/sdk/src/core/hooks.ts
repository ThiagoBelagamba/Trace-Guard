import {
  createHook,
  type AsyncHook,
  executionAsyncId,
  triggerAsyncId,
} from "node:async_hooks";
import type { TraceContext } from "@traceguard/shared";
import { getContext } from "./context.js";

/**
 * Mapa que associa cada asyncId a seu TraceContext.
 * Quando um novo recurso assíncrono é criado (init), herdamos o contexto
 * do recurso pai (triggerAsyncId). Quando destruído (destroy), limpamos
 * a entrada para evitar memory leak.
 *
 * Decisão técnica: async_hooks opera no nível do event loop do Node.js,
 * capturando timers, I/O, Promises e callbacks — garantindo propagação
 * mesmo em código que não usa async/await explicitamente.
 */
const asyncContextMap = new Map<number, TraceContext>();

let hook: AsyncHook | null = null;

export function enableAsyncHooks(): void {
  if (hook) return;

  hook = createHook({
    init(asyncId: number, _type: string, triggerId: number) {
      const parentContext =
        asyncContextMap.get(triggerId) ?? getContext();

      if (parentContext) {
        asyncContextMap.set(asyncId, parentContext);
      }
    },

    before(asyncId: number) {
      const ctx = asyncContextMap.get(asyncId);
      if (ctx) {
        // Garante que AsyncLocalStorage tenha o contexto correto
        // durante a execução deste recurso assíncrono
        asyncContextMap.set(executionAsyncId(), ctx);
      }
    },

    destroy(asyncId: number) {
      asyncContextMap.delete(asyncId);
    },
  });

  hook.enable();
}

export function disableAsyncHooks(): void {
  if (hook) {
    hook.disable();
    hook = null;
  }
  asyncContextMap.clear();
}

export function bindContext(ctx: TraceContext): void {
  asyncContextMap.set(executionAsyncId(), ctx);
}

export function getAsyncContext(asyncId: number): TraceContext | undefined {
  return asyncContextMap.get(asyncId);
}
