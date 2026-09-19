import {
  monitorEventLoopDelay,
  performance,
  type IntervalHistogram,
} from "node:perf_hooks";

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

let eventLoopHistogram: IntervalHistogram | null = null;

/**
 * Monitora atraso do event loop (indicador de saturação da aplicação).
 * Usa monitorEventLoopDelay — histogram em nanossegundos.
 */
export function startEventLoopMonitoring(): void {
  if (eventLoopHistogram) return;

  eventLoopHistogram = monitorEventLoopDelay({ resolution: 1 });
  eventLoopHistogram.enable();
}

export function getLastEventLoopDelayMs(): number {
  if (!eventLoopHistogram) return 0;
  return eventLoopHistogram.max / 1e6;
}

export function stopEventLoopMonitoring(): void {
  if (eventLoopHistogram) {
    eventLoopHistogram.disable();
    eventLoopHistogram = null;
  }
}
