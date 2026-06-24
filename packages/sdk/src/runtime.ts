import { RaspDetector } from "./rasp/detector.js";
import { RaspExporter } from "./rasp/emitter.js";
import { createRateLimiter, RedisRateLimiter } from "./rasp/redis-rate-limiter.js";
import type { RaspConfig } from "./rasp/types.js";
import { DEFAULT_RASP_CONFIG } from "./rasp/types.js";

export interface RaspRuntime {
  serviceName: string;
  detector: RaspDetector;
  exporter: RaspExporter;
  config: RaspConfig;
  redisLimiter: RedisRateLimiter | null;
}

let raspRuntime: RaspRuntime | null = null;

export function initRaspRuntime(
  serviceName: string,
  raspEndpoint: string,
  config?: Partial<RaspConfig>
): RaspRuntime {
  const merged: RaspConfig = { ...DEFAULT_RASP_CONFIG, ...config };
  const rateLimiter = createRateLimiter(merged.redisUrl);
  const redisLimiter =
    rateLimiter instanceof RedisRateLimiter ? rateLimiter : null;
  const detector = new RaspDetector(merged, rateLimiter);
  const exporter = new RaspExporter({ endpoint: raspEndpoint });
  exporter.start();

  raspRuntime = {
    serviceName,
    detector,
    exporter,
    config: merged,
    redisLimiter,
  };
  return raspRuntime;
}

export function getRaspRuntime(): RaspRuntime | null {
  return raspRuntime;
}

export async function shutdownRaspRuntime(): Promise<void> {
  if (raspRuntime) {
    await raspRuntime.exporter.shutdown();
    if (raspRuntime.redisLimiter) {
      await raspRuntime.redisLimiter.disconnect();
    }
    raspRuntime = null;
  }
}
