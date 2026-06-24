-- Fase 5: monitoramento de uptime (HTTP probes)

CREATE TABLE IF NOT EXISTS uptime_monitors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(128) NOT NULL,
    url             TEXT NOT NULL,
    interval_sec    INT NOT NULL DEFAULT 60,
    timeout_ms      INT NOT NULL DEFAULT 5000,
    expected_status INT NOT NULL DEFAULT 200,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uptime_checks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monitor_id    UUID NOT NULL REFERENCES uptime_monitors(id) ON DELETE CASCADE,
    status        VARCHAR(16) NOT NULL,
    latency_ms    INT,
    status_code   INT,
    error_message TEXT,
    checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uptime_checks_monitor ON uptime_checks(monitor_id, checked_at DESC);

COMMENT ON TABLE uptime_monitors IS 'Alvos HTTP monitorados por probes periódicos';
COMMENT ON TABLE uptime_checks IS 'Resultado histórico de cada probe de uptime';

-- Monitor padrão (demo-api health)
INSERT INTO uptime_monitors (name, url, interval_sec, timeout_ms, expected_status, enabled)
SELECT * FROM (VALUES
    ('demo-api health', 'http://host.docker.internal:4000/health', 60, 5000, 200, true)
) AS seed(name, url, interval_sec, timeout_ms, expected_status, enabled)
WHERE NOT EXISTS (SELECT 1 FROM uptime_monitors LIMIT 1);

-- Regra de alerta uptime_down
INSERT INTO alert_rules (name, rule_type, service, threshold, window_min, cooldown_min, enabled)
SELECT * FROM (VALUES
    ('Uptime: serviço indisponível', 'uptime_down', NULL::varchar, 2::numeric, 5, 15, true)
) AS seed(name, rule_type, service, threshold, window_min, cooldown_min, enabled)
WHERE NOT EXISTS (
    SELECT 1 FROM alert_rules WHERE rule_type = 'uptime_down' LIMIT 1
);
