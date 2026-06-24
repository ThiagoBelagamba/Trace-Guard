import type {
  AlertFired,
  AlertRule,
  AlertRuleType,
  AlertSeverity,
  AlertStats,
} from "@traceguard/shared";
import { getPool } from "./pool.js";

export interface AlertRuleRow {
  id: string;
  name: string;
  rule_type: string;
  service: string | null;
  threshold: string;
  window_min: number;
  cooldown_min: number;
  enabled: boolean;
  created_at: Date;
}

export interface AlertFiredRow {
  id: string;
  rule_id: string;
  service: string;
  severity: string;
  title: string;
  message: string;
  event_count: number;
  suppressed: boolean;
  metadata: Record<string, unknown>;
  fired_at: Date;
  rule_name?: string;
}

function toAlertRule(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    name: row.name,
    ruleType: row.rule_type as AlertRuleType,
    service: row.service,
    threshold: Number(row.threshold),
    windowMin: row.window_min,
    cooldownMin: row.cooldown_min,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
  };
}

export function toAlertFired(row: AlertFiredRow): AlertFired {
  return {
    id: row.id,
    ruleId: row.rule_id,
    ruleName: row.rule_name ?? "Regra",
    service: row.service,
    severity: row.severity as AlertSeverity,
    title: row.title,
    message: row.message,
    eventCount: row.event_count,
    suppressed: row.suppressed,
    firedAt: row.fired_at.toISOString(),
    metadata: row.metadata ?? {},
  };
}

export async function listEnabledRules(): Promise<AlertRule[]> {
  const result = await getPool().query<AlertRuleRow>(
    `SELECT id, name, rule_type, service, threshold, window_min, cooldown_min, enabled, created_at
     FROM alert_rules
     WHERE enabled = true
     ORDER BY created_at`
  );
  return result.rows.map(toAlertRule);
}

export async function listAllRules(): Promise<AlertRule[]> {
  const result = await getPool().query<AlertRuleRow>(
    `SELECT id, name, rule_type, service, threshold, window_min, cooldown_min, enabled, created_at
     FROM alert_rules
     ORDER BY created_at`
  );
  return result.rows.map(toAlertRule);
}

export async function setRuleEnabled(
  id: string,
  enabled: boolean
): Promise<AlertRule | null> {
  const result = await getPool().query<AlertRuleRow>(
    `UPDATE alert_rules SET enabled = $2 WHERE id = $1
     RETURNING id, name, rule_type, service, threshold, window_min, cooldown_min, enabled, created_at`,
    [id, enabled]
  );
  return result.rows[0] ? toAlertRule(result.rows[0]) : null;
}

export async function insertAlertFired(data: {
  ruleId: string;
  service: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  eventCount: number;
  suppressed: boolean;
  metadata?: Record<string, unknown>;
}): Promise<AlertFiredRow> {
  const result = await getPool().query<AlertFiredRow>(
    `INSERT INTO alerts_fired
      (rule_id, service, severity, title, message, event_count, suppressed, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, rule_id, service, severity, title, message, event_count, suppressed, metadata, fired_at`,
    [
      data.ruleId,
      data.service,
      data.severity,
      data.title,
      data.message,
      data.eventCount,
      data.suppressed,
      JSON.stringify(data.metadata ?? {}),
    ]
  );
  return result.rows[0];
}

export async function listRecentAlerts(limit: number): Promise<AlertFired[]> {
  const result = await getPool().query<AlertFiredRow>(
    `SELECT af.id, af.rule_id, af.service, af.severity, af.title, af.message,
            af.event_count, af.suppressed, af.metadata, af.fired_at,
            ar.name AS rule_name
     FROM alerts_fired af
     JOIN alert_rules ar ON ar.id = af.rule_id
     ORDER BY af.fired_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(toAlertFired);
}

export async function getAlertStats(): Promise<AlertStats> {
  const result = await getPool().query<{
    fired: string;
    suppressed: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE NOT suppressed)::int AS fired,
       COUNT(*) FILTER (WHERE suppressed)::int AS suppressed
     FROM alerts_fired
     WHERE fired_at >= NOW() - INTERVAL '24 hours'`
  );

  const fired = Number(result.rows[0]?.fired ?? 0);
  const suppressed = Number(result.rows[0]?.suppressed ?? 0);
  const total = fired + suppressed;

  return {
    fired,
    suppressed,
    suppressionRate: total > 0 ? Math.round((suppressed / total) * 100) : 0,
  };
}

export async function countEventsInWindow(
  service: string | null,
  windowMin: number,
  level?: string
): Promise<{ total: number; errors: number }> {
  const params: unknown[] = [windowMin];
  let serviceClause = "";
  let levelClause = "";

  if (service) {
    params.push(service);
    serviceClause = `AND service = $${params.length}`;
  }
  if (level) {
    params.push(level);
    levelClause = `AND level = $${params.length}`;
  }

  const result = await getPool().query<{ total: string; errors: string }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE level = 'error')::int AS errors
     FROM telemetry_events
     WHERE created_at >= NOW() - ($1::int * INTERVAL '1 minute')
     ${serviceClause}
     ${levelClause}`,
    params
  );

  return {
    total: Number(result.rows[0]?.total ?? 0),
    errors: Number(result.rows[0]?.errors ?? 0),
  };
}

export async function findErrorBursts(
  windowMin: number,
  threshold: number,
  service: string | null
): Promise<Array<{ traceId: string; service: string; errorCount: number }>> {
  const params: unknown[] = [windowMin, threshold];
  let serviceClause = "";

  if (service) {
    params.push(service);
    serviceClause = `AND service = $${params.length}`;
  }

  const result = await getPool().query<{
    trace_id: string;
    service: string;
    error_count: string;
  }>(
    `SELECT trace_id, service, COUNT(*)::int AS error_count
     FROM telemetry_events
     WHERE level = 'error'
       AND created_at >= NOW() - ($1::int * INTERVAL '1 minute')
       ${serviceClause}
     GROUP BY trace_id, service
     HAVING COUNT(*) >= $2
     ORDER BY error_count DESC
     LIMIT 10`,
    params
  );

  return result.rows.map((row) => ({
    traceId: row.trace_id,
    service: row.service,
    errorCount: Number(row.error_count),
  }));
}

export async function refreshHourlyStats(): Promise<void> {
  await getPool().query(
    "REFRESH MATERIALIZED VIEW CONCURRENTLY telemetry_hourly_stats"
  );
}

export async function ensureDefaultRules(): Promise<void> {
  const count = await getPool().query("SELECT COUNT(*)::int AS c FROM alert_rules");
  if (Number(count.rows[0]?.c) > 0) return;

  await getPool().query(
    `INSERT INTO alert_rules (name, rule_type, service, threshold, window_min, cooldown_min)
     VALUES
       ('Taxa de erro elevada', 'error_rate', NULL, 20, 5, 15),
       ('Pico de erros', 'error_count', NULL, 10, 5, 10),
       ('Rajada no mesmo trace', 'error_burst', NULL, 3, 1, 5)`
  );
}
