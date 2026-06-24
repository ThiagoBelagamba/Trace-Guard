-- Fase 4: eventos RASP (Runtime Application Self-Protection)

CREATE TABLE IF NOT EXISTS rasp_events (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id     VARCHAR(32) NOT NULL,
    span_id      VARCHAR(16),
    service      VARCHAR(128) NOT NULL,
    threat_type  VARCHAR(32) NOT NULL,
    action       VARCHAR(16) NOT NULL,
    client_ip    VARCHAR(45) NOT NULL,
    user_agent   TEXT,
    path         TEXT NOT NULL,
    method       VARCHAR(16) NOT NULL,
    score        INT NOT NULL,
    metadata     JSONB DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rasp_created_at ON rasp_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rasp_client_ip ON rasp_events(client_ip);
CREATE INDEX IF NOT EXISTS idx_rasp_threat_type ON rasp_events(threat_type);

COMMENT ON TABLE rasp_events IS 'Eventos de segurança RASP — detecção de scraping e fraudes em runtime';

-- Regras de alerta RASP (seed se não existirem)
INSERT INTO alert_rules (name, rule_type, service, threshold, window_min, cooldown_min, enabled)
SELECT * FROM (VALUES
    ('RASP: pico de ameaças', 'rasp_threat_count', NULL::varchar, 5::numeric, 5, 10, true),
    ('RASP: bots detectados', 'rasp_threat_count', NULL::varchar, 3::numeric, 5, 15, true)
) AS seed(name, rule_type, service, threshold, window_min, cooldown_min, enabled)
WHERE NOT EXISTS (
    SELECT 1 FROM alert_rules WHERE rule_type = 'rasp_threat_count' LIMIT 1
);
