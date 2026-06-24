# Fase 5 — Arquitetura Uptime e Notificações

## Fluxo

```mermaid
sequenceDiagram
    participant Job as UptimeProbeJob
    participant Target as URL monitorada
    participant DB as PostgreSQL
    participant Hub as EventHub
    participant WS as Dashboard
    participant Alert as AlertEngine
    participant Hook as Webhook

    Job->>Target: GET /health
    Target-->>Job: 200 ou erro
    Job->>DB: INSERT uptime_checks
    Job->>Hub: broadcastUptime
    Hub->>WS: WS uptime
    Job->>Alert: evaluateUptime
    Alert->>DB: INSERT alerts_fired
    Alert->>Hook: POST se não suprimido
```

## Componentes

| Módulo | Responsabilidade |
|---|---|
| `jobs/uptime-probes.ts` | Scheduler 15s, respeita `interval_sec` |
| `uptime/prober.ts` | fetch + timeout + classificação status |
| `db/uptime.ts` | CRUD monitors, stats, falhas consecutivas |
| `notifications/webhook.ts` | POST Slack-compatible |
| `realtime/redis-bridge.ts` | Pub/sub entre backends |

## Teste manual

```bash
pnpm docker:up          # inclui Redis
pnpm db:migrate
pnpm dev:demo-api
pnpm dev                # backend + dashboard
# Desligar demo-api → em ~2 min status down + alerta
```
