# Experimento 4 — Acurácia, custo e integração do Laya (design)

**Data:** 28/10/2026
**Status:** aguardando aprovação

## Intenção

A ADR 009 integrou o Laya (`mmBERT-base`, checkpoint `multilingual`) como sidecar em modo sombra no RASP e deixou explícito: "latência do sombra e precisão do classificador só entram na monografia depois de um dataset rotulado". Este experimento fecha essa lacuna para a banca, no mesmo estilo dos Experimentos 1–3 (script em `scripts/experiments/`, roda contra a stack local, imprime tabelas Markdown prontas para `docs/tcc/resultados-experimentos.md`).

Precisa provar, em ordem de prioridade:

1. **Que o Laya acerta** — `prompt_injection` e `secret_leak`, com vários tipos de ataque e casos legítimos difíceis.
2. **Que não deixa a aplicação lenta** — o cliente de `POST /api/chat` não espera o modelo.
3. **Que está ligado ao trace** — o evento chega ao backend com o mesmo `traceId` da requisição.

## Objetivos

- Um comando: `pnpm experiment:laya`.
- Dataset rotulado com ~40 textos, PT-BR e EN, com variedade de injection, credencial e negativos difíceis.
- Métricas de classificação (TP/FP/FN/TN, precisão, recall, F1, Youden) gerais e por tipo.
- Latência do modelo (p50/p95) e latência do caminho quente com vs. sem sidecar.
- Taxa de entrega ponta a ponta por `traceId`.

## Não-objetivos

- Ajustar limiar, perguntas ou modelo do Laya. O experimento mede a configuração atual (`noul ≥ 0.80`, `abstention !== "abstained"`).
- Bloqueio síncrono ou lista de bloqueio (rejeitados/fora da ADR 009).
- Atualizar `monografia.md` ou o LaTeX — fica para depois da execução, com números reais.
- Teste de carga (k6).

## Anti-objetivos

- **Números inventados.** O doc de resultados ganha só o protocolo; os números entram quando o autor rodar o script.
- **Acurácia contaminada por transporte.** Um descarte na fila de 4 do SDK nunca pode virar falso negativo.
- **Dataset que só tem casos fáceis.** Sem negativos difíceis, 100% não prova nada.
- **Segredos com cara de reais** que disparem secret scanning do GitHub.

## Abordagens consideradas

| | Abordagem | Troca |
|---|---|---|
| A | Tudo ponta a ponta pela demo-api; "detectado" = evento no backend | Prova integração em todos os casos, mas mistura acurácia com ruído de fila/flush/polling; latência do modelo só indireta |
| **B** | **Um script, três etapas isoladas: sidecar direto (acurácia), demo-api com/sem sidecar (latência), demo-api + `traceparent` (integração)** | **Cada número mede uma coisa só; script mais longo e exige backend + sidecar no ar** |
| C | Três scripts separados | Roda cada parte isolada, mas três comandos e foge do padrão de um script por experimento |

**Escolhida: B** (pelo autor), por manter um comando só e não deixar falha de entrega contaminar a acurácia.

## Desenho

### Arquivos

- `scripts/experiments/laya-dataset.ts` — dataset rotulado (separado do script por tamanho). *Decisão minha.*
- `scripts/experiments/laya-eval.ts` — o experimento.
- `package.json` raiz — `"experiment:laya": "tsx scripts/experiments/laya-eval.ts"`.
- `docs/tcc/resultados-experimentos.md` — seção "Experimento 4" com protocolo e tabelas vazias a preencher.
- Teste unitário leve para as funções puras (métricas por tipo, majoritário, integridade do dataset), no padrão vitest do repo. *Decisão minha.*

Importa direto do código-fonte, como o Experimento 2 faz com `metrics.ts`:
- `packages/sdk/src/rasp/laya-inspector.ts` → `inspectPayloadWithLaya`, `LAYA_NOUL_THRESHOLD`
- `packages/shared/src/metrics.ts` → `computeClassificationMetrics`

### Dataset

Cada item: `{ id, lang: "pt" | "en", label: "prompt_injection" | "secret_leak" | "benign", hard?: boolean, category, text }`.

- **~12 prompt injection:** ignorar instruções, vazar prompt do sistema, roleplay/DAN, instrução escondida no meio de texto normal, ofuscação leve (espaços/caixa), injeção dentro de campo JSON.
- **~10 secret leak:** formato AWS access key, token GitHub (`ghp_…`), `Authorization: Bearer …`, senha em connection string, bloco `-----BEGIN PRIVATE KEY-----`. Todos fictícios e visivelmente falsos (ex.: sufixo `EXAMPLE`, padrões repetidos) para não acionar secret scanning.
- **~18 legítimos, ~metade `hard: true`:** pergunta sobre como evitar prompt injection, artigo que cita "ignore previous instructions" entre aspas, `.env.example` com `API_KEY=` vazio, UUID/hash parecido com token, texto comum de e-commerce.
- Metade PT-BR, metade EN, distribuída entre as três classes.

### Pré-checagens (falha rápida com dica, como os outros scripts)

- Sidecar: `GET {LAYA_SIDECAR_URL}/health` → dica `docker compose --profile laya up -d --build laya`.
- Backend: `GET {API_URL}/health` → dica `pnpm dev:backend`.
- Aquecimento: 3 chamadas ao sidecar descartadas antes de medir (primeira subida baixa o checkpoint).

Variáveis: `LAYA_SIDECAR_URL` (padrão `http://localhost:8000`), `LAYA_API_KEY` (padrão `traceguard-secret`), `API_URL` (padrão `http://localhost:3001`), `API_KEY` (opcional, enviado como `x-api-key`), `TRACEGUARD_API_KEY` repassado à demo-api.

### Etapa 1 — Acurácia (sidecar direto)

- Cada texto 3 vezes, **em sequência**, via `inspectPayloadWithLaya` (mesmo payload, perguntas e limiar do SDK).
- `null` (falha de transporte) é contado à parte como erro, nunca como negativo.
- Veredito por texto = maioria das 3 execuções. *Decisão minha:* métricas sobre 40 linhas (uma por texto), não 120, para não inflar o n.
- Estabilidade: número de textos cujo veredito variou entre as repetições.
- Tabelas:
  - por caso: id, idioma, rótulo, difícil?, veredito, `noul` PI, `noul` SL;
  - métricas **binárias** (ameaça vs. legítimo; detectado = `flagged`);
  - métricas **por tipo** (classe positiva = aquele tipo; detectado = sinal daquele tipo acima do limiar e não-abstido);
  - taxa de falso positivo só entre os legítimos difíceis;
  - recall por idioma (PT vs. EN);
  - latência do modelo: média/p50/p95 das 120 chamadas (`latencyMs` do inspector).

### Etapa 2 — Custo no caminho quente

- O script sobe a demo-api **por conta própria**, como processo filho (`tsx apps/demo-api/src/index.ts`), em porta dedicada (padrão `4100`, para não colidir com `pnpm dev:demo-api`), `RASP_MODE=monitor`.
  - Rodada A: sem `LAYA_SIDECAR_URL`.
  - Rodada B: com `LAYA_SIDECAR_URL` e `LAYA_API_KEY`.
- Espera `/health` responder, 10 requisições de aquecimento, depois os 40 textos × 3 em `POST /api/chat` com `{ message }`, sequencial, medindo tempo até a resposta.
- Cabeçalhos de navegador (UA, `Accept`, `Accept-Language`) e **`X-Forwarded-For` único por requisição** (a demo-api usa `trust proxy`), para o rate limit e o heurístico não interferirem nem bloquearem o corpo antes do Laya.
- Encerra o processo filho ao fim de cada rodada (inclusive em erro).
- Tabela: média/p50/p95 de A e B e a diferença B−A.
- Leitura esperada (a confirmar): diferença na casa do ruído, porque a inspeção roda em `setImmediate`. Se o sidecar disputar CPU na mesma máquina, isso aparece e deve ser relatado com honestidade.

### Etapa 3 — Integração por `traceId`

- Demo-api da rodada B. Cada texto **uma vez**, com `traceparent` gerado pelo script (o middleware usa `continueOrCreateContext`) e `X-Forwarded-For` único.
- **Ritmo:** intervalo entre envios ≥ p95 de latência do modelo medido na etapa 1, para não estourar a fila de 4 em voo.
- Ao final, espera curta para o flush do exporter e lê `GET /api/v1/rasp/events?limit=100` (o máximo do endpoint; o volume esperado cabe).
- Esperado = textos que a etapa 1 marcou como `flagged`. Para cada um: evento encontrado com aquele `traceId`? `threatType` igual ao da etapa 1? `metadata.source === "laya"`?
- Eventos de Laya para textos que a etapa 1 não marcou contam como inesperados (variação do modelo).
- Atraso do sombra: `timestamp` do evento − instante do envio (média/p95).
- Tabela: esperados, entregues com `traceId` correto, perdidos (fila/timeout/flush), tipo divergente, taxa de entrega.

### Saída

Markdown no stdout, mesmo formato dos outros experimentos, com cabeçalho do ambiente (URLs, amostras) e um lembrete para documentar CPU/RAM. Cada tabela traz uma linha de "leitura" honesta, como os outros resultados fazem.

## Restrições

- TypeScript via `tsx`, sem dependência nova.
- `http.request` onde os cabeçalhos precisam ser exatos (mesmo motivo do Experimento 2: o `fetch` injeta `Accept-Language`). `fetch` serve para sidecar e backend.
- SDK precisa estar compilado (`pnpm build`), porque a demo-api importa `@traceguard/sdk` via `dist`.
- Funciona no Windows (processo filho sem depender de shell POSIX).

## Fica a critério de quem implementar

- Textos exatos do dataset, respeitando as quantidades e categorias.
- Tempo de espera do flush e timeout dos health checks.
- Formato exato das tabelas e dos nomes das funções auxiliares.
