import { performance, PerformanceObserver } from "node:perf_hooks";

/**
 * Utilitários de medição de performance via perf_hooks nativo do Node.js.
 * Usado para medir duração de spans HTTP e monitorar atraso do event loop.
 */

export function now(): number {
  return performance.now();
}

export function measureDuration<T>(fn: () => T): { result: T; durationMs: number } {
  const start = performance.now();
  const result = fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

export async function measureDurationAsync<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

let eventLoopObserver: PerformanceObserver | null = null;
let lastEventLoopDelayMs = 0;

/**
 * Monitora atraso do event loop (indicador de saturação da aplicação).
 * Útil para correlacionar lentidão com traces no dashboard.
 */
export function startEventLoopMonitoring(): void {
  if (eventLoopObserver) return;

  eventLoopObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const last = entries[entries.length - 1];
    if (last) {
      lastEventLoopDelayMs = last.duration;
    }
  });

  eventLoopObserver.observe({ entryTypes: ["gc"], buffered: true });
}

export function getLastEventLoopDelayMs(): number {
  return lastEventLoopDelayMs;
}

export function stopEventLoopMonitoring(): void {
  if (eventLoopObserver) {
    eventLoopObserver.disconnect();
    eventLoopObserver = null;
  }
}
