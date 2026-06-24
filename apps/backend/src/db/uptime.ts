import type {
  CreateUptimeMonitorInput,
  UptimeCheck,
  UptimeMonitor,
  UptimeStats,
  UpdateUptimeMonitorInput,
  UptimeStatus,
} from "@traceguard/shared";
import { getPool } from "./pool.js";

export interface UptimeMonitorRow {
  id: string;
  name: string;
  url: string;
  interval_sec: number;
  timeout_ms: number;
  expected_status: number;
  enabled: boolean;
  created_at: Date;
}

export interface UptimeCheckRow {
  id: string;
  monitor_id: string;
  status: string;
  latency_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  checked_at: Date;
  monitor_name?: string;
}

function toMonitor(row: UptimeMonitorRow): UptimeMonitor {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    intervalSec: row.interval_sec,
    timeoutMs: row.timeout_ms,
    expectedStatus: row.expected_status,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
  };
}

function toCheck(row: UptimeCheckRow): UptimeCheck {
  return {
    id: row.id,
    monitorId: row.monitor_id,
    status: row.status as UptimeStatus,
    latencyMs: row.latency_ms,
    statusCode: row.status_code,
    errorMessage: row.error_message ?? undefined,
    checkedAt: row.checked_at.toISOString(),
  };
}

export async function listMonitors(): Promise<UptimeMonitor[]> {
  const result = await getPool().query<UptimeMonitorRow>(
    `SELECT id, name, url, interval_sec, timeout_ms, expected_status, enabled, created_at
     FROM uptime_monitors ORDER BY created_at`
  );
  return result.rows.map(toMonitor);
}

export async function listEnabledMonitorsDueForProbe(): Promise<
  Array<UptimeMonitor & { lastCheckedAt: Date | null }>
> {
  const result = await getPool().query<
    UptimeMonitorRow & { last_checked_at: Date | null }
  >(
    `SELECT m.id, m.name, m.url, m.interval_sec, m.timeout_ms, m.expected_status, m.enabled, m.created_at,
            MAX(c.checked_at) AS last_checked_at
     FROM uptime_monitors m
     LEFT JOIN uptime_checks c ON c.monitor_id = m.id
     WHERE m.enabled = true
     GROUP BY m.id
     HAVING MAX(c.checked_at) IS NULL
        OR MAX(c.checked_at) < NOW() - (m.interval_sec * INTERVAL '1 second')`
  );

  return result.rows.map((row) => ({
    ...toMonitor(row),
    lastCheckedAt: row.last_checked_at,
  }));
}

export async function createMonitor(
  data: CreateUptimeMonitorInput
): Promise<UptimeMonitor> {
  const result = await getPool().query<UptimeMonitorRow>(
    `INSERT INTO uptime_monitors (name, url, interval_sec, timeout_ms, expected_status, enabled)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, url, interval_sec, timeout_ms, expected_status, enabled, created_at`,
    [
      data.name,
      data.url,
      data.intervalSec ?? 60,
      data.timeoutMs ?? 5000,
      data.expectedStatus ?? 200,
      data.enabled ?? true,
    ]
  );
  return toMonitor(result.rows[0]);
}

export async function updateMonitor(
  id: string,
  data: UpdateUptimeMonitorInput
): Promise<UptimeMonitor | null> {
  const fields: string[] = [];
  const values: unknown[] = [id];
  let idx = 2;

  if (data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.url !== undefined) {
    fields.push(`url = $${idx++}`);
    values.push(data.url);
  }
  if (data.intervalSec !== undefined) {
    fields.push(`interval_sec = $${idx++}`);
    values.push(data.intervalSec);
  }
  if (data.timeoutMs !== undefined) {
    fields.push(`timeout_ms = $${idx++}`);
    values.push(data.timeoutMs);
  }
  if (data.expectedStatus !== undefined) {
    fields.push(`expected_status = $${idx++}`);
    values.push(data.expectedStatus);
  }
  if (data.enabled !== undefined) {
    fields.push(`enabled = $${idx++}`);
    values.push(data.enabled);
  }

  if (fields.length === 0) return getMonitorById(id);

  const result = await getPool().query<UptimeMonitorRow>(
    `UPDATE uptime_monitors SET ${fields.join(", ")} WHERE id = $1
     RETURNING id, name, url, interval_sec, timeout_ms, expected_status, enabled, created_at`,
    values
  );
  return result.rows[0] ? toMonitor(result.rows[0]) : null;
}

export async function deleteMonitor(id: string): Promise<boolean> {
  const result = await getPool().query(
    "DELETE FROM uptime_monitors WHERE id = $1",
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getMonitorById(
  id: string
): Promise<UptimeMonitor | null> {
  const result = await getPool().query<UptimeMonitorRow>(
    `SELECT id, name, url, interval_sec, timeout_ms, expected_status, enabled, created_at
     FROM uptime_monitors WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? toMonitor(result.rows[0]) : null;
}

export async function insertCheck(data: {
  monitorId: string;
  status: UptimeStatus;
  latencyMs: number | null;
  statusCode: number | null;
  errorMessage?: string;
}): Promise<UptimeCheckRow> {
  const result = await getPool().query<UptimeCheckRow>(
    `INSERT INTO uptime_checks (monitor_id, status, latency_ms, status_code, error_message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, monitor_id, status, latency_ms, status_code, error_message, checked_at`,
    [
      data.monitorId,
      data.status,
      data.latencyMs,
      data.statusCode,
      data.errorMessage ?? null,
    ]
  );
  return result.rows[0];
}

export async function listRecentChecks(
  monitorId: string | null,
  limit: number
): Promise<Array<UptimeCheck & { monitorName: string }>> {
  const params: unknown[] = [];
  let monitorClause = "";
  let limitParam = "$1";

  if (monitorId) {
    params.push(monitorId);
    monitorClause = "WHERE c.monitor_id = $1";
    params.push(limit);
    limitParam = "$2";
  } else {
    params.push(limit);
  }

  const result = await getPool().query<UptimeCheckRow>(
    `SELECT c.id, c.monitor_id, c.status, c.latency_ms, c.status_code, c.error_message, c.checked_at,
            m.name AS monitor_name
     FROM uptime_checks c
     JOIN uptime_monitors m ON m.id = c.monitor_id
     ${monitorClause}
     ORDER BY c.checked_at DESC
     LIMIT ${limitParam}`,
    params
  );

  return result.rows.map((row) => ({
    ...toCheck(row),
    monitorName: row.monitor_name ?? "unknown",
  }));
}

export async function getUptimeStats(): Promise<UptimeStats> {
  const monitors = await listMonitors();
  const latest = await getPool().query<{
    monitor_id: string;
    status: string;
    latency_ms: number | null;
  }>(
    `SELECT DISTINCT ON (monitor_id) monitor_id, status, latency_ms
     FROM uptime_checks
     ORDER BY monitor_id, checked_at DESC`
  );

  const latestMap = new Map(
    latest.rows.map((r) => [r.monitor_id, r])
  );

  let up = 0;
  let down = 0;
  let latencySum = 0;
  let latencyCount = 0;

  for (const m of monitors) {
    const last = latestMap.get(m.id);
    if (!last) continue;
    if (last.status === "up") up++;
    else down++;
    if (last.latency_ms != null) {
      latencySum += last.latency_ms;
      latencyCount++;
    }
  }

  const percentResult = await getPool().query<{
    monitor_id: string;
    uptime_pct: string;
  }>(
    `SELECT monitor_id,
            ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'up') / NULLIF(COUNT(*), 0), 1) AS uptime_pct
     FROM uptime_checks
     WHERE checked_at >= NOW() - INTERVAL '24 hours'
     GROUP BY monitor_id`
  );

  const uptimePercent24h: Record<string, number> = {};
  for (const row of percentResult.rows) {
    uptimePercent24h[row.monitor_id] = Number(row.uptime_pct);
  }

  return {
    monitors: monitors.length,
    up,
    down,
    avgLatencyMs:
      latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
    uptimePercent24h,
  };
}

export async function countConsecutiveDown(
  monitorId: string
): Promise<number> {
  const result = await getPool().query<{ status: string }>(
    `SELECT status FROM uptime_checks
     WHERE monitor_id = $1
     ORDER BY checked_at DESC
     LIMIT 20`,
    [monitorId]
  );

  let count = 0;
  for (const row of result.rows) {
    if (row.status !== "down" && row.status !== "degraded") break;
    count++;
  }
  return count;
}

export async function getLatestCheckPerMonitor(): Promise<
  Map<string, UptimeCheck & { monitorName: string }>
> {
  const result = await getPool().query<UptimeCheckRow>(
    `SELECT DISTINCT ON (c.monitor_id)
            c.id, c.monitor_id, c.status, c.latency_ms, c.status_code, c.error_message, c.checked_at,
            m.name AS monitor_name
     FROM uptime_checks c
     JOIN uptime_monitors m ON m.id = c.monitor_id
     ORDER BY c.monitor_id, c.checked_at DESC`
  );

  const map = new Map<string, UptimeCheck & { monitorName: string }>();
  for (const row of result.rows) {
    map.set(row.monitor_id, {
      ...toCheck(row),
      monitorName: row.monitor_name ?? "unknown",
    });
  }
  return map;
}
