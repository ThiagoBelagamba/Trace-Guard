# Arquitetura — Fase 2: Visão Geral

## Fluxo completo (Fase 1 + Fase 2)

```mermaid
flowchart TB
    subgraph apps [Aplicações Monitoradas]
        DemoApp[demo-app]
        SDK["@traceguard/sdk"]
        DemoApp --> SDK
    end

    subgraph ingest [Ingestão]
        Ingest["POST /api/v1/ingest"]
        RMQ[RabbitMQ]
        Consumer[telemetry-consumer]
        PG[(PostgreSQL)]
        SDK --> Ingest --> RMQ --> Consumer --> PG
    end

    subgraph realtime [Tempo Real — Fase 2]
        Hub[EventHub]
        WS["WS /api/v1/ws/events"]
        Stats["GET /api/v1/events/stats"]
        Consumer --> Hub --> WS
        PG --> Stats
    end

    subgraph dashboard [Dashboard]
        UI[Next.js Dashboard]
        UI -->|"bootstrap"| PG
        UI --> Stats
        WS --> UI
    end
```

## Sequência: evento do SDK até o dashboard

```mermaid
sequenceDiagram
    participant SDK
    participant API as Backend API
    participant RMQ as RabbitMQ
    participant Consumer
    participant PG as PostgreSQL
    participant Hub as EventHub
    participant WS as WebSocket
    participant Dash as Dashboard

    SDK->>API: POST /api/v1/ingest
    API->>RMQ: publish batch
    API-->>SDK: 202 Accepted
    RMQ->>Consumer: deliver message
    Consumer->>PG: INSERT RETURNING
    Consumer->>Hub: broadcast(event)
    Hub->>WS: JSON WsMessage
    WS->>Dash: onmessage
    Dash->>Dash: atualiza tabela + gráficos
```

## Endpoints da Fase 2

| Endpoint | Protocolo | Função |
|---|---|---|
| `/api/v1/events` | HTTP GET | Bootstrap — últimos N eventos |
| `/api/v1/events/stats` | HTTP GET | Agregações para gráficos |
| `/api/v1/ws/events` | WebSocket | Push em tempo real |
