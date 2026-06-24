export type UptimeStatus = "up" | "down" | "degraded";

export interface UptimeMonitor {
  id: string;
  name: string;
  url: string;
  intervalSec: number;
  timeoutMs: number;
  expectedStatus: number;
  enabled: boolean;
  createdAt: string;
}

export interface UptimeCheck {
  id: string;
  monitorId: string;
  status: UptimeStatus;
  latencyMs: number | null;
  statusCode: number | null;
  errorMessage?: string;
  checkedAt: string;
}

export interface UptimeCheckWithMonitor extends UptimeCheck {
  monitorName: string;
}

export interface UptimeStats {
  monitors: number;
  up: number;
  down: number;
  avgLatencyMs: number;
  uptimePercent24h: Record<string, number>;
}
