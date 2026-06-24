-- Schema inicial do TraceGuard para armazenamento de eventos de telemetria.
-- Otimizado para consultas temporais (time-series) com índices em trace_id e created_at.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE telemetry_events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id    VARCHAR(32) NOT NULL,
    span_id     VARCHAR(16),
    service     VARCHAR(128) NOT NULL,
    level       VARCHAR(16) NOT NULL,
    message     TEXT NOT NULL,
    metadata    JSONB DEFAULT '{}',
    duration_ms NUMERIC(10, 2),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telemetry_trace_id ON telemetry_events(trace_id);
CREATE INDEX idx_telemetry_created_at ON telemetry_events(created_at DESC);
CREATE INDEX idx_telemetry_service_level ON telemetry_events(service, level);

COMMENT ON TABLE telemetry_events IS 'Eventos de telemetria ingeridos pelo TraceGuard (logs estruturados com trace context)';
