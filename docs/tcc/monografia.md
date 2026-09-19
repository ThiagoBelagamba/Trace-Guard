# TraceGuard: plataforma self-hosted de observabilidade, alertas e proteção em runtime

**Autor:** Thiago Belagamba  
**Tipo:** Trabalho de Conclusão de Curso — Ciência da Computação / Engenharia de Software  
**Artefato:** repositório TraceGuard (monorepo TypeScript)

> Versão LaTeX ABNT: [`latex/main.tex`](./latex/main.tex) (Overleaf: pasta `latex/`, pdfLaTeX + biber). Este Markdown permanece como rascunho. Resultados: [`resultados-experimentos.md`](./resultados-experimentos.md). Defesa: [`roteiro-defesa.md`](./roteiro-defesa.md).

---

## Resumo

Sistemas de Application Performance Monitoring (APM) comerciais são caros para pequenas e médias empresas, enquanto stacks open source fragmentam traces, logs, uptime e segurança em produtos distintos. Este trabalho apresenta o **TraceGuard**, plataforma self-hosted que une telemetria de aplicação, mitigação de fadiga de alertas, monitoramento de uptime e um módulo de Runtime Application Self-Protection (RASP) no mesmo agente Node.js. O recorte científico é a **correlação**: o mesmo `traceId` — propagado por AsyncLocalStorage e pelo padrão W3C Trace Context — liga latência, bloqueio de scraper e alerta acionável. Foram realizados três experimentos reproduzíveis: supressão de alertas por cooldown, precisão/recall do RASP em dataset rotulado e overhead de ingestão. O motor de alertas não cria uma notificação por log: agrega a janela e suprime rajadas em cooldown (50% de supressão na execução de referência). O código inclui testes automatizados, CI e dashboard com drill-down por trace.

**Palavras-chave:** observabilidade; OpenTelemetry; RASP; fadiga de alertas; APM; self-hosted.

---

## 1 Introdução

### 1.1 Contextualização

Observabilidade é a capacidade de inferir o estado interno de um sistema a partir de saídas externas — classicamente logs, métricas e traces (PILLAR, THREE; CNCF). No mercado, plataformas SaaS (Datadog, New Relic, Dynatrace) cobram por host, GB ou span. Para uma PME que precisa manter dados em infraestrutura própria, a alternativa típica é montar Jaeger + Prometheus + Grafana + Uptime Kuma + um WAF. Cada peça resolve um recorte; nenhuma entrega, no mesmo identificador, a história “esta requisição foi lenta, bloqueada como bot e gerou um alerta”.

### 1.2 Problema de pesquisa

Como reduzir o ruído de alertas e correlacionar telemetria de desempenho com eventos de proteção em runtime, em uma plataforma self-hosted adequada a PMEs, sem exigir um coletor OpenTelemetry completo?

### 1.3 Objetivos

**Objetivo geral:** projetar e avaliar uma plataforma unificada de observabilidade e proteção em runtime para aplicações Node.js.

**Objetivos específicos:**

1. Instrumentar traces com AsyncLocalStorage e cabeçalho W3C `traceparent`.
2. Persistir telemetria de forma assíncrona (HTTP → RabbitMQ → PostgreSQL) e exibi-la em tempo real.
3. Mitigar fadiga de alertas com regras, janela deslizante e cooldown, medindo taxa de supressão.
4. Detectar e, opcionalmente, bloquear scrapers no próprio processo da aplicação (RASP), correlacionando o evento ao `traceId`.
5. Avaliar o artefato com experimentos reproduzíveis de fadiga, classificação RASP e overhead.

### 1.4 Justificativa

A literatura de SRE trata fadiga de alertas como risco operacional: excesso de notificações leva o operador a ignorá-las (Google SRE). RASP comercial (Imperva, Contrast) opera dentro do processo e vê o que um WAF na borda não vê. Unir os dois recortes em um agente leve é relevante para PMEs e é demonstrável em banca: um clique no dashboard mostra APM e bloqueio no mesmo identificador.

### 1.5 Delimitação

O trabalho não substitui um backend OpenTelemetry (SigNoz, Jaeger, Grafana Tempo). Não implementa multi-tenant, Kubernetes operator nem inspeção de SQL no driver. O RASP desta PoC é de **borda comportamental** (taxa, User-Agent, varredura, headers), não um motor LANGSEC contra OWASP Top 10 completo.

---

## 2 Fundamentação teórica

### 2.1 Observabilidade e tracing distribuído

Um **trace** agrupa **spans** de uma requisição através de serviços. O padrão W3C Trace Context define o cabeçalho `traceparent` no formato `00-{trace-id}-{parent-id}-{flags}` (W3C, 2021). OpenTelemetry (OTel) tornou-se o padrão de fato de instrumentação em 2024–2026: SDKs emitem OTLP; o backend é pluggable (JAEGER; SIGNOZ; TEMPO).

O Node.js oferece `AsyncLocalStorage` sobre `async_hooks`, a mesma família de APIs usada pelo OTel JS para propagar contexto sem passar o objeto manualmente em cada callback.

### 2.2 Fadiga de alertas

Alertar cada evento `level=error` produz N notificações para N logs. Práticas de SRE recomendam alertar sintomas (taxa de erro, SLO) com cooldown, agrupamento e severidade (BHANAGE; GOOGLE SRE). A métrica deste trabalho é a **taxa de supressão**: fração de disparos persistidos com `suppressed=true` após o cooldown.

### 2.3 RASP versus WAF

WAF inspeciona o tráfego HTTP na borda. RASP executa no processo da aplicação e pode bloquear com contexto de runtime (IMPERVA). Avaliações acadêmicas de ferramentas de proteção usam matriz de confusão — precisão, recall, F1 e índice de Youden (TPR − FPR), o mesmo espírito do OWASP Benchmark (OWASP). Este TCC aplica essas métricas a um dataset rotulado de scraping, não ao Benchmark Java completo — limitação declarada.

### 2.4 Arquitetura de ingestão

Filas (RabbitMQ) desacoplam aceite HTTP (202 Accepted) da persistência. Views materializadas aceleram agregações. WebSocket reduz latência do dashboard em relação a polling. Redis pub/sub sincroniza múltiplas réplicas do hub em tempo real.

---

## 3 Trabalhos relacionados

| Sistema | O que cobre | O que não cobre no recorte TraceGuard |
|---|---|---|
| **SigNoz** | APM OTel-native, logs, métricas, self-hosted | Sem RASP no agente da aplicação; stack ClickHouse mais pesada |
| **Jaeger** | Tracing CNCF | Sem logs, alertas de negócio, uptime ou RASP |
| **Grafana LGTM** | Logs, métricas, traces | Operação de três backends; sem proteção in-process |
| **Sentry** | Erros, performance, releases | Foco em exceções; RASP e uptime não são o núcleo |
| **Uptime Kuma** | Probes HTTP | Sem APM nem correlação com traces |
| **ModSecurity / CrowdSec** | WAF / reputação de IP | Fora do processo; sem `traceId` da aplicação |
| **Datadog / New Relic** | Tudo, SaaS | Custo e residência de dados |

**Posicionamento:** o TraceGuard não compete em escala com SigNoz. Compete no recorte “um `docker compose`, um SDK, um dashboard, correlação APM+RASP+alerta”. Essa frase deve aparecer na arguição.

---

## 4 Metodologia

Adota-se **Design Science Research** (PEFFERS et al.): identificar o problema, projetar o artefato, demonstrar, avaliar e comunicar.

1. **Artefato:** monorepo TypeScript (`@traceguard/sdk`, backend Fastify, dashboard Next.js).
2. **Decisões:** registradas em ADRs (`docs/adr/`).
3. **Avaliação:** três experimentos controlados (Seção 6), testes unitários (`pnpm test`) e demonstração no dashboard.
4. **Reprodutibilidade:** scripts em `scripts/experiments/` e `k6` em `scripts/load-test/`.

Não houve estudo com usuários reais de PME; a validade é de laboratório. Isso é uma limitação, não um defeito escondido.

---

## 5 O artefato

### 5.1 Arquitetura

```
Aplicação + SDK  --POST /api/v1/ingest-->  Fastify  --> RabbitMQ
                                              |              |
                                         API key opcional    v
                                         WebSocket      consumer --> PostgreSQL
                                              ^              |
                                              +-- EventHub --+
Dashboard Next.js <---------------------------+
RASP middleware --POST /ingest/rasp----------> Fastify (mesmo traceId)
Uptime probes (job) -------------------------> alertas + webhook
```

### 5.2 SDK

- `AsyncLocalStorage` para `traceId`/`spanId`.
- `continueOrCreateContext` lê `traceparent` (W3C) ou `X-Trace-Id`.
- Requisições HTTP de saída geram **span filho** (`createChildContext`) e reinjetam `traceparent`.
- RASP: score somado (`bot_user_agent` 50, `missing_headers` 20, `rate_limit` 40, `sequential_scan` 60). Bloqueio se `score >= 70` no modo `block`.
- Whitelist de crawlers (Googlebot, Bingbot, etc.), porque o padrão `bot` no UA pegaria o Googlebot.

### 5.3 Alertas

Tipos: `error_rate`, `error_count`, `error_burst`, `rasp_threat_count`, `uptime_down`. Cooldown por `ruleId:service`. Métrica `suppressionRate` em 0–100 na API.

### 5.4 Segurança da API

`API_KEY` opcional. Sem chave (dev), a API permanece aberta. Com chave, ingest, leitura e WebSocket exigem `x-api-key` ou `?token=`. O dashboard envia `NEXT_PUBLIC_API_KEY` e pode exigir senha (`NEXT_PUBLIC_DASHBOARD_PASSWORD`).

---

## 6 Experimentos e resultados

Protocolo detalhado e números da execução de referência: [`resultados-experimentos.md`](./resultados-experimentos.md).

### 6.1 Fadiga de alertas

**Hipótese:** uma rajada de erros não gera uma notificação por evento; uma segunda rajada em cooldown é suprimida.

**Resultado de referência:** 100 erros → 3 alertas acionáveis (uma por regra padrão). +50 erros → 3 suprimidos. Taxa 50%. Baseline naive: 150 notificações.

### 6.2 Classificação RASP

**Hipótese:** scrapers com UA conhecido em rotas `/api/*` são bloqueados; browser, healthcheck e Googlebot não.

**Métricas:** precisão, recall, F1, Youden — `computeClassificationMetrics` testado em `packages/shared`.

### 6.3 Overhead

**Hipótese:** o p95 do ingest fica abaixo de 500 ms em máquina de desenvolvimento, alinhado ao threshold do k6.

---

## 7 Discussão

O diferencial não é “mais um dashboard”. É a **correlação demonstrável** e a métrica de fadiga. Chamar o módulo de RASP exige honestidade: é proteção contra scraping, não substituto de WAF contra injeção. A banca que ler `fingerprints.ts` verá heurísticas simples — o texto já admite isso e mede FP/FN em vez de vender ML.

O monitor de event loop usa `monitorEventLoopDelay` (não GC). Spans filhos existem nas saídas HTTP. Testes cobrem o núcleo que a arguição pode abrir no projetor.

---

## 8 Limitações e trabalhos futuros

- RASP só no Express; Fastify no SDK fica como futuro.
- Cooldown e EventHub sem Redis perdem estado no restart / multi-réplica (Redis é opcional).
- Sem export OTLP: lock-in no backend TraceGuard.
- Sem estudo de campo com operadores de PME.
- Auth de dashboard com `NEXT_PUBLIC_*` expõe a chave no browser — aceitável na PoC, insuficiente para produção.

Futuro: exporter OTLP, retenção TTL, dead-letter no RabbitMQ, adapter Fastify, dataset RASP maior.

---

## 9 Conclusão

O TraceGuard responde à pergunta de pesquisa com um artefato executável: agente Node.js, pipeline assíncrono, dashboard em tempo real, motor de fadiga e RASP correlacionado. Os experimentos mostram que o sistema **não** alerta um-para-um e que as heurísticas de scraping são mensuráveis. O trabalho é de engenharia de software com avaliação empírica de laboratório — adequado a TCC, desde que a monografia (este texto) e a demo de oito minutos sejam o centro da defesa, não a quantidade de abas.

---

## Referências

BHANAGE, D. et al. Literature on alert fatigue in operations. *ACM / IEEE surveys* (citar o paper efetivamente usado na biblioteca da sua instituição).

CNCF. *Cloud Native Observability Whitepaper*. Cloud Native Computing Foundation.

GOOGLE. *Site Reliability Engineering*. O'Reilly, 2016. Capítulos sobre alerting.

IMPERVA. *A Guide to Runtime Application Self-Protection (RASP)*. White paper.

OPENTELEMETRY. *Documentation*. https://opentelemetry.io

OWASP. *OWASP Benchmark*. https://owasp.org/www-project-benchmark/

PEFFERS, K. et al. A Design Science Research Methodology for Information Systems Research. *Journal of Management Information Systems*, 2007.

SIGNOZ. *SigNoz — Open source observability*. https://signoz.io

W3C. *Trace Context*. W3C Recommendation, 2021. https://www.w3.org/TR/trace-context/

W3C / JAEGER. *Jaeger: open source distributed tracing*. https://www.jaegertracing.io

*Complete as referências com ABNT NBR 6023 na biblioteca da instituição. Não entregue esta lista crua na versão final — ajuste autores, datas e acesso.*
