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
  gate: LayaGate;
  inspect?: typeof inspectPayloadWithLaya;
  enqueue: (event: RaspEvent) => void;
  flush: () => Promise<void>;
}

function textFromBody(body: unknown): string | null {
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > LAYA_MAX_PAYLOAD_CHARS) return null;
    return trimmed;
  }
  if (typeof body !== "object" || body === null) return null;

  let text: string;
  try {
    text = JSON.stringify(body);
  } catch {
    return null;
  }
  if (!text || text === "{}" || text === "[]" || text.length > LAYA_MAX_PAYLOAD_CHARS) {
    return null;
  }
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
  if (!job.gate.tryAcquire()) return;
  try {
    const inspect = job.inspect ?? inspectPayloadWithLaya;
    const result = await inspect(text, job.layaUrl, job.apiKey);
    if (!result?.flagged || !result.threatType) return;
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
    const text = textFromBody(job.body);
    if (!text) return;
    void inspectInBackground(job, text);
  });
}
