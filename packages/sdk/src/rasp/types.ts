import type { RaspThreatType } from "@traceguard/shared";

export interface RaspConfig {
  enabled: boolean;
  mode: "monitor" | "block";
  maxRequestsPerMinute: number;
  blockThreshold: number;
  sequentialScanThreshold: number;
  redisUrl?: string;
}

export const DEFAULT_RASP_CONFIG: RaspConfig = {
  enabled: true,
  mode: "block",
  maxRequestsPerMinute: 60,
  blockThreshold: 70,
  sequentialScanThreshold: 20,
};

export interface RaspAnalysisResult {
  score: number;
  threats: RaspThreatType[];
}

export interface IncomingRequestLike {
  ip?: string;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}
