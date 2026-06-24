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

# 3. Subir infraestrutura (PostgreSQL + RabbitMQ)
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

Documentação acadêmica: [`docs/`](docs/) (ADRs, arquitetura, referência de API).

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
| GET | `/api/v1/events/stats` | Agregações para gráficos |
| GET | `/api/v1/alerts/stats` | Métricas de alertas |
| POST | `/api/v1/ingest/rasp` | Ingestão RASP |
| GET | `/api/v1/rasp/events` | Eventos de segurança |
| GET | `/api/v1/rasp/stats` | Stats RASP |
| GET | `/api/v1/uptime/monitors` | Monitors uptime |
| GET | `/api/v1/uptime/stats` | Stats uptime |
| WS | `/api/v1/ws/events` | Eventos em tempo real |

Ver [`docs/api-v1.md`](docs/api-v1.md) para referência completa.

## Teste manual de ingestão

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
