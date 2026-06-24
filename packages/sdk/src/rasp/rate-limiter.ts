import type { RateLimiterBackend } from "./rate-limiter-backend.js";

/**
 * Sliding window in-memory por IP.
 */
export class InMemoryRateLimiter implements RateLimiterBackend {
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();
  private readonly pathHits = new Map<
    string,
    Array<{ path: string; t: number }>
  >();

  constructor(windowMs = 60_000) {
    this.windowMs = windowMs;
  }

  async record(ip: string): Promise<number> {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const timestamps = (this.hits.get(ip) ?? []).filter((t) => t > cutoff);
    timestamps.push(now);
    this.hits.set(ip, timestamps);
    return timestamps.length;
  }

  async distinctPathsInWindow(ip: string, path: string): Promise<number> {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const key = `${ip}:paths`;
    const entries = (this.pathHits.get(key) ?? []).filter((e) => e.t > cutoff);
    if (!entries.some((e) => e.path === path)) {
      entries.push({ path, t: now });
    }
    this.pathHits.set(key, entries);
    return entries.length;
  }
}
