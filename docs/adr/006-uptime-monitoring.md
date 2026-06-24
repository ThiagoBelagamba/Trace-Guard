# ADR 006 — Monitoramento de Uptime via HTTP Probes

## Status

Aceito — Fase 5

## Contexto

O TraceGuard promete monitoramento de uptime self-hosted. Alternativas:

| Abordagem | Prós | Contras |
|---|---|---|
| Agente instalado no host | Métricas ricas | Complexidade de deploy |
| **HTTP probe centralizado** | Simples; alinha com PoC | Não cobre métricas de SO |
| Ping ICMP | Leve | Bloqueado em muitos ambientes cloud |

## Decisão

Implementar **probes HTTP** no backend (`UptimeProbeJob`), com tabelas `uptime_monitors` e `uptime_checks`.

- Intervalo configurável por monitor (`interval_sec`, default 60s)
- Timeout configurável (`timeout_ms`, default 5000)
- Status: `up`, `down`, `degraded` (status HTTP inesperado)
- Alerta `uptime_down` após N falhas consecutivas

## Consequências

- Detecta indisponibilidade externa (não depende do SDK na app monitorada)
- Integra com WebSocket e webhook de alertas
- Limitação: probe a partir do backend — latência inclui rede até o alvo

## Referências

- [`docs/architecture/fase-5-uptime.md`](../architecture/fase-5-uptime.md)
