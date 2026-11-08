import type { RaspEvent } from "@traceguard/shared";
import {
  inspectPayloadWithLaya,
  type LayaInspectionResult,
} from "./laya-inspector.js";

export const LAYA_MAX_PAYLOAD_CHARS = 8_000;
const TEXT_METHODS = new Set(["POST", "PUT", "PATCH"]);

export interface LayaGate {
  tryAcquire(): boolean;
  release(): void;
}

export function createLayaGate(maxInFlight: number): LayaGate {
  let current = 0;
  return {
    tryAcquire() {
      if (current >= maxInFlight) return false;
      current += 1;
      return true;
    },
    release() {
      current = Math.max(0, current - 1);
    },
  };
}

/**
 * Cobertura do modo sombra (R8). Um corpo sem texto não entra em nenhum
 * contador; scheduled = dropped + inspected + failed depois que tudo termina.
 */
export interface LayaShadowCounters {
  /** Texto extraído e entregue ao gate. */
  scheduled: number;
  /** O gate estava cheio: o texto não foi inspecionado. */
  dropped: number;
  /** O sidecar respondeu. */
  inspected: number;
  /** Falha de transporte (resultado null), incluindo timeouts. */
  failed: number;
  /** Subconjunto de failed: o sidecar não respondeu dentro do prazo. */
  timedOut: number;
  /** Subconjunto de inspected: virou evento. */
  flagged: number;
}

export function createLayaShadowCounters(): LayaShadowCounters {
  return { scheduled: 0, dropped: 0, inspected: 0, failed: 0, timedOut: 0, flagged: 0 };
}

export interface LayaShadowJob {
  method: string;
  body: unknown;
  traceId: string;
  spanId: string;
  service: string;
  clientIp: string;
  userAgent?: string;
  path: string;
  layaUrl: string;
  apiKey?: string;
  /** Checkpoint forçado (R7); sem ele o sidecar escolhe pelo idioma. */
  model?: string;
  gate: LayaGate;
  counters?: LayaShadowCounters;
  inspect?: typeof inspectPayloadWithLaya;
  enqueue: (event: RaspEvent) => void;
  flush: () => Promise<void>;
}

const MAX_BODY_DEPTH = 32;

function collectStrings(value: unknown, depth: number, out: string[]): void {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) out.push(trimmed);
    return;
  }
  if (typeof value !== "object" || value === null || depth >= MAX_BODY_DEPTH) return;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    collectStrings(child, depth + 1, out);
  }
}

/**
 * Texto que o sidecar classifica: os valores string do corpo, em ordem, um
 * por linha. O envelope JSON ({"message": ...}) mudava as notas de forma
 * imprevisível (relatório do Experimento 4, §6.2).
 */
export function extractInspectableText(body: unknown): string | null {
  const parts: string[] = [];
  collectStrings(body, 0, parts);
  const text = parts.join("\n");
  if (!text || text.length > LAYA_MAX_PAYLOAD_CHARS) return null;
  return text;
}

function toEvent(job: LayaShadowJob, result: LayaInspectionResult): RaspEvent {
  return {
    traceId: job.traceId,
    spanId: job.spanId,
    service: job.service,
    threatType: result.threatType ?? "prompt_injection",
    action: "logged",
    clientIp: job.clientIp,
    userAgent: job.userAgent,
    path: job.path,
    method: job.method,
    score: result.score,
    metadata: {
      source: "laya",
      scoreScale: "noul_percent",
      model: result.modelUsed,
      latencyMs: result.latencyMs,
      reasons: result.reasons,
      signals: result.signals,
    },
    timestamp: new Date().toISOString(),
  };
}

async function inspectInBackground(job: LayaShadowJob, text: string): Promise<void> {
  const counters = job.counters;
  if (counters) counters.scheduled += 1;
  if (!job.gate.tryAcquire()) {
    if (counters) counters.dropped += 1;
    return;
  }
  try {
    const inspect = job.inspect ?? inspectPayloadWithLaya;
    const result = await inspect(text, job.layaUrl, job.apiKey, {
      ...(job.model ? { model: job.model } : {}),
      onFailure: (kind) => {
        if (counters && kind === "timeout") counters.timedOut += 1;
      },
    });
    if (!result) {
      if (counters) counters.failed += 1;
      return;
    }
    if (counters) counters.inspected += 1;
    if (!result.flagged || !result.threatType) return;
    if (counters) counters.flagged += 1;
    job.enqueue(toEvent(job, result));
    await job.flush();
  } finally {
    job.gate.release();
  }
}

/**
 * Agenda a inspeção fora do ciclo HTTP. O traceId já vem copiado no job:
 * o callback não consulta AsyncLocalStorage.
 */
export function scheduleLayaInspection(job: LayaShadowJob): void {
  if (!job.layaUrl) return;
  if (!TEXT_METHODS.has(job.method.toUpperCase())) return;
  if (job.body === undefined || job.body === null) return;

  setImmediate(() => {
    const text = extractInspectableText(job.body);
    if (!text) return;
    void inspectInBackground(job, text);
  });
}
