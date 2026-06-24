# Arquitetura — Fase 3: Motor de Alertas

## Visão geral

```mermaid
flowchart TB
    subgraph ingest [Ingestão]
        Consumer[telemetry-consumer]
        PG[(telemetry_events)]
        Consumer --> PG
    end

    subgraph alerts [Motor de Alertas]
        Engine[AlertEngine]
        Rules[(alert_rules)]
        Fired[(alerts_fired)]
        Cooldown[cooldownRegistry]
        MV[telemetry_hourly_stats]
        Refresh[job 5min]
        PG --> Engine
        Rules --> Engine
        Engine --> Cooldown
        Engine --> Fired
        PG --> Refresh --> MV
    end

    subgraph notify [Notificação]
        Hub[EventHub]
        WS[WebSocket]
        API[REST /alerts]
        Engine --> Hub --> WS
        Fired --> API
    end

    subgraph ui [Dashboard]
        Banner[AlertStatsBanner]
        Panel[AlertsPanel]
        WS --> Panel
        API --> Banner
        API --> Panel
    end
```

## Sequência de avaliação

```mermaid
sequenceDiagram
    participant C as Consumer
    participant E as AlertEngine
    participant DB as PostgreSQL
    participant CD as Cooldown
    participant H as EventHub
    participant D as Dashboard

    C->>DB: INSERT telemetry_events
    C->>E: evaluate(inserted)
    E->>DB: SELECT rules + window stats
    alt Regra disparou e sem cooldown
        E->>DB: INSERT alerts_fired suppressed=false
        E->>CD: markFired
        E->>H: broadcastAlert
        H->>D: WsMessage type alert
    else Regra disparou mas em cooldown
        E->>DB: INSERT alerts_fired suppressed=true
    end
```

## Tabelas

| Tabela / View | Função |
|---|---|
| `alert_rules` | Definição de regras (threshold, janela, cooldown) |
| `alerts_fired` | Histórico de alertas acionáveis e suprimidos |
| `telemetry_hourly_stats` | MV para agregação horária (refresh a cada 5 min) |

## Regras seed padrão

| Nome | Tipo | Threshold | Janela | Cooldown |
|---|---|---|---|---|
| Taxa de erro elevada | error_rate | 20% | 5 min | 15 min |
| Pico de erros | error_count | 10 | 5 min | 10 min |
| Rajada no mesmo trace | error_burst | 3 | 1 min | 5 min |

## Teste de stress

```bash
pnpm dev:demo:stress
```

Gera 15 erros HTTP no mesmo trace para disparar regras `error_count` e `error_burst`.
