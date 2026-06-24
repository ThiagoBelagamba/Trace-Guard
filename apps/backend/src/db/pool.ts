import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ??
      "postgres://traceguard:traceguard_dev@localhost:5432/traceguard";

    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await getPool().query("SELECT 1");
    return result.rowCount === 1;
  } catch {
    return false;
  }
}

export interface TelemetryRow {
  id: string;
  trace_id: string;
  span_id: string | null;
  service: string;
  level: string;
  message: string;
  metadata: Record<string, unknown>;
  duration_ms: number | null;
  created_at: Date;
}

export async function insertTelemetryEvents(
  events: Array<{
    traceId: string;
    spanId: string;
    service: string;
    level: string;
    message: string;
    metadata?: Record<string, unknown>;
    durationMs?: number;
    timestamp: string;
  }>
): Promise<TelemetryRow[]> {
  const client = await getPool().connect();
  const inserted: TelemetryRow[] = [];

  try {
    await client.query("BEGIN");

    for (const event of events) {
      const result = await client.query<TelemetryRow>(
        `INSERT INTO telemetry_events
          (trace_id, span_id, service, level, message, metadata, duration_ms, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, trace_id, span_id, service, level, message, metadata, duration_ms, created_at`,
        [
          event.traceId,
          event.spanId,
          event.service,
          event.level,
          event.message,
          JSON.stringify(event.metadata ?? {}),
          event.durationMs ?? null,
          event.timestamp,
        ]
      );
      if (result.rows[0]) {
        inserted.push(result.rows[0]);
      }
    }

    await client.query("COMMIT");
    return inserted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listRecentEvents(
  limit: number
): Promise<TelemetryRow[]> {
  const result = await getPool().query<TelemetryRow>(
    `SELECT id, trace_id, span_id, service, level, message, metadata, duration_ms, created_at
     FROM telemetry_events
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export interface EventStatsResult {
  timeline: Array<{ bucket: string; count: number }>;
  byLevel: Record<string, number>;
  byService: Record<string, number>;
}

export async function getEventStats(
  since: Date,
  bucketMinutes: number
): Promise<EventStatsResult> {
  const bucketExpr =
    bucketMinutes >= 5
      ? `date_trunc('hour', created_at) + floor(extract(minute from created_at) / ${bucketMinutes}) * interval '${bucketMinutes} minutes'`
      : `date_trunc('minute', created_at)`;

  const [timelineResult, levelResult, serviceResult] = await Promise.all([
    getPool().query<{ bucket: Date; count: string }>(
      `SELECT ${bucketExpr} AS bucket, COUNT(*)::int AS count
       FROM telemetry_events
       WHERE created_at >= $1
       GROUP BY 1
       ORDER BY 1`,
      [since]
    ),
    getPool().query<{ level: string; count: string }>(
      `SELECT level, COUNT(*)::int AS count
       FROM telemetry_events
       WHERE created_at >= $1
       GROUP BY level`,
      [since]
    ),
    getPool().query<{ service: string; count: string }>(
      `SELECT service, COUNT(*)::int AS count
       FROM telemetry_events
       WHERE created_at >= $1
       GROUP BY service
       ORDER BY count DESC
       LIMIT 20`,
      [since]
    ),
  ]);

  const byLevel: Record<string, number> = {};
  for (const row of levelResult.rows) {
    byLevel[row.level] = Number(row.count);
  }

  const byService: Record<string, number> = {};
  for (const row of serviceResult.rows) {
    byService[row.service] = Number(row.count);
  }

  return {
    timeline: timelineResult.rows.map((row) => ({
      bucket: row.bucket.toISOString(),
      count: Number(row.count),
    })),
    byLevel,
    byService,
  };
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
