# Resultados experimentais

Protocolo em `scripts/experiments/`. Execução oficial do autor em 19/09/2026 (máquina local). Documente CPU, RAM e SO na versão ABNT.

## Ambiente de referência (execução 19/09/2026)

- Backend local + PostgreSQL + RabbitMQ
- Comando: `pnpm experiment:fatigue`

### Experimento 1 — Fadiga de alertas

Baseline naive: 150 notificações (1 por evento de erro).

| Etapa | Fired | Suprimidos | Taxa (API) |
|---|---:|---:|---:|
| Antes | 0 | 0 | 0% |
| Após 100 erros | 3 | 0 | 0% |
| Após +50 erros (cooldown) | 3 | 3 | 50% |

**Leitura:** o motor agrega a janela. A primeira rajada dispara as 3 regras padrão (`error_rate`, `error_count`, `error_burst`). A segunda rajada, ainda em cooldown, é persistida como suprimida. Delta: 3 acionáveis, 3 suprimidos, taxa 50%.

Isso é mais honesto do que “99 suprimidos”: o sistema nunca cria um alerta por log.

### Experimento 2 — RASP

Comando: `pnpm experiment:rasp` (requer `pnpm dev:demo-api`). Estado do rate limiter zerado (API recém-iniciada).

| Caso | Esperado | Detectado |
|---|---|---|
| browser_legitimo | legítimo | permitido |
| healthcheck_curl | legítimo | permitido |
| scraper_python | ameaça | bloqueado |
| scraper_scrapy | ameaça | bloqueado |
| crawler_googlebot | legítimo | permitido |

| Métrica | Valor |
|---|---:|
| TP | 2 |
| FP | 0 |
| FN | 0 |
| TN | 3 |
| Precisão | 1.000 |
| Recall | 1.000 |
| F1 | 1.000 |
| Youden | 1.000 |

**Leitura:** dataset pequeno e controlado — perfeito no laboratório, não generalize como “RASP 100% em produção”. O script usa `http.request` (não `fetch` do Node), porque o fetch injeta `Accept-Language: *` e o scraper deixaria de somar `missing_headers` (score 50 < 70).

### Experimento 3 — Overhead

Comando: `pnpm experiment:overhead`. 80 amostras.

| Alvo | média (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|
| GET /health (RASP analisa) | 1.6 | 1.5 | 2.1 |
| POST /api/v1/ingest | 2.0 | 1.8 | 3.2 |

p95 do ingest (3.2 ms) está muito abaixo do alvo de 500 ms do k6. Documente CPU/RAM na monografia.

### Experimento 4 — LAYA (alternativa descartada)

- **Protocolo:** configurações pré-registradas em `docs/tcc/experimento-4-registro/`, com conjuntos separados de desenvolvimento, validação e teste; o teste roda uma vez por configuração.
- **Resultado:** no conjunto de teste, a configuração C10 subiu o F1 de 0,521 (C00) para 0,663 e o recall de `secret_leak` de 0,125 para 0,688, mas teve 29/132 (0,220) falsos positivos em legítimos difíceis, contra o máximo de 0,186.
- **Veredito:** C10 não passou no critério `tres-condicoes-v1`.
- **Decisão:** a LAYA saiu do produto e foi substituída pelo Copiloto Forense (ADR 011). O código do experimento está na *tag* `exp4-laya-final`.
