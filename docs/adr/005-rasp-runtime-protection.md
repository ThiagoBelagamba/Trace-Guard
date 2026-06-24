# ADR 005 — Proteção RASP em runtime no SDK

## Status

Aceito — Fase 4

## Contexto

O diferencial do TraceGuard no TCC é a **proteção de borda em runtime** contra web scraping e fraudes, integrada à telemetria APM. Alternativas consideradas:

| Abordagem | Prós | Contras |
|---|---|---|
| WAF externo (Nginx, Cloudflare) | Escala, regras maduras | Não correlaciona com traceId; deploy separado |
| Sidecar / proxy dedicado | Isola a app | Complexidade operacional na PoC self-hosted |
| **RASP no SDK** | Correlação traceId; zero infra extra; demonstrável no TCC | Heurísticas limitadas; rate limit in-memory |

## Decisão

Implementar módulo **RASP** no `@traceguard/sdk` com middleware Express (`raspMiddleware`), heurísticas em memória e exportação para `POST /api/v1/ingest/rasp`.

### Modos

- **monitor** — registra ameaças (`action: logged`) sem bloquear
- **block** — retorna HTTP 403 quando `score >= blockThreshold` (default 70)

### Heurísticas (PoC)

| Tipo | Detecção | Score |
|---|---|---|
| `rate_limit` | IP excede `maxRequestsPerMinute` em 60s | +40 |
| `bot_user_agent` | UA contém padrões conhecidos (python-requests, scrapy, curl…) | +50 |
| `sequential_scan` | Muitos paths distintos do mesmo IP em 1 min | +60 |
| `missing_headers` | Ausência de `accept` / `accept-language` em rotas browser-like | +20 |

Scores são **somados**; o `threatType` primário é o de maior severidade.

## Consequências

- **Positivas:** mesmo `traceId` em evento RASP e logs APM; dashboard em tempo real; demo reproduzível (`demo:scrape`)
- **Negativas:** falsos positivos possíveis; rate limiter não escala horizontalmente sem Redis (Fase 5)
- **Mitigações:** `blockThreshold` configurável; modo `monitor` para calibração; `trust proxy` no Express demo

## Referências

- [`docs/architecture/fase-4-rasp.md`](../architecture/fase-4-rasp.md)
- [`docs/architecture/fase-4-heuristicas.md`](../architecture/fase-4-heuristicas.md)
