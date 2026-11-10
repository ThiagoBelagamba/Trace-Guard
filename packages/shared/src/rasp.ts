export type RaspThreatType =
  | "rate_limit"
  | "bot_user_agent"
  | "sequential_scan"
  | "missing_headers";

/**
 * Pesos heurísticos por tipo de ameaça (0–100). Fonte única para o SDK
 * (detecção) e para o backend (diagnóstico).
 */
export const RASP_THREAT_WEIGHTS: Record<RaspThreatType, number> = {
  sequential_scan: 60,
  bot_user_agent: 50,
  rate_limit: 40,
  missing_headers: 20,
};

/** Limiar padrão de bloqueio quando o SDK não define `blockThreshold`. */
export const DEFAULT_RASP_BLOCK_THRESHOLD = 70;

export type RaspAction = "logged" | "blocked";

export interface RaspEvent {
  traceId: string;
  spanId: string;
  service: string;
  threatType: RaspThreatType;
  action: RaspAction;
  clientIp: string;
  userAgent?: string;
  path: string;
  method: string;
  score: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface RaspStats {
  byThreatType: Record<string, number>;
  blocked: number;
  logged: number;
}
