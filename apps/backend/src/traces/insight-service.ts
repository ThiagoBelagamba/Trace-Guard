import type { TraceDetail, TraceInsight } from "@traceguard/shared";
import { generateTraceInsight } from "./insight.js";

export interface InsightServiceOptions {
  /** Padrão: `process.env.AI_API_URL`. */
  apiUrl?: string;
  /** Padrão: `Number(process.env.AI_INSIGHT_CACHE_TTL_MS) || 60_000`. */
  ttlMs?: number;
  /** Padrão: 500 (remove a entrada mais antiga). */
  maxEntries?: number;
  /** Padrão: `Number(process.env.AI_MAX_CALLS_PER_MINUTE) || 30`. */
  maxLlmCallsPerMinute?: number;
  /** Padrão: `Date.now`. */
  now?: () => number;
  generate?: typeof generateTraceInsight;
  /** Padrão: `console.warn`. */
  logger?: (message: string) => void;
}

export interface InsightService {
  getInsight(detail: TraceDetail): Promise<TraceInsight>;
}

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_MAX_CALLS_PER_MINUTE = 30;
const BUDGET_WINDOW_MS = 60_000;

interface CacheEntry {
  insight: TraceInsight;
  expiresAt: number;
}

/**
 * Envolve `generateTraceInsight` com cache por versão do trace, deduplicação de chamadas
 * simultâneas e orçamento de chamadas ao LLM por minuto. Sem LLM configurado, delega direto.
 */
export function createInsightService(options: InsightServiceOptions = {}): InsightService {
  const apiUrl = (options.apiUrl ?? process.env.AI_API_URL ?? "").trim();
  const ttlMs = options.ttlMs ?? (Number(process.env.AI_INSIGHT_CACHE_TTL_MS) || DEFAULT_TTL_MS);
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxCalls =
    options.maxLlmCallsPerMinute ??
    (Number(process.env.AI_MAX_CALLS_PER_MINUTE) || DEFAULT_MAX_CALLS_PER_MINUTE);
  const now = options.now ?? Date.now;
  const generate = options.generate ?? generateTraceInsight;
  const logger = options.logger ?? ((message: string) => console.warn(message));

  const cache = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<TraceInsight>>();
  let callTimes: number[] = [];

  function hasBudget(): boolean {
    const cutoff = now() - BUDGET_WINDOW_MS;
    callTimes = callTimes.filter((t) => t > cutoff);
    return callTimes.length < maxCalls;
  }

  function store(key: string, insight: TraceInsight): void {
    cache.delete(key);
    cache.set(key, { insight, expiresAt: now() + ttlMs });
    while (cache.size > maxEntries) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  async function produce(key: string, detail: TraceDetail): Promise<TraceInsight> {
    if (!hasBudget()) {
      logger(`[insight] LLM fallback (rate_limited) trace=${detail.traceId}`);
      const result = await generate(detail, { apiUrl: "" });
      return { ...result, llmFallback: "rate_limited" };
    }
    callTimes.push(now());
    const result = await generate(detail, { apiUrl });
    if (result.source === "llm") store(key, result);
    return result;
  }

  return {
    getInsight(detail: TraceDetail): Promise<TraceInsight> {
      if (!apiUrl) return generate(detail);

      const key = `${detail.traceId}:${detail.events.length}:${detail.raspEvents.length}:${detail.alerts?.length ?? 0}`;

      const cached = cache.get(key);
      if (cached) {
        if (now() < cached.expiresAt) return Promise.resolve(cached.insight);
        cache.delete(key);
      }

      const pending = inFlight.get(key);
      if (pending) return pending;

      const promise = produce(key, detail).finally(() => {
        inFlight.delete(key);
      });
      inFlight.set(key, promise);
      return promise;
    },
  };
}
