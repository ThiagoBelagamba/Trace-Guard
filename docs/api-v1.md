# TraceGuard — API v1

Referência dos endpoints HTTP e WebSocket do backend de ingestão.

**Base URL:** `http://localhost:3001`

---

## GET /health

Health check do servidor.

**Resposta 200:**
```json
{
  "status": "ok",
  "service": "traceguard-backend",
  "wsClients": 1
}
```

---

## POST /api/v1/ingest

Ingestão assíncrona de eventos de telemetria. Valida com Zod, publica no RabbitMQ e retorna imediatamente.

**Body:** array de `LogEvent` (1–1000 itens)

```json
[
  {
    "traceId": "abc1234567890123456789012345678",
    "spanId": "def4567890123456",
    "service": "demo-app",
    "level": "info",
    "message": "HTTP GET https://example.com",
    "metadata": { "statusCode": 200 },
    "durationMs": 45.2,
    "timestamp": "2026-06-24T17:00:00.000Z"
  }
]
```

**Resposta 202:**
```json
{
  "accepted": 1,
  "message": "Eventos enfileirados para processamento"
}
```

**Exemplo:**
```bash
curl -X POST http://localhost:3001/api/v1/ingest \
  -H "Content-Type: application/json" \
  -d '[{"traceId":"abc1234567890123456789012345678","spanId":"def4567890123456","service":"demo","level":"info","message":"teste","timestamp":"2026-06-24T17:00:00.000Z"}]'
```

---

## GET /api/v1/events

Lista eventos recentes do PostgreSQL.

**Query params:**
| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `limit` | number | 10 | Máximo de eventos (1–100) |

**Resposta 200:**
```json
{
  "count": 2,
  "events": [
    {
      "id": "uuid",
      "traceId": "abc...",
      "spanId": "def...",
      "service": "demo-app",
      "level": "info",
      "message": "HTTP GET ...",
      "metadata": {},
      "durationMs": 45.2,
      "createdAt": "2026-06-24T17:00:00.000Z"
    }
  ]
}
```

---

## GET /api/v1/traces/:traceId

Detalhe de um trace para drill-down no dashboard. Correlaciona eventos APM e RASP pelo mesmo `traceId`.

**Resposta 200:**
```json
{
  "traceId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "events": [],
  "raspEvents": [],
  "spanCount": 2,
  "durationMs": 48
}
```

**Resposta 404:** `{ "error": "Trace não encontrado" }`

---

## GET /api/v1/events/stats

Agregações para gráficos do dashboard.

**Query params:**
| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `since` | ISO 8601 | 24h atrás | Início do período |
| `bucket` | `1m` \| `5m` | `1m` | Granularidade temporal |

**Resposta 200:**
```json
{
  "timeline": [
    { "bucket": "2026-06-24T17:00:00.000Z", "count": 12 }
  ],
  "byLevel": { "info": 10, "warn": 1, "error": 1 },
  "byService": { "demo-app": 12 }
}
```

---

## WebSocket /api/v1/ws/events

Conexão persistente para receber eventos em tempo real.

**URL:** `ws://localhost:3001/api/v1/ws/events`

**Query params (filtros opcionais):**
| Param | Descrição |
|---|---|
| `service` | Filtra por nome do serviço |
| `level` | Filtra por nível (`info`, `warn`, `error`, `debug`) |

**Mensagens recebidas:**

Conexão estabelecida:
```json
{ "type": "connected", "clientId": "uuid" }
```

Novo evento:
```json
{
  "type": "event",
  "data": { ... }
}
```

Novo alerta (Fase 3):
```json
{
  "type": "alert",
  "data": { ... }
}
```

Evento RASP (Fase 4):
```json
{ "type": "rasp", "data": { ... } }
```

Check de uptime (Fase 5):
```json
{
  "type": "uptime",
  "data": {
    "id": "uuid",
    "monitorId": "uuid",
    "monitorName": "demo-api health",
    "status": "up",
    "latencyMs": 42,
    "statusCode": 200,
    "checkedAt": "2026-06-24T17:00:00.000Z"
  }
}
```

**Exemplo JavaScript:**
```javascript
const ws = new WebSocket("ws://localhost:3001/api/v1/ws/events?service=demo-app");
ws.onmessage = (msg) => console.log(JSON.parse(msg.data));
```

---

## GET /api/v1/alerts

Lista alertas disparados recentemente (acionáveis e suprimidos).

**Query params:** `limit` (1–100, default 20)

**Resposta 200:**
```json
{
  "count": 2,
  "alerts": [
    {
      "id": "uuid",
      "ruleId": "uuid",
      "ruleName": "Pico de erros",
      "service": "demo-app",
      "severity": "warning",
      "title": "...",
      "message": "...",
      "eventCount": 12,
      "suppressed": false,
      "firedAt": "2026-06-24T17:00:00.000Z"
    }
  ]
}
```

---

## GET /api/v1/alerts/stats

Métricas de mitigação de fadiga (últimas 24h).

**Resposta 200:**
```json
{
  "fired": 3,
  "suppressed": 12,
  "suppressionRate": 80
}
```

---

## GET /api/v1/alerts/rules

Lista todas as regras de alerta.

---

## PATCH /api/v1/alerts/rules/:id

Habilita ou desabilita uma regra.

**Body:** `{ "enabled": true | false }`

---

## POST /api/v1/ingest/rasp

Ingestão síncrona de eventos de segurança RASP (Fase 4). Persiste em `rasp_events` e faz broadcast WebSocket.

**Body:** array de `RaspEvent` (1–1000 itens)

```json
[
  {
    "traceId": "abc1234567890123456789012345678",
    "spanId": "def4567890123456",
    "service": "demo-api",
    "threatType": "bot_user_agent",
    "action": "blocked",
    "clientIp": "127.0.0.1",
    "userAgent": "python-requests/2.31",
    "path": "/api/products/1",
    "method": "GET",
    "score": 70,
    "timestamp": "2026-06-24T17:00:00.000Z"
  }
]
```

**Resposta 202:**
```json
{
  "accepted": 1,
  "message": "Eventos RASP persistidos"
}
```

---

## GET /api/v1/rasp/events

Lista ameaças RASP recentes.

**Query params:** `limit` (1–100, default 20)

**Resposta 200:**
```json
{
  "count": 1,
  "events": [
    {
      "id": "uuid",
      "traceId": "abc...",
      "threatType": "bot_user_agent",
      "action": "blocked",
      "clientIp": "127.0.0.1",
      "score": 70,
      "path": "/api/products/1",
      "method": "GET",
      "timestamp": "2026-06-24T17:00:00.000Z"
    }
  ]
}
```

---

## GET /api/v1/rasp/stats

Agregações RASP das últimas 24h.

**Resposta 200:**
```json
{
  "byThreatType": {
    "bot_user_agent": 12,
    "sequential_scan": 8
  },
  "blocked": 15,
  "logged": 5
}
```

---

## GET /api/v1/uptime/monitors

Lista monitors HTTP configurados.

## POST /api/v1/uptime/monitors

Cria monitor. Body: `{ name, url, intervalSec?, timeoutMs?, expectedStatus? }`

## PATCH /api/v1/uptime/monitors/:id

Atualiza monitor (parcial).

## DELETE /api/v1/uptime/monitors/:id

Remove monitor e histórico (CASCADE).

## GET /api/v1/uptime/checks

Histórico de probes. Query: `monitorId`, `limit` (default 50).

## GET /api/v1/uptime/stats

Disponibilidade 24h: `{ monitors, up, down, avgLatencyMs, uptimePercent24h }`

---

## Códigos de erro

| Código | Endpoint | Causa |
|---|---|---|
| 400 | POST /ingest, POST /ingest/rasp | Payload inválido (falha Zod) |
| 202 | POST /ingest, POST /ingest/rasp | Sucesso |
