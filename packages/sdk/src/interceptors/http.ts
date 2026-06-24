import http from "node:http";
import https from "node:https";
import type { LogEvent, LogLevel } from "@traceguard/shared";
import { getContext } from "../core/context.js";
import { now } from "../core/perf.js";
import type { HttpExporter } from "../exporters/http-exporter.js";

type RequestOptions = http.RequestOptions | string | URL;
type RequestCallback = (res: http.IncomingMessage) => void;

let patched = false;
let serviceName = "unknown";
let exporter: HttpExporter | null = null;

function emitLog(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>,
  durationMs?: number
): void {
  if (!exporter) return;

  const ctx = getContext();
  const event: LogEvent = {
    traceId: ctx?.traceId ?? "no-trace",
    spanId: ctx?.spanId ?? "no-span",
    service: serviceName,
    level,
    message,
    metadata,
    durationMs,
    timestamp: new Date().toISOString(),
  };

  exporter.enqueue(event);
}

function normalizeOptions(options: RequestOptions): http.RequestOptions {
  if (typeof options === "string") {
    return new URL(options);
  }
  if (options instanceof URL) {
    return options;
  }
  return { ...options, headers: { ...options.headers } };
}

function injectTraceHeaders(options: http.RequestOptions): http.RequestOptions {
  const ctx = getContext();
  if (!ctx?.traceId) return options;

  // URL não suporta spread nem headers diretamente — converte para RequestOptions
  if (options instanceof URL) {
    return {
      protocol: options.protocol,
      hostname: options.hostname,
      port: options.port ? Number(options.port) : undefined,
      path: `${options.pathname}${options.search}`,
      headers: {
        "X-Trace-Id": ctx.traceId,
        "X-Span-Id": ctx.spanId,
      },
    };
  }

  const headers = { ...(options.headers as Record<string, string>) };
  headers["X-Trace-Id"] = ctx.traceId;
  headers["X-Span-Id"] = ctx.spanId;

  return { ...options, headers };
}

function describeUrl(options: http.RequestOptions): string {
  if (options instanceof URL) return options.href;
  const host = options.hostname ?? options.host ?? "localhost";
  const path = options.path ?? "/";
  const protocol = options.protocol ?? "http:";
  return `${protocol}//${host}${path}`;
}

function createPatchedRequest(
  originalRequest: typeof http.request
): typeof http.request {
  const patchedRequest = function (
    options: RequestOptions,
    callback?: RequestCallback
  ): http.ClientRequest {
    const normalized = injectTraceHeaders(normalizeOptions(options));
    const url = describeUrl(normalized);
    const start = now();
    const ctx = getContext();

    const req = originalRequest(normalized, callback);

    req.on("response", (res) => {
      emitLog(
        "info",
        `HTTP ${req.method ?? "GET"} ${url}`,
        { statusCode: res.statusCode, traceId: ctx?.traceId },
        now() - start
      );
    });

    req.on("error", (err) => {
      emitLog(
        "error",
        `HTTP ${req.method ?? "GET"} ${url} failed`,
        { error: err.message, traceId: ctx?.traceId },
        now() - start
      );
    });

    return req;
  };

  return patchedRequest as typeof http.request;
}

function createPatchedGet(
  patchedRequest: typeof http.request
): typeof http.get {
  const patchedGet = function (
    options: RequestOptions,
    callback?: RequestCallback
  ): http.ClientRequest {
    const req = patchedRequest(options, callback);
    req.end();
    return req;
  };

  return patchedGet as typeof http.get;
}

/**
 * Intercepta http/https .request e .get para injetar headers de trace
 * e emitir logs estruturados com duração de cada requisição outgoing.
 *
 * Nota técnica (monografia): no Node.js, http.get() mantém referência interna
 * à função request original definida no carregamento do módulo — substituir
 * apenas http.request não intercepta chamadas via http.get(). Por isso ambos
 * são patcheados explicitamente.
 */
export function patchHttp(name: string, httpExporter: HttpExporter): void {
  if (patched) return;

  serviceName = name;
  exporter = httpExporter;

  const patchedHttpRequest = createPatchedRequest(http.request.bind(http));
  const patchedHttpsRequest = createPatchedRequest(https.request.bind(https));

  http.request = patchedHttpRequest;
  https.request = patchedHttpsRequest;
  http.get = createPatchedGet(patchedHttpRequest);
  https.get = createPatchedGet(patchedHttpsRequest);

  patched = true;
}

export function unpatchHttp(): void {
  patched = false;
  exporter = null;
}

export { emitLog };
