# Fase 4 — Heurísticas RASP

## Tabela de detecção

| `threatType` | Condição | Score | Exemplo de gatilho |
|---|---|---|---|
| `rate_limit` | Requisições do IP > `maxRequestsPerMinute` (60s) | +40 | Scraper a 50 req/min |
| `bot_user_agent` | UA contém padrão de bot | +50 | `python-requests/2.31` |
| `sequential_scan` | Paths distintos > `sequentialScanThreshold` (60s) | +60 | `/api/products/1` … `/50` |
| `missing_headers` | Sem `accept` ou `accept-language` em rotas `/api/*` | +20 | curl sem headers |

## Cálculo do score

```
score = min(100, soma dos scores das ameaças detectadas)
```

**Bloqueio** (modo `block`): `score >= blockThreshold` (default **70**).

### Exemplo — scraper simulado

| Ameaça | Score parcial |
|---|---|
| `bot_user_agent` | +50 |
| `missing_headers` | +20 |
| `sequential_scan` (após ~20 paths) | +60 |

Total pode ultrapassar 70 já na primeira requisição com UA de bot + headers ausentes (+70).

## Configuração (`RaspConfig`)

```typescript
{
  enabled: true,
  mode: "block",              // ou "monitor"
  maxRequestsPerMinute: 60,
  blockThreshold: 70,
  sequentialScanThreshold: 20,
}
```

## Falsos positivos

| Cenário | Risco | Mitigação |
|---|---|---|
| API client legítimo sem `accept-language` | `missing_headers` | Modo `monitor`; ajustar threshold |
| Usuário atrás de NAT corporativo | `rate_limit` | Aumentar `maxRequestsPerMinute` |
| Crawlers benignos (Googlebot) | `bot_user_agent` | Whitelist na Fase 5 |

## Comparativo (monografia)

| Cenário | Sem RASP | Com TraceGuard RASP |
|---|---|---|
| Scraper 50 req/min | Servidor processa tudo | Bloqueio após threshold + evento com traceId |
| Bot com UA `python-requests` | Indistinguível de tráfego normal | Detectado, score elevado, 403 |
