# ADR 002 — Comunicação em Tempo Real via WebSocket

**Status:** Aceito  
**Data:** 2026-06-24  
**Fase:** 2 — Dashboard em Tempo Real

## Contexto

O dashboard TraceGuard precisa exibir eventos de telemetria assim que são persistidos no PostgreSQL, sem que o usuário recarregue a página. A Fase 1 oferecia apenas `GET /api/v1/events` (polling manual).

Alternativas avaliadas:

| Abordagem | Prós | Contras |
|---|---|---|
| **Polling** (`setInterval` + fetch) | Simples | Latência, carga desnecessária no backend |
| **SSE** (Server-Sent Events) | Unidirecional, HTTP nativo | Apenas servidor → cliente; sem filtros bidirecionais |
| **WebSocket** | Bidirecional, baixa latência | Requer plugin Fastify; reconexão manual no cliente |

## Decisão

Adotar **WebSocket** via `@fastify/websocket` no endpoint `GET /api/v1/ws/events`.

O consumer RabbitMQ, após `INSERT` no PostgreSQL, chama `EventHub.broadcast()` — um singleton in-memory que envia `{ type: "event", data: DashboardEvent }` para todos os clientes conectados.

Filtros opcionais via query string (`?service=demo-app&level=error`) reduzem ruído no cliente, alinhado ao objetivo de mitigar fadiga de alertas.

## Consequências

**Positivas:**
- Latência sub-segundo entre persistência e exibição no dashboard
- Contrato tipado (`WsMessage`) compartilhado em `@traceguard/shared`
- Reconexão com backoff exponencial no hook `useTelemetrySocket`

**Negativas:**
- `EventHub` in-memory não escala horizontalmente (múltiplas instâncias do backend)
- Requer CORS configurado para fetch REST; WebSocket não sofre CORS mas precisa de URL correta

## Alternativas rejeitadas

- **Redis pub/sub:** complexidade prematura para PoC single-node self-hosted
- **SSE:** suficiente para push unidirecional, mas o escopo do TCC especifica WebSocket explicitamente
- **Polling a cada 1s:** desperdiça recursos e não demonstra arquitetura orientada a eventos
