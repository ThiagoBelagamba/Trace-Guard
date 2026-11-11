# TraceGuard

Plataforma Unificada de Observabilidade, APM e Monitoramento de Uptime Self-Hosted.

## Pré-requisitos

- Node.js >= 20
- pnpm >= 9
- Docker e Docker Compose

## Setup rápido

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env

# 3. Subir infraestrutura (PostgreSQL + RabbitMQ + Redis)
pnpm docker:up

# 4. Build dos pacotes
pnpm build

# 5. Iniciar backend (em outro terminal)
pnpm dev:backend

# 6. Rodar demo app (valida SDK + ingestão)
pnpm dev:demo
```

## Fase 2 — Dashboard em tempo real

```bash
# Terminal 1: backend + dashboard juntos
pnpm dev

# Ou separadamente:
pnpm dev:backend    # http://localhost:3001
pnpm dev:dashboard  # http://localhost:3000

# Terminal 2: gerar telemetria ao vivo
pnpm dev:demo
```

Abra **http://localhost:3000** — a tabela atualiza via WebSocket quando novos eventos são persistidos.

Documentação acadêmica: [`docs/`](docs/) (ADRs, arquitetura, API).  
TCC: [`docs/tcc/monografia.md`](docs/tcc/monografia.md), [`docs/tcc/roteiro-defesa.md`](docs/tcc/roteiro-defesa.md), [`docs/tcc/resultados-experimentos.md`](docs/tcc/resultados-experimentos.md).

## Fase 3 — Mitigação de fadiga de alertas

```bash
# Aplicar migração (bancos Docker já existentes)
pnpm db:migrate

# Reiniciar backend + dashboard
pnpm dev

# Gerar erros para testar alertas
pnpm dev:demo:stress
```

No dashboard, aba **Alertas** — banner mostra alertas suprimidos vs. acionáveis.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/alerts` | Alertas recentes |
| GET | `/api/v1/alerts/stats` | Taxa de supressão (fadiga evitada) |
| GET | `/api/v1/alerts/rules` | Regras configuradas |
| PATCH | `/api/v1/alerts/rules/:id` | Habilitar/desabilitar regra |

## Fase 4 — Módulo RASP (Runtime Application Self-Protection)

```bash
# Aplicar migração RASP (incluída em db:migrate)
pnpm db:migrate

# Terminal 1: backend + dashboard
pnpm dev

# Terminal 2: API Express protegida
pnpm dev:demo-api

# Terminal 3: simular scraper
pnpm demo:scrape
```

No dashboard, aba **Segurança** — eventos RASP em tempo real e gráficos por tipo de ameaça.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/ingest/rasp` | Ingestão de eventos RASP |
| GET | `/api/v1/rasp/events` | Ameaças recentes |
| GET | `/api/v1/rasp/stats` | Estatísticas (24h) |

Modo monitor (sem bloqueio): `RASP_MODE=monitor pnpm dev:demo-api`

### Copiloto Forense de Trace & Servidor MCP (Model Context Protocol)

Ao clicar em qualquer `traceId` no dashboard (nas abas Eventos, Segurança ou Alertas), o painel lateral unifica os três pilares (**APM + RASP + Alertas**) e sintetiza um **Diagnóstico Forense Causal** (`GET /api/v1/traces/:traceId/insight`) com causa raiz, pesos heurísticos do RASP, supressão por cooldown e plano de mitigação. Se `AI_API_URL` estiver definido (ex.: Ollama local ou API compatível com OpenAI), um LLM refina a narrativa sobre o grafo causal determinístico; sem LLM externo, o motor causal responde de forma 100% determinística. As chamadas ao LLM são deduplicadas por trace e limitadas por minuto; ao ativar `AI_API_URL`, configure também `API_KEY`, pois sem ela `/insight` e `/mcp` ficam abertos e cada chamada pode gerar custo.

O mesmo diagnóstico é exposto para agentes de IA (Cursor, Claude Desktop, IDEs) via **Model Context Protocol (MCP — JSON-RPC 2.0)** em `POST /api/v1/mcp`, com as ferramentas `investigate_trace`, `list_security_threats` e `alert_fatigue_status`.

Clientes de desktop que só falam MCP via stdio (ex.: Claude Desktop) usam a ponte incluída no backend:

```bash
pnpm --filter @traceguard/backend build
TRACEGUARD_MCP_URL=http://localhost:3001/api/v1/mcp TRACEGUARD_API_KEY=<API_KEY> pnpm --filter @traceguard/backend mcp:stdio
```

Variáveis do Copiloto (todas opcionais; veja `.env.example`):

| Variável | Padrão | Função |
|---|---|---|
| `AI_API_URL` | — | Endpoint compatível com OpenAI/Ollama; vazio usa só o Motor Causal |
| `AI_MODEL` / `AI_API_KEY` | `gpt-4o-mini` / — | Modelo e chave do endpoint |
| `AI_TIMEOUT_MS` | `10000` | Tempo máximo da chamada ao LLM antes do fallback |
| `AI_INSIGHT_CACHE_TTL_MS` | `60000` | Tempo de cache do diagnóstico refinado por trace |
| `AI_MAX_CALLS_PER_MINUTE` | `30` | Orçamento de chamadas ao LLM; acima disso responde o Motor Causal (`llmFallback: "rate_limited"`) |

Bancos criados antes do Copiloto: rode `pnpm db:migrate` (ou só `pnpm db:migrate:alert-index`) para criar os índices que ligam alertas aos traces.

## Fase 5 — Uptime, Webhook e Redis

```bash
pnpm docker:up          # postgres + rabbitmq + redis
pnpm db:migrate
pnpm dev
pnpm dev:demo-api

# Deploy produção (stack completa)
pnpm docker:up:prod

# Teste de carga (requer k6)
pnpm load:test
```

Configure `ALERT_WEBHOOK_URL` no `.env` para notificações Slack/Discord.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/uptime/monitors` | Monitors HTTP |
| POST | `/api/v1/uptime/monitors` | Criar monitor |
| GET | `/api/v1/uptime/checks` | Histórico de probes |
| GET | `/api/v1/uptime/stats` | Disponibilidade 24h |

Redis (`REDIS_URL`): sincroniza WebSocket entre backends e rate limit RASP entre réplicas.

## Estrutura do monorepo

| Pacote | Descrição |
|---|---|
| `@traceguard/shared` | Tipos e schemas compartilhados |
| `@traceguard/sdk` | Agente de telemetria (async_hooks) |
| `@traceguard/backend` | Servidor de ingestão HTTP → RabbitMQ → PostgreSQL |
| `@traceguard/dashboard` | Dashboard Next.js com WebSocket e gráficos |
| `@traceguard/demo-app` | App de demonstração da PoC |
| `@traceguard/demo-api` | API Express com RASP + scraper simulado |

## Endpoints (Backend)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/v1/ingest` | Ingestão de eventos de telemetria |
| GET | `/api/v1/events?limit=10` | Listar eventos recentes |
| GET | `/api/v1/traces/:traceId` | Drill-down APM + RASP + Alertas do mesmo trace |
| GET | `/api/v1/traces/:traceId/insight` | Diagnóstico forense causal (Motor Causal / LLM) |
| POST | `/api/v1/mcp` | Servidor Model Context Protocol (JSON-RPC 2.0) |
| GET | `/api/v1/events/stats` | Agregações para gráficos |
| GET | `/api/v1/alerts/stats` | Métricas de alertas |
| POST | `/api/v1/ingest/rasp` | Ingestão RASP |
| GET | `/api/v1/rasp/events` | Eventos de segurança |
| GET | `/api/v1/rasp/stats` | Stats RASP |
| GET | `/api/v1/uptime/monitors` | Monitors uptime |
| GET | `/api/v1/uptime/stats` | Stats uptime |
| WS | `/api/v1/ws/events` | Eventos em tempo real |

Ver [`docs/api-v1.md`](docs/api-v1.md) para referência completa.

## Testes e experimentos (TCC)

```bash
pnpm test                 # testes unitários do núcleo
pnpm experiment:fatigue   # Exp. 1 — fadiga de alertas (backend no ar)
pnpm experiment:rasp      # Exp. 2 — precisão/recall do RASP (demo-api no ar)
pnpm experiment:overhead  # Exp. 3 — p50/p95 health + ingest
```

Clique em um **Trace ID** no dashboard para abrir o detalhe correlacionado (APM + RASP).

## Teste manual de ingestão

Com `API_KEY` definido no `.env`, inclua `-H "x-api-key: <API_KEY>"` nas chamadas.

```bash
curl -X POST http://localhost:3001/api/v1/ingest \
  -H "Content-Type: application/json" \
  -d '[{"traceId":"abc123","spanId":"def456","service":"demo","level":"info","message":"PoC ok","timestamp":"2026-06-24T00:00:00Z"}]'
```

## Serviços Docker

| Serviço | Porta | URL |
|---|---|---|
| PostgreSQL | 5432 | `localhost:5432` |
| RabbitMQ AMQP | 5672 | `localhost:5672` |
| RabbitMQ Management | 15672 | http://localhost:15672 (traceguard / traceguard_dev) |
| Backend | 3001 | http://localhost:3001 |
| Dashboard | 3000 | http://localhost:3000 |
| Redis | 6379 | `localhost:6379` |
