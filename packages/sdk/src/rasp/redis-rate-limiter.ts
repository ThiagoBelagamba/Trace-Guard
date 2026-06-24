import Redis from "ioredis";
import type { RateLimiterBackend } from "./rate-limiter-backend.js";
import { InMemoryRateLimiter } from "./rate-limiter.js";

const WINDOW_MS = 60_000;

/**
 * Rate limiter distribuído via Redis sorted sets (Fase 5).
 */
export class RedisRateLimiter implements RateLimiterBackend {
  private readonly redis: Redis;
  private readonly windowMs: number;

  constructor(redisUrl: string, windowMs = WINDOW_MS) {
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    this.windowMs = windowMs;
  }

  private hitsKey(ip: string): string {
    return `rasp:rl:${ip}:hits`;
  }

  private pathsKey(ip: string): string {
    return `rasp:rl:${ip}:paths`;
  }

  async record(ip: string): Promise<number> {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const key = this.hitsKey(ip);

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, cutoff);
    pipeline.zadd(key, now, `${now}`);
    pipeline.zcard(key);
    pipeline.pexpire(key, this.windowMs);

    const results = await pipeline.exec();
    const count = results?.[2]?.[1];
    return typeof count === "number" ? count : 1;
  }

  async distinctPathsInWindow(ip: string, path: string): Promise<number> {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const key = this.pathsKey(ip);

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, cutoff);
    pipeline.zadd(key, now, path);
    pipeline.zcard(key);
    pipeline.pexpire(key, this.windowMs);

    const results = await pipeline.exec();
    const count = results?.[2]?.[1];
    return typeof count === "number" ? count : 1;
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

export function createRateLimiter(
  redisUrl?: string
): RateLimiterBackend {
  if (redisUrl) {
    return new RedisRateLimiter(redisUrl);
  }
  return new InMemoryRateLimiter();
}
