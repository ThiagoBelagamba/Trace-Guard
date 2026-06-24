import type { RaspThreatType } from "@traceguard/shared";
import {
  detectBotUserAgent,
  detectMissingHeaders,
  getHeader,
} from "./fingerprints.js";
import type { RateLimiterBackend } from "./rate-limiter-backend.js";
import type { IncomingRequestLike, RaspAnalysisResult, RaspConfig } from "./types.js";

/** Pesos heurísticos por tipo de ameaça (0–100) */
const THREAT_SCORES: Record<RaspThreatType, number> = {
  rate_limit: 40,
  bot_user_agent: 50,
  sequential_scan: 60,
  missing_headers: 20,
};

export class RaspDetector {
  private readonly config: RaspConfig;
  private readonly rateLimiter: RateLimiterBackend;

  constructor(config: RaspConfig, rateLimiter: RateLimiterBackend) {
    this.config = config;
    this.rateLimiter = rateLimiter;
  }

  async analyze(
    req: IncomingRequestLike,
    clientIp: string
  ): Promise<RaspAnalysisResult> {
    const threats: RaspThreatType[] = [];
    let score = 0;

    const requestCount = await this.rateLimiter.record(clientIp);
    if (requestCount > this.config.maxRequestsPerMinute) {
      threats.push("rate_limit");
      score += THREAT_SCORES.rate_limit;
    }

    const userAgent = getHeader(req.headers, "user-agent");
    if (detectBotUserAgent(userAgent)) {
      threats.push("bot_user_agent");
      score += THREAT_SCORES.bot_user_agent;
    }

    const pathCount = await this.rateLimiter.distinctPathsInWindow(
      clientIp,
      req.path
    );
    if (pathCount > this.config.sequentialScanThreshold) {
      threats.push("sequential_scan");
      score += THREAT_SCORES.sequential_scan;
    }

    if (detectMissingHeaders(req)) {
      threats.push("missing_headers");
      score += THREAT_SCORES.missing_headers;
    }

    return {
      score: Math.min(score, 100),
      threats,
    };
  }

  primaryThreat(threats: RaspThreatType[]): RaspThreatType {
    if (threats.length === 0) return "rate_limit";
    const order: RaspThreatType[] = [
      "sequential_scan",
      "bot_user_agent",
      "rate_limit",
      "missing_headers",
    ];
    for (const t of order) {
      if (threats.includes(t)) return t;
    }
    return threats[0];
  }
}
