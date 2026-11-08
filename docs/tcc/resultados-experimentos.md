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

### Experimento 4 — Laya (sidecar em modo sombra)

Pré-requisitos: `pnpm build` (a demo-api usa o `dist` do SDK), `docker compose --profile laya up -d --build laya` e `pnpm dev:backend`.

Comando: `pnpm experiment:laya`. Dataset rotulado em `scripts/experiments/laya-experiments/core/laya-dataset.ts`: 40 textos (12 prompt injection, 10 credenciais fictícias, 18 legítimos, sendo 10 difíceis), metade em PT-BR e metade em EN.

Protocolo:

1. **4.1 Acurácia:** cada texto vai 3 vezes direto ao sidecar, com o mesmo payload (`{"message": texto}`), as mesmas perguntas e o mesmo limiar do SDK (`noul ≥ 0.80`, sem abstenção). O veredito é a maioria das 3 execuções. Falha de transporte fica fora das métricas e é contada à parte.
2. **4.2 Latência do modelo:** p50/p95 de `POST /v1/systemone`. Antes de medir, o aquecimento passa por PT e EN, porque o sidecar baixa sob demanda o checkpoint de cada idioma.
3. **4.3 Custo no caminho quente:** o script sobe a demo-api duas vezes na porta 4100 (`RASP_MODE=monitor`), primeiro sem e depois com `LAYA_SIDECAR_URL`, e mede `POST /api/chat`. As rodadas sem sidecar e em rajada têm 40 × 3 amostras e 10 aquecimentos. A rodada ritmada usa os 40 envios da 4.4, com um intervalo de p95 do modelo entre eles, para que toda requisição seja inspecionada.
4. **4.4 Integração por traceId:** cada texto vai uma vez com `traceparent` gerado pelo script, em intervalos de pelo menos o p95 do modelo. O script confere em `/api/v1/rasp/events` se cada texto marcado na 4.1 chegou com o mesmo `traceId`.

**4.1 Acurácia (binário: ameaça vs. legítimo)**

| Métrica | Valor |
|---|---:|
| Precisão | — |
| Recall | — |
| F1 | — |
| Youden | — |

| Métrica | prompt_injection | secret_leak |
|---|---:|---:|
| Precisão | — | — |
| Recall | — | — |
| F1 | — | — |

Falsos positivos em legítimos difíceis: — · recall PT: — · recall EN: —

**4.2 Latência do modelo**

| Alvo | média (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|
| Laya /v1/systemone | — | — | — |

**4.3 Custo no caminho quente**

| Alvo | amostras | média (ms) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| POST /api/chat sem sidecar | 120 | — | — | — |
| POST /api/chat com sidecar, ritmado (toda requisição inspecionada) | 40 | — | — | — |
| POST /api/chat com sidecar, rajada (fila de 4 saturada) | 120 | — | — | — |

A linha ritmada é o custo por requisição inspecionada. Na rajada, o SDK descarta as inspeções que encontram as 4 vagas ocupadas, então a maioria das requisições não chega ao modelo.

**4.4 Integração por traceId**

| Métrica | Valor |
|---|---:|
| Esperados | — |
| Entregues com traceId correto | — |
| Taxa de entrega | — |
| Atraso do sombra, p95 (ms) | — |

**Leitura:** preencher após a execução oficial.
