export type AlertRuleType =
  | "error_rate"
  | "error_count"
  | "error_burst"
  | "rasp_threat_count"
  | "uptime_down";
export type AlertSeverity = "warning" | "critical";

export interface AlertRule {
  id: string;
  name: string;
  ruleType: AlertRuleType;
  service: string | null;
  threshold: number;
  windowMin: number;
  cooldownMin: number;
  enabled: boolean;
  createdAt: string;
}

export interface AlertFired {
  id: string;
  ruleId: string;
  ruleName: string;
  service: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  eventCount: number;
  suppressed: boolean;
  firedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AlertStats {
  fired: number;
  suppressed: number;
  suppressionRate: number;
}
