# ADR 007 — Escala horizontal com Redis

## Status

Aceito — Fase 5

## Contexto

Fases 2–4 usam `EventHub` in-memory e rate limiter RASP por processo — adequado para single-node, insuficiente para múltiplas réplicas.

## Decisão

Adotar **Redis 7** para:

1. **EventHub pub/sub** — canal `traceguard:realtime`; cada instância do backend republica mensagens `WsMessage` para clientes WS locais
2. **RASP rate limiter** — sorted sets `rasp:rl:{ip}:*` compartilhados entre réplicas do `demo-api`

`REDIS_URL` opcional em dev (fallback in-memory).

## Consequências

- WebSocket funciona com load balancer round-robin entre backends
- Bloqueio RASP consistente entre réplicas da API protegida
- Nova dependência operacional (Redis no docker-compose)

## Referências

- ADR 002 (previsão de Redis na Fase 5)
