export type RaspThreatType =
  | "rate_limit"
  | "bot_user_agent"
  | "sequential_scan"
  | "missing_headers";

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
