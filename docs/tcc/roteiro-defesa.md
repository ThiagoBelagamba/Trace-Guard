# Roteiro de defesa — 8 minutos

Fale olhando para a banca, não para o slide. O diferencial é uma frase: **o mesmo `traceId` liga APM, RASP e alerta**.

## 0:00–1:00 — Problema

PMEs não aguentam Datadog. Stacks OSS (SigNoz, Jaeger, Uptime Kuma, ModSecurity) resolvem pedaços isolados. O operador troca de ferramenta e perde a correlação. Alertar cada `error` gera fadiga.

Pergunta de pesquisa: *é possível unificar observabilidade, proteção em runtime e uptime em um agente self-hosted, reduzindo notificações sem perder o sinal?*

## 1:00–2:30 — Solução em uma figura

Mostre o fluxo: SDK → `POST /ingest` → RabbitMQ → PostgreSQL → WebSocket → dashboard.

Três módulos no mesmo produto:

1. APM (AsyncLocalStorage + `traceparent` W3C)
2. Alertas com cooldown e taxa de supressão
3. RASP no middleware Express, correlacionado ao trace

## 2:30–5:00 — Demo ao vivo

1. `pnpm dev` + `pnpm dev:demo-api`
2. `pnpm demo:scrape`
3. Dashboard → Segurança: evento `blocked`, score ≥ 70
4. Clique no Trace ID: painel mostra o HTTP da API **e** o bloqueio RASP
5. `pnpm experiment:fatigue` ou `pnpm dev:demo:stress` → aba Alertas: fired vs. suprimidos

Se a rede falhar, use o vídeo de backup de 90 segundos (grave uma vez).

## 5:00–6:30 — Resultados

| Experimento | Achado para ler em voz alta |
|---|---|
| Fadiga | 150 erros naive = 150 notificações; TraceGuard dispara as 3 regras e suprime a segunda rajada (50% nesta execução) |
| RASP | Dataset rotulado: precisão, recall, F1, Youden. Googlebot não é bloqueado |
| Overhead | p95 do ingest abaixo de 500 ms no alvo do k6 |

## 6:30–7:30 — Relacionados e limites

Não substitui SigNoz nem OpenTelemetry Collector. Recorte: PME, um agente, correlação APM+RASP.

Limites: heurísticas estáticas, Express only, cooldown in-memory, sem multi-tenant.

## 7:30–8:00 — Encerramento

O trabalho entrega um artefato executável, ADRs, testes, CI e três experimentos reproduzíveis. Trabalho futuro: OTLP, Fastify, retenção.

## Perguntas prováveis

- **Por que não SigNoz + ModSecurity?** Correlação no mesmo `traceId`, deploy único, métrica de fadiga.
- **Isso é RASP de verdade?** RASP de borda (scraping/bots), não inspeção de SQLi no driver. Declarado na monografia.
- **Onde estão os testes?** `pnpm test` — detector, cooldown, W3C, auth, métricas.
- **E se eu mudar o User-Agent?** Heurística falha; por isso o experimento publica FP/FN e existe modo `monitor`.
