-- Índices para a busca de alertas por trace (listAlertsByTraceId).
CREATE INDEX IF NOT EXISTS idx_alerts_fired_trace_id
  ON alerts_fired ((metadata->>'traceId'));

CREATE INDEX IF NOT EXISTS idx_alerts_fired_trace_ids
  ON alerts_fired USING GIN ((metadata->'traceIds') jsonb_path_ops);
