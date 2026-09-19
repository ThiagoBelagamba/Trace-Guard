import {
  createRootContext,
  getContext,
  runWithContext,
} from "./core/context.js";
import { bindContext, disableAsyncHooks, enableAsyncHooks } from "./core/hooks.js";
import {
  startEventLoopMonitoring,
  stopEventLoopMonitoring,
} from "./core/perf.js";
import { HttpExporter } from "./exporters/http-exporter.js";
import { patchHttp, unpatchHttp } from "./interceptors/http.js";
import type { RaspConfig } from "./rasp/types.js";
import {
  getRaspRuntime,
  initRaspRuntime,
  shutdownRaspRuntime,
} from "./runtime.js";

export type { RaspConfig } from "./rasp/types.js";
export { DEFAULT_RASP_CONFIG } from "./rasp/types.js";

export interface TraceGuardConfig {
  serviceName: string;
  endpoint: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  apiKey?: string;
  rasp?: Partial<RaspConfig>;
  raspEndpoint?: string;
}

let initialized = false;
let exporter: HttpExporter | null = null;
let serviceName = "";

/**
 * Inicializa o agente de telemetria TraceGuard.
 * Deve ser chamado uma vez no bootstrap da aplicação monitorada.
 */
export function init(config: TraceGuardConfig): void {
  if (initialized) {
    console.warn("[traceguard-sdk] init() já foi chamado, ignorando");
    return;
  }

  exporter = new HttpExporter({
    endpoint: config.endpoint,
    flushIntervalMs: config.flushIntervalMs,
    maxBatchSize: config.maxBatchSize,
    apiKey: config.apiKey,
  });

  exporter.start();
  enableAsyncHooks();
  startEventLoopMonitoring();
  patchHttp(config.serviceName, exporter);
  serviceName = config.serviceName;

  const raspCfg = config.rasp;
  if (raspCfg?.enabled !== false) {
    const base = config.endpoint.replace(/\/$/, "");
    const raspEndpoint =
      config.raspEndpoint ?? `${base}/rasp`;
    initRaspRuntime(config.serviceName, raspEndpoint, raspCfg, config.apiKey);
  }

  initialized = true;
  console.log(
    `[traceguard-sdk] Inicializado para serviço "${config.serviceName}" → ${config.endpoint}`
  );
}

/**
 * Encerra o SDK com flush final do buffer de telemetria.
 */
export async function shutdown(): Promise<void> {
  if (!initialized) return;

  unpatchHttp();
  disableAsyncHooks();
  stopEventLoopMonitoring();

  if (exporter) {
    await exporter.shutdown();
    exporter = null;
  }

  await shutdownRaspRuntime();
  serviceName = "";
  initialized = false;
}

export function getServiceName(): string {
  return serviceName;
}

export { getRaspRuntime };

/**
 * Executa uma função dentro de um novo trace root.
 * Útil para iniciar rastreamento em handlers HTTP ou jobs.
 */
export function withTrace<T>(fn: () => T): T {
  const ctx = createRootContext();
  bindContext(ctx);
  return runWithContext(ctx, fn);
}

/**
 * Executa uma função assíncrona dentro de um novo trace root.
 */
export async function withTraceAsync<T>(fn: () => Promise<T>): Promise<T> {
  const ctx = createRootContext();
  bindContext(ctx);
  return runWithContext(ctx, fn);
}

export { getContext, createRootContext, createChildContext } from "./core/context.js";
export {
  formatTraceparent,
  parseTraceparent,
  continueOrCreateContext,
} from "./core/traceparent.js";
