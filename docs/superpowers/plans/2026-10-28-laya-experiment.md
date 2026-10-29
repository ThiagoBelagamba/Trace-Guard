# Experimento 4 — Laya (acurácia, custo e integração) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `pnpm experiment:laya`, que mede a acurácia do Laya num dataset rotulado, o custo no caminho quente da demo-api com e sem sidecar e a entrega ponta a ponta por `traceId`.

**Architecture:** Três arquivos em `scripts/experiments/`: o dataset rotulado (`laya-dataset.ts`), as funções puras de cálculo (`laya-stats.ts`, coberto por Vitest) e o script de E/S (`laya-eval.ts`). O script chama o sidecar direto com `inspectPayloadWithLaya` do SDK (etapa 1), sobe a demo-api duas vezes como processo filho (etapa 2) e confere os eventos no backend pelo `traceparent` que ele mesmo gera (etapa 3).

**Tech Stack:** TypeScript, `tsx` 4, Vitest 3.2, Node ≥ 20 (`node:http`, `node:child_process`, `node:crypto`).

**Spec:** `docs/superpowers/specs/2026-10-28-laya-experiment-design.md`

## Global Constraints

- Branch nova `feature/laya-experiment` a partir de `main`.
- Nenhuma dependência npm nova.
- Mesmo limiar e perguntas do SDK: importar de `packages/sdk/src/rasp/laya-inspector.ts`. Nada de duplicar `0.8` ou as `QUESTIONS`.
- Importações por caminho de fonte com extensão `.ts`, como faz `rasp-eval.ts` (`../../packages/shared/src/metrics.ts`).
- `http.request` (não `fetch`) para chamadas à demo-api; `fetch` para sidecar e backend.
- Credenciais do dataset fictícias; todo texto `secret_leak` contém `EXAMPLE` (sem diferenciar maiúsculas).
- Funcionar no Windows: processo filho via `process.execPath` + `--import tsx`, sem `shell: true`.
- Saída em Markdown no stdout, copy em pt-BR, no formato dos experimentos 1–3.
- Nenhum número inventado em `resultados-experimentos.md`; só protocolo e tabelas com `—`.
- Commits em inglês, Conventional Commits, **sem** linhas de atribuição (padrão do histórico do repo).
- Defaults: `LAYA_SIDECAR_URL=http://localhost:8000`, `LAYA_API_KEY=traceguard-secret`, `API_URL=http://localhost:3001`, `EXPERIMENT_DEMO_PORT=4100`, `REPS=3`, 3 aquecimentos no sidecar, 10 aquecimentos na demo-api.

## Review Focus

- Sidecar devolve `null` (timeout/HTTP ≠ 2xx) em todas as repetições de um texto → o texto vira erro de transporte, fica fora das métricas e aparece numa contagem própria; nunca conta como FN → teste `majorityVerdict` com tudo `null` e `buildAccuracyReport` com veredito `null` (Task 2).
- Só 2 execuções válidas que discordam (1×1) → não marcado e instável → teste de empate (Task 2).
- Lista do backend traz eventos de outros traces (etapa 2, outras execuções) ou evento heurístico no mesmo `traceId` → ignorados → teste `matchDeliveries` com evento estranho e com `metadata.source` diferente de `"laya"` (Task 2).
- Porta 4100 ocupada ou SDK sem build → a demo-api não responde `/health` → o script mata o filho, sai com código 1 e dica `pnpm build` / `EXPERIMENT_DEMO_PORT` → verificação manual (Task 4).
- Erro no meio da etapa 2/3 → processo filho não fica órfão → `stop()` em `finally`, verificação manual (Task 4).

---

### Task 1: Branch, spec e dataset rotulado

**Files:**
- Create: `scripts/experiments/laya-dataset.ts`
- Test: `scripts/experiments/laya-dataset.test.ts`
- Commit também: `docs/superpowers/specs/2026-10-28-laya-experiment-design.md`, este plano

**Interfaces:**
- Produces:
  ```ts
  export type LayaLabel = "prompt_injection" | "secret_leak" | "benign";
  export interface LayaCase {
    id: string;            // kebab-case único, ex.: "pi-ignore-pt"
    lang: "pt" | "en";
    label: LayaLabel;
    hard: boolean;         // true só em benignos difíceis
    category: string;      // ex.: "ignore_instructions", "aws_key", "security_question"
    text: string;
  }
  export const LAYA_DATASET: readonly LayaCase[];
  ```

- [ ] **Step 1: Criar branch** — `git checkout -b feature/laya-experiment`.

- [ ] **Step 2: Escrever o teste de integridade** `laya-dataset.test.ts` (`describe("LAYA_DATASET")`):
  - `has 12 prompt injection, 10 secret leak and 18 benign cases` — contagens exatas.
  - `marks at least 9 benign cases as hard and no threat as hard`.
  - `uses unique ids`.
  - `splits languages close to half` — `pt` entre 18 e 22; cada label tem pelo menos um `pt` e um `en`.
  - `covers at least 6 injection categories and 5 secret categories` — `new Set(category).size`.
  - `keeps every secret_leak text marked as EXAMPLE` — `/example/i.test(text)`.
  - `keeps every text within LAYA_MAX_PAYLOAD_CHARS` — importar de `../../packages/sdk/src/rasp/laya-shadow.ts`; também `text.trim().length > 0`.

- [ ] **Step 3: Rodar e ver falhar** — `pnpm vitest run scripts/experiments/laya-dataset.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 4: Escrever `laya-dataset.ts`** com os 40 casos da spec:
  - Injection (categorias mínimas): `ignore_instructions`, `system_prompt_leak`, `roleplay_dan`, `hidden_in_text`, `obfuscated` (espaços/caixa alternada), `json_field`.
  - Credencial (categorias mínimas): `aws_key` (`AKIAIOSFODNN7EXAMPLE`), `github_token` (`ghp_` + `EXAMPLE…`), `bearer_header`, `connection_string_password`, `private_key_block`.
  - Benignos difíceis: `security_question`, `quoted_attack_article`, `env_example_empty`, `uuid_or_hash`, mais variações. Benignos fáceis: texto de e-commerce/atendimento.

- [ ] **Step 5: Rodar e ver passar** — mesmo comando → PASS (7 testes).

- [ ] **Step 6: Commit**
  ```bash
  git add docs/superpowers/specs/2026-10-28-laya-experiment-design.md docs/superpowers/plans/2026-10-28-laya-experiment.md scripts/experiments/laya-dataset.ts scripts/experiments/laya-dataset.test.ts
  git commit -m "test(experiments): add labeled laya dataset"
  ```

---

### Task 2: Funções puras de cálculo

**Files:**
- Modify: `packages/sdk/src/rasp/laya-inspector.ts` — trocar `function isHit` por `export function isHit` (sem mudar o corpo)
- Create: `scripts/experiments/laya-stats.ts`
- Test: `scripts/experiments/laya-stats.test.ts`

**Interfaces:**
- Consumes: `LayaCase` (Task 1); `LayaInspectionResult`, `isHit` (inspector); `ClassificationMetrics`, `computeClassificationMetrics` (`packages/shared/src/metrics.ts`); `RaspEvent` (`packages/shared/src/rasp.ts`).
- Produces:
  ```ts
  export interface LatencySummary { avg: number; p50: number; p95: number }
  export function summarizeLatency(samples: number[]): LatencySummary; // vazio → zeros; percentil = ceil(p/100*n)-1 (igual a overhead.ts)

  export interface CaseVerdict {
    flagged: boolean; piHit: boolean; slHit: boolean;
    threatType?: "prompt_injection" | "secret_leak";
    piNoul: number | null; slNoul: number | null; // mediana das execuções válidas
    validRuns: number; stable: boolean;
  }
  export function majorityVerdict(runs: (LayaInspectionResult | null)[]): CaseVerdict | null;

  export interface AccuracyReport {
    evaluated: number; transportErrors: number;
    binary: ClassificationMetrics;
    promptInjection: ClassificationMetrics;
    secretLeak: ClassificationMetrics;
    hardBenign: { total: number; falsePositives: number };
    recallByLang: { pt: number; en: number };
    unstable: number;
  }
  export function buildAccuracyReport(rows: { item: LayaCase; verdict: CaseVerdict | null }[]): AccuracyReport;

  export interface SentCase { caseId: string; traceId: string; sentAt: number; expectedThreatType?: "prompt_injection" | "secret_leak" }
  export interface DeliveryReport {
    expected: number; delivered: number; lost: number;
    typeMismatch: number; unexpected: number;
    deliveryRate: number; delaysMs: number[];
  }
  export function matchDeliveries(sent: SentCase[], events: RaspEvent[]): DeliveryReport;
  ```

Regras que os testes fixam:
- `majorityVerdict`: ignora `null`; 0 válidas → `null`. `flagged`/`piHit`/`slHit` = contagem **>** metade das válidas (empate → `false`). `piHit`/`slHit` por execução = `isHit(run.signals.x)`. `threatType` = entre os hits majoritários, o de maior mediana de `noul`. `stable` = todas as válidas concordam em `flagged`.
- `buildAccuracyReport`: linhas com `verdict === null` só somam em `transportErrors`. Binário: `expectedThreat = label !== "benign"`, `detected = flagged`. Por tipo: classe positiva = aquele label, `detected = piHit` / `slHit`, sobre todas as linhas avaliadas. `recallByLang`: ameaças daquele idioma marcadas `flagged` ÷ ameaças daquele idioma (0 se não houver). `hardBenign.falsePositives` = benignos `hard` com `flagged`.
- `matchDeliveries`: considera só eventos com `metadata?.source === "laya"` e `traceId` presente em `sent`. Esperado = `sent` com `expectedThreatType`. Entregue = esperado com evento do mesmo `traceId` (o primeiro). `typeMismatch` = entregues cujo `threatType` difere. `unexpected` = eventos de `sent` sem `expectedThreatType`. `lost = expected - delivered`. `deliveryRate = delivered / expected` (0 se `expected` = 0). `delaysMs` = `Date.parse(event.timestamp) - sentAt`, por entregue.

- [ ] **Step 1: Escrever os testes** `laya-stats.test.ts`. Use um helper `run(pi: number, sl: number, abstained = false)` que monta um `LayaInspectionResult` (`flagged` = algum `noul ≥ 0.8`, `latencyMs: 10`).
  - `summarizeLatency`: `[5,1,3,2,4]` → `{ avg: 3, p50: 3, p95: 5 }`; `[]` → `{ avg: 0, p50: 0, p95: 0 }`.
  - `majorityVerdict([null, null, null])` → `null`.
  - `majorityVerdict([run(0.9,0.1), run(0.85,0.1), run(0.2,0.1)])` → `flagged: true, piHit: true, slHit: false, threatType: "prompt_injection", piNoul: 0.85, validRuns: 3, stable: false`.
  - empate: `majorityVerdict([run(0.9,0), null, run(0.1,0)])` → `flagged: false, stable: false, validRuns: 2`.
  - abstenção: `majorityVerdict([run(0.95,0,true) ×3])` → `piHit: false` (vem de `isHit`).
  - dois hits: `run(0.82, 0.97)` ×3 → `threatType: "secret_leak"`.
  - `buildAccuracyReport` com 5 linhas (PI pt detectado, SL en não detectado, benigno hard detectado, benigno fácil não detectado, uma com `verdict: null`) → `evaluated: 4, transportErrors: 1`, `binary.tp 1 / fn 1 / fp 1 / tn 1`, `hardBenign { total: 1, falsePositives: 1 }`, `recallByLang { pt: 1, en: 0 }`.
  - `matchDeliveries`: 3 enviados (A esperado PI, B esperado SL, C sem expectativa), eventos = A laya PI (+250 ms), B laya PI, C laya, um laya com traceId estranho, um heurístico (`source` ausente) no traceId de B → `expected 2, delivered 2, typeMismatch 1, unexpected 1, lost 0, deliveryRate 1, delaysMs[0] = 250`.
  - `matchDeliveries([], [])` → `deliveryRate: 0`.

- [ ] **Step 2: Rodar e ver falhar** — `pnpm vitest run scripts/experiments/laya-stats.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Exportar `isHit` e implementar `laya-stats.ts`** conforme as interfaces e regras acima.

- [ ] **Step 4: Rodar e ver passar** — `pnpm vitest run scripts/experiments/laya-stats.test.ts packages/sdk` → PASS (inclui os testes existentes do inspector).

- [ ] **Step 5: Commit**
  ```bash
  git add packages/sdk/src/rasp/laya-inspector.ts scripts/experiments/laya-stats.ts scripts/experiments/laya-stats.test.ts
  git commit -m "feat(experiments): add laya accuracy, latency and delivery metrics"
  ```

---

### Task 3: Script — pré-checagens e etapa 1 (acurácia)

**Files:**
- Create: `scripts/experiments/laya-eval.ts`
- Modify: `package.json` (raiz) — `"experiment:laya": "tsx scripts/experiments/laya-eval.ts"` logo após `experiment:overhead`

**Interfaces:**
- Consumes: `LAYA_DATASET` (Task 1); `summarizeLatency`, `majorityVerdict`, `buildAccuracyReport` (Task 2); `inspectPayloadWithLaya`, `LAYA_NOUL_THRESHOLD`.
- Produces (internas ao arquivo, usadas pela Task 4):
  ```ts
  async function assertReachable(url: string, hint: string): Promise<void>; // igual a overhead.ts
  async function runAccuracyStage(): Promise<{ verdicts: Map<string, CaseVerdict | null>; modelLatency: LatencySummary }>;
  function printMetricsTable(title: string, m: ClassificationMetrics): void;
  ```

- [ ] **Step 1: Cabeçalho do arquivo** — bloco de comentário no estilo dos outros (`Experimento 4 — Laya…`, requisitos, `Uso: pnpm experiment:laya`); leitura das variáveis com os defaults das Global Constraints.

- [ ] **Step 2: Pré-checagens** em `main()`: `assertReachable(`${LAYA}/health`, "Suba o sidecar com: docker compose --profile laya up -d --build laya")` e `assertReachable(`${API_URL}/health`, "Suba o backend com: pnpm dev:backend")`. Depois 3 chamadas de aquecimento a `inspectPayloadWithLaya` descartadas; se todas devolverem `null`, abortar com "sidecar respondeu /health mas /v1/systemone falhou — confira LAYA_API_KEY".

- [ ] **Step 3: `runAccuracyStage`** — para cada caso, `REPS` chamadas sequenciais; `majorityVerdict` por caso; latências = `latencyMs` das execuções não-nulas.

- [ ] **Step 4: Impressão da etapa 1**:
  - `## Experimento 4 — Laya (sidecar em modo sombra)` + ambiente (URLs, `REPS`, limiar `LAYA_NOUL_THRESHOLD`, n de casos).
  - `### 4.1 Acurácia` — tabela por caso: `| Caso | Idioma | Rótulo | Difícil | Veredito | noul PI | noul SL |` (noul com 2 casas, `—` se null; veredito `prompt_injection` / `secret_leak` / `legítimo` / `erro`).
  - `printMetricsTable` para Binário, `prompt_injection` e `secret_leak` (mesmas linhas TP/FP/FN/TN/Precisão/Recall/F1/Youden com 3 casas do Experimento 2).
  - Linha: falsos positivos em difíceis `x/y`, recall PT e EN, textos instáveis, erros de transporte.
  - `### 4.2 Latência do modelo` — `| Alvo | média (ms) | p50 (ms) | p95 (ms) |` com a linha `Laya /v1/systemone`.

- [ ] **Step 5: Verificar sem sidecar** — com nada em `:8000`, `pnpm experiment:laya` → sai com código 1 e a mensagem com `docker compose --profile laya up -d --build laya`.

- [ ] **Step 6: Verificar com sidecar** (se o Docker estiver disponível): `docker compose --profile laya up -d --build laya`, `pnpm dev:backend`, depois `pnpm experiment:laya` → imprime as tabelas 4.1 e 4.2 com 40 linhas de caso. Se o Docker não estiver disponível, registrar isso no relatório da task.

- [ ] **Step 7: Commit**
  ```bash
  git add scripts/experiments/laya-eval.ts package.json
  git commit -m "feat(experiments): measure laya accuracy against the sidecar"
  ```

---

### Task 4: Etapas 2 e 3 e documentação de resultados

**Files:**
- Modify: `scripts/experiments/laya-eval.ts`
- Modify: `docs/tcc/resultados-experimentos.md` — nova seção ao final

**Interfaces:**
- Consumes: `runAccuracyStage` (Task 3); `summarizeLatency`, `matchDeliveries`, `SentCase` (Task 2); `RaspEvent`.
- Produces (internas):
  ```ts
  async function startDemoApi(withLaya: boolean): Promise<{ stop(): Promise<void> }>;
  function postChat(message: string, opts: { traceparent?: string }): Promise<{ status: number; ms: number }>;
  function newTraceparent(): { traceId: string; header: string }; // "00-<32 hex>-<16 hex>-01" via randomBytes
  ```

- [ ] **Step 1: `startDemoApi`** — `spawn(process.execPath, ["--import", "tsx", "apps/demo-api/src/index.ts"], { cwd: raiz do repo, env })`. O `env` herda `process.env` e define `PORT=EXPERIMENT_DEMO_PORT` e `RASP_MODE=monitor`. Com `withLaya`, define `LAYA_SIDECAR_URL` e `LAYA_API_KEY`; sem `withLaya`, **apaga** as duas do env do filho. Repassa `TRACEGUARD_API_KEY` se existir. Faz polling de `/health` a cada 250 ms por até 30 s. Em timeout: mata o filho e lança erro com a dica "rode pnpm build (a demo-api usa o dist do SDK) ou troque EXPERIMENT_DEMO_PORT". `stop()` mata o filho e espera o evento `exit`. stdout/stderr do filho são descartados, exceto stderr quando ele sai antes do health.

- [ ] **Step 2: `postChat`** — `http.request` `POST /api/chat`, corpo `{ message }`, cabeçalhos: UA Chrome do Experimento 2, `Accept: application/json`, `Accept-Language: pt-BR,pt;q=0.9`, `Content-Type: application/json` e `X-Forwarded-For` único por chamada (contador → `10.<a>.<b>.<c>`). Mais `traceparent` quando vier. Mede de antes do `request` até o `end` da resposta. Status ≠ 200 lança erro.

- [ ] **Step 3: Etapa 2** — rodada A (`withLaya=false`), depois rodada B (`true`). Cada uma com 10 aquecimentos e os 40 textos × `REPS`, em sequência. `stop()` em `finally`. Imprime `### 4.3 Custo no caminho quente` com as linhas `POST /api/chat sem sidecar` e `POST /api/chat com sidecar` (`| média | p50 | p95 |`) e a diferença B−A (p50 e p95, com sinal). Inclui a nota: "na rodada B as inspeções rodam em paralelo com as respostas (até 4 em voo), então a disputa de CPU com o sidecar na mesma máquina entra na medição".

- [ ] **Step 4: Etapa 3** — ainda com a demo-api da rodada B (rodar antes do `stop()` dela). Para cada caso, uma vez: `newTraceparent()`, `postChat` com o header, registrar `SentCase` (`sentAt = Date.now()` antes do envio; `expectedThreatType` = `verdict.threatType` se `verdict?.flagged`). Esperar `max(100, ceil(modelLatency.p95))` ms entre envios. Ao final, esperar `ceil(p95) + 3000` ms, `GET ${API_URL}/api/v1/rasp/events?limit=100` (com `x-api-key` se `API_KEY`) e `matchDeliveries`. Imprime `### 4.4 Integração por traceId` com `| Métrica | Valor |`: esperados, entregues com traceId correto, perdidos, tipo divergente, eventos inesperados, taxa de entrega (%) e atraso do sombra (média e p95 via `summarizeLatency(delaysMs)`).

- [ ] **Step 5: Rodapé** — mesma frase do Experimento 3 sobre documentar CPU/RAM, mais "a acurácia vale para este dataset controlado; não generalize como desempenho em produção".

- [ ] **Step 6: Seção em `resultados-experimentos.md`** — `### Experimento 4 — Laya (sidecar em modo sombra)` com:
  - pré-requisitos: `pnpm build`, `docker compose --profile laya up -d --build laya`, `pnpm dev:backend`;
  - comando `pnpm experiment:laya`;
  - protocolo em 4 itens (as etapas 4.1–4.4 resumidas);
  - as tabelas 4.1 (só métricas), 4.2, 4.3 e 4.4 com `—` nos valores;
  - uma linha "**Leitura:** preencher após a execução oficial".

- [ ] **Step 7: Verificar** — `pnpm test` → tudo PASS. Com a stack no ar: `pnpm experiment:laya` imprime 4.1–4.4, e depois `Get-NetTCPConnection -LocalPort 4100` não encontra nada (filho encerrado). Sem stack: sai com a dica da pré-checagem. Registrar o que foi possível rodar.

- [ ] **Step 8: Commit**
  ```bash
  git add scripts/experiments/laya-eval.ts docs/tcc/resultados-experimentos.md
  git commit -m "feat(experiments): measure laya hot-path cost and trace delivery"
  ```
