import type { RaspEvent, RaspStats } from "@traceguard/shared";
import { getPool } from "./pool.js";

export interface RaspEventRow {
  id: string;
  trace_id: string;
  span_id: string | null;
  service: string;
  threat_type: string;
  action: string;
  client_ip: string;
  user_agent: string | null;
  path: string;
  method: string;
  score: number;
  metadata: Record<string, unknown>;
  created_at: Date;
}

function toRaspEvent(row: RaspEventRow): RaspEvent & { id: string } {
  return {
    id: row.id,
    traceId: row.trace_id,
    spanId: row.span_id ?? "",
    service: row.service,
    threatType: row.threat_type as RaspEvent["threatType"],
    action: row.action as RaspEvent["action"],
    clientIp: row.client_ip,
    userAgent: row.user_agent ?? undefined,
    path: row.path,
    method: row.method,
    score: row.score,
    metadata: row.metadata ?? {},
    timestamp: row.created_at.toISOString(),
  };
}

export async function insertRaspEvents(
  events: RaspEvent[]
): Promise<RaspEventRow[]> {
  if (events.length === 0) return [];

  const pool = getPool();
  const inserted: RaspEventRow[] = [];

  for (const e of events) {
    const result = await pool.query<RaspEventRow>(
      `INSERT INTO rasp_events
        (trace_id, span_id, service, threat_type, action, client_ip, user_agent, path, method, score, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, trace_id, span_id, service, threat_type, action, client_ip, user_agent, path, method, score, metadata, created_at`,
      [
        e.traceId,
        e.spanId,
        e.service,
        e.threatType,
        e.action,
        e.clientIp,
        e.userAgent ?? null,
        e.path,
        e.method,
        e.score,
        JSON.stringify(e.metadata ?? {}),
        e.timestamp,
      ]
    );
    if (result.rows[0]) inserted.push(result.rows[0]);
  }

  return inserted;
}

export async function listRaspEventsByTraceId(
  traceId: string
): Promise<Array<RaspEvent & { id: string }>> {
  const result = await getPool().query<RaspEventRow>(
    `SELECT id, trace_id, span_id, service, threat_type, action, client_ip, user_agent, path, method, score, metadata, created_at
     FROM rasp_events
     WHERE trace_id = $1
     ORDER BY created_at ASC`,
    [traceId]
  );
  return result.rows.map(toRaspEvent);
}

export async function listRecentRaspEvents(
  limit: number
): Promise<Array<RaspEvent & { id: string }>> {
  const result = await getPool().query<RaspEventRow>(
    `SELECT id, trace_id, span_id, service, threat_type, action, client_ip, user_agent, path, method, score, metadata, created_at
     FROM rasp_events
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(toRaspEvent);
}

export async function getRaspStats(): Promise<RaspStats> {
  const byType = await getPool().query<{ threat_type: string; count: string }>(
    `SELECT threat_type, COUNT(*)::int AS count
     FROM rasp_events
     WHERE created_at >= NOW() - INTERVAL '24 hours'
     GROUP BY threat_type`
  );

  const actions = await getPool().query<{ action: string; count: string }>(
    `SELECT action, COUNT(*)::int AS count
     FROM rasp_events
     WHERE created_at >= NOW() - INTERVAL '24 hours'
     GROUP BY action`
  );

  const byThreatType: Record<string, number> = {};
  for (const row of byType.rows) {
    byThreatType[row.threat_type] = Number(row.count);
  }

  let blocked = 0;
  let logged = 0;
  for (const row of actions.rows) {
    if (row.action === "blocked") blocked = Number(row.count);
    if (row.action === "logged") logged = Number(row.count);
  }

  return { byThreatType, blocked, logged };
}

export async function countRaspThreatsInWindow(
  windowMin: number,
  service: string | null,
  threatType?: string
): Promise<number> {
  const params: unknown[] = [windowMin];
  let clauses = "";

  if (service) {
    params.push(service);
    clauses += ` AND service = $${params.length}`;
  }
  if (threatType) {
    params.push(threatType);
    clauses += ` AND threat_type = $${params.length}`;
  }

  const result = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::int AS count
     FROM rasp_events
     WHERE created_at >= NOW() - ($1::int * INTERVAL '1 minute')
     ${clauses}`,
    params
  );

  return Number(result.rows[0]?.count ?? 0);
}
