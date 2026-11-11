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

Detalhe de um trace para drill-down no dashboard. Correlaciona eventos APM, detecções RASP e alertas pelo mesmo `traceId`.

**Resposta 200:**
```json
{
  "traceId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "events": [],
  "raspEvents": [],
  "alerts": [],
  "spanCount": 2,
  "durationMs": 48
}
```

**Resposta 404:** `{ "error": "Trace não encontrado" }`

---

## GET /api/v1/traces/:traceId/insight

Diagnóstico forense causal do trace. Sintetiza de forma determinística (`source: "causal-engine"`) o veredito, os pilares correlacionados (`apm`, `rasp`, `alert`), a soma dos pesos heurísticos do RASP, a cadeia causal e as recomendações de mitigação. Se `AI_API_URL` estiver configurado, refina a síntese via LLM (`source: "llm"`).

**Resposta 200:**
```json
{
  "traceId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "verdict": "attack_blocked",
  "severity": "critical",
  "headline": "Tentativa de scraping bloqueada pelo RASP (GET /api/products/1 · score 70/100)",
  "narrative": "O mesmo traceId correlacionou a inspeção RASP do IP 203.0.113.42...",
  "rootCause": {
    "category": "rasp",
    "summary": "assinatura de User-Agent automatizado (+50) + ausência de cabeçalhos de navegador (+20) a partir de 203.0.113.42",
    "service": "demo-api",
    "spanId": "aaaa1111aaaa1111"
  },
  "causalChain": [
    "Origem 203.0.113.42 enviou GET /api/products/1 (UA: python-requests/2.31.0).",
    "Middleware RASP em demo-api somou score 70/100: assinatura de User-Agent automatizado (+50) + ausência de cabeçalhos de navegador (+20).",
    "Ação em runtime: requisição interceptada com HTTP 403 no span aaaa1111aaaa1111 (score 70 >= limiar 70)."
  ],
  "recommendations": [
    "Manter bloqueio em memória/Redis ativo para o IP 203.0.113.42 e auditar reincidência na aba Segurança."
  ],
  "correlatedPillars": ["apm", "rasp"],
  "source": "causal-engine",
  "generatedAt": "2026-11-08T20:00:00.000Z"
}
```

**Resposta 404:** `{ "error": "Trace não encontrado" }`

**`llmFallback`:** quando `AI_API_URL` está configurado mas o refinamento via LLM não é aproveitado, o insight volta com `source: "causal-engine"` e o campo `llmFallback` indicando o motivo:

| Valor | Significado |
|---|---|
| `timeout` | O LLM não respondeu dentro de `AI_TIMEOUT_MS` |
| `http_error` | O LLM respondeu com status HTTP diferente de 2xx |
| `network_error` | Falha de rede ao chamar o LLM |
| `invalid_response` | A resposta do LLM não tem o formato esperado |
| `rejected_output` | A resposta foi descartada pela validação (contradiz o veredito, traz links ou HTML) |
| `rate_limited` | O orçamento de chamadas por minuto ao LLM foi atingido |

**Variáveis de ambiente relacionadas:**

| Variável | Padrão | Descrição |
|---|---|---|
| `AI_API_URL` | — | Endpoint do LLM (compatível com OpenAI ou Ollama); sem ele o motor causal responde sozinho |
| `AI_TIMEOUT_MS` | `10000` | Tempo máximo de espera pelo LLM |
| `AI_INSIGHT_CACHE_TTL_MS` | `60000` | Validade do cache de insights por trace |
| `AI_MAX_CALLS_PER_MINUTE` | `30` | Limite de chamadas reais ao LLM por minuto |

**Cache por trace:** com `AI_API_URL` ativo, o insight gerado pelo LLM é guardado por trace (a chave inclui a quantidade de eventos, eventos RASP e alertas, então dados novos geram um diagnóstico novo). Chamadas simultâneas para o mesmo trace compartilham uma única chamada ao LLM, e resultados de fallback não entram no cache. Configure `API_KEY` quando usar `AI_API_URL`, pois cada chamada pode gerar custo.

---

## POST /api/v1/mcp

Servidor **Model Context Protocol (MCP — JSON-RPC 2.0)** embutido no backend. Suporta os métodos `initialize`, `ping`, `tools/list` e `tools/call` para as ferramentas:

- `investigate_trace` (`{ "traceId": "..." }`)
- `list_security_threats` (`{ "limit": 15 }`)
- `alert_fatigue_status` (`{ "limit": 15 }`)

**Exemplo (`tools/call`):**
```bash
curl -X POST http://localhost:3001/api/v1/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"investigate_trace","arguments":{"traceId":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}}'
```

**Comportamento do transporte HTTP:**

| Situação | Resposta |
|---|---|
| Requisição JSON-RPC (mensagem com `id`, inclusive `id: 0`) | `200` com o JSON da resposta |
| Notificação (mensagem sem `id`, ex.: `notifications/initialized`) | `202` sem corpo |
| Lote JSON-RPC (array) | `200` com erro `-32600` |
| `id` de tipo inválido (objeto, array, booleano, número não finito) | `200` com erro `-32600` e `id: null` |
| Corpo com JSON inválido ou vazio | `400` com erro `-32700` (`Parse error`) e `id: null` |
| `GET /api/v1/mcp` | `405` com header `Allow: POST` |
| Header `Origin` fora de `CORS_ORIGIN` | `403` `{ "error": "Origin não permitida" }` |

A validação de `Origin` só se aplica quando a requisição envia o header `Origin` e `CORS_ORIGIN` está definida (lista separada por vírgulas). Clientes sem `Origin` (curl, ponte stdio) sempre passam. A comparação ignora barra final e diferença de maiúsculas/minúsculas, e `CORS_ORIGIN='*'` (ou um item `*` na lista) libera qualquer `Origin`.

**Negociação de versão:** `initialize` devolve a `protocolVersion` enviada pelo cliente se ela for uma das suportadas (`2025-06-18`, `2025-03-26`, `2024-11-05`); caso contrário, responde `2025-06-18`.

**Erros:** tool desconhecida retorna o erro JSON-RPC `-32602`. Exceções durante a execução de uma tool retornam `result.isError: true` com o texto `Falha ao executar <tool>: <mensagem>`.

### Conectar via stdio

Clientes desktop como Claude Desktop e Cursor falam MCP por stdio. A ponte `stdio-bridge-main` lê uma mensagem JSON-RPC por linha no stdin, encaminha cada uma para o endpoint HTTP acima e escreve as respostas no stdout (os logs vão apenas para o stderr). Se o backend estiver fora do ar, cada requisição recebe um erro JSON-RPC `-32603` e a ponte continua ativa. As respostas do backend são reserializadas em uma única linha; um corpo 200 que não seja JSON vira um erro `-32603`, e um HTTP 401 indica que falta definir `TRACEGUARD_API_KEY`.

Variáveis de ambiente:

| Variável | Padrão | Descrição |
|---|---|---|
| `TRACEGUARD_MCP_URL` | `http://localhost:3001/api/v1/mcp` | Endpoint HTTP do backend |
| `TRACEGUARD_API_KEY` | — | Se definida, enviada no header `x-api-key` |

Compile o backend (`pnpm --filter @traceguard/backend build`) e use o arquivo compilado com `node`, o que evita que banners do pnpm/tsx sujem o stdout. Exemplo de `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "traceguard": {
      "command": "node",
      "args": ["<caminho absoluto>/apps/backend/dist/mcp/stdio-bridge-main.js"],
      "env": {
        "TRACEGUARD_MCP_URL": "http://localhost:3001/api/v1/mcp"
      }
    }
  }
}
```

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
