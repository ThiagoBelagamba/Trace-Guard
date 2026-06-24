-- Fase 3: agregação horária e motor de alertas (mitigação de fadiga de alertas)

-- View materializada para consultas agregadas no dashboard e relatórios
CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_hourly_stats AS
SELECT
    date_trunc('hour', created_at) AS hour_bucket,
    service,
    level,
    COUNT(*)::int AS event_count,
    AVG(duration_ms)::numeric(10, 2) AS avg_duration_ms
FROM telemetry_events
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_stats_unique
    ON telemetry_hourly_stats (hour_bucket, service, level);

-- Regras de alerta configuráveis
CREATE TABLE IF NOT EXISTS alert_rules (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         VARCHAR(128) NOT NULL,
    rule_type    VARCHAR(32) NOT NULL,
    service      VARCHAR(128),
    threshold    NUMERIC(10, 2) NOT NULL,
    window_min   INT NOT NULL DEFAULT 5,
    cooldown_min INT NOT NULL DEFAULT 15,
    enabled      BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Histórico de alertas disparados ou suprimidos
CREATE TABLE IF NOT EXISTS alerts_fired (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id     UUID NOT NULL REFERENCES alert_rules(id),
    service     VARCHAR(128) NOT NULL,
    severity    VARCHAR(16) NOT NULL,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    event_count INT NOT NULL,
    suppressed  BOOLEAN NOT NULL DEFAULT false,
    metadata    JSONB DEFAULT '{}',
    fired_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_fired_at ON alerts_fired(fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_fired_rule ON alerts_fired(rule_id, fired_at DESC);

COMMENT ON TABLE alert_rules IS 'Regras de alerta do TraceGuard — avaliadas contra telemetria em janela deslizante';
COMMENT ON TABLE alerts_fired IS 'Alertas disparados ou suprimidos por cooldown (fadiga de alertas)';

-- Seed: apenas se não houver regras
INSERT INTO alert_rules (name, rule_type, service, threshold, window_min, cooldown_min, enabled)
SELECT * FROM (VALUES
    ('Taxa de erro elevada', 'error_rate', NULL::varchar, 20::numeric, 5, 15, true),
    ('Pico de erros', 'error_count', NULL::varchar, 10::numeric, 5, 10, true),
    ('Rajada no mesmo trace', 'error_burst', NULL::varchar, 3::numeric, 1, 5, true)
) AS seed(name, rule_type, service, threshold, window_min, cooldown_min, enabled)
WHERE NOT EXISTS (SELECT 1 FROM alert_rules LIMIT 1);
