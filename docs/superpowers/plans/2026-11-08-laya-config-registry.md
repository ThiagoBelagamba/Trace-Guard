# Registro de configurações do Laya — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** cada configuração do Laya passa a ter ficha + JSON pré-registrados por commit. O script de experimento executa exatamente o JSON, e um índice comparativo é gerado. Os registros começam pelos já existentes (C00–C09) e terminam com o pré-registro da opção A (C10).

**Arquitetura:**
- O SDK passa a aceitar um limiar por pergunta.
- Um módulo de registro (`laya-registry.ts`) define os tipos, valida os JSON, aplica o critério e escreve o índice.
- Um módulo de re-pontuação (`laya-rescore.ts`) reconstrói vereditos a partir das tabelas por caso já salvas. Isso dispensa o sidecar nos registros retroativos e na regra de seleção da C10.
- `laya-eval.ts` ganha `LAYA_CONFIG`, que substitui as variáveis avulsas e grava o resultado e a saída no registro.

**Tecnologias:** TypeScript, pnpm monorepo, Vitest, tsx, git CLI.

**Spec:** `docs/superpowers/specs/2026-11-08-laya-config-registry-design.md`

## Restrições globais

- **Commits sem assinatura do agente** (regra do Gabriel):
  - nenhuma linha `Co-Authored-By`;
  - nenhum "Generated with Claude Code" ou 🤖;
  - nenhuma menção a Claude ou Anthropic.
  - Depois de cada commit, `git log -1 --format=%B | grep -ic "claude\|co-authored"` tem de dar `0`.
- **Execução de scripts:** usar `pnpm run <script>`, nunca `pnpm -s <script>`.
- **Comportamento padrão do SDK inalterado:** sem configuração, os dois limiares continuam `0.85` e `min_confidence` continua `0.8`.
- **Critério `tres-condicoes-v1`:** inalterado.
  - F1 ≥ ref + 0,10;
  - recall de `secret_leak` ≥ ref + 0,20;
  - taxa de FP em legítimos difíceis ≤ ref + 0,05;
  - sempre contra a referência (C00) no **mesmo** conjunto.
- **Palavras do veredito:**
  - `pre-registrada` executada no seu `conjunto_teste` → "passou" / "não passou";
  - qualquer outro caso → "atende numericamente (sem pré-registro)" / "não atende".
- **Congelamento:** um JSON de configuração com commit de pré-registro nunca é editado; mudanças viram um id novo.
- **Raiz do registro:** `docs/tcc/experimento-4-registro/`.
- **Nomes de arquivo:**
  - `configuracoes/Cnn.json`;
  - `fichas/Cnn-<slug>.md`;
  - `resultados/Cnn--<conjunto>.json`;
  - `saidas/Cnn--<conjunto>.md`.
- **Mensagens de commit:**
  - pré-registro: `prereg(laya): Cnn <título>`;
  - resultado: `result(laya): Cnn passou|não passou`.

## Desvio do spec (decidido aqui)

A tabela do spec descreve C07 como "Híbrido: PI `english` + SL `multilingual`, atende". Isso mistura duas análises diferentes:

- **Relatório §15:** injeção do **roteamento** + credencial do `multilingual`, a 0,85. Dá 14/54 FP e **não atende**.
- **Discussão de 08/11:** injeção do `english` a 0,97 + credencial do `multilingual` a 0,99. Dá 8/54 FP e atende numericamente.

Os dois viram registros separados, e a opção A passa de C08 para C10:

| Id | Configuração |
|---|---|
| C07 | Híbrido do §15 |
| C08 | Híbrido da discussão |
| C09 | `multilingual` com limiares 0,995/0,99 (o ponto exploratório que motivou a opção A) |
| C10 | Opção A (pré-registrada) |

## Foco da revisão

1. **`LAYA_CONFIG` junto com `LAYA_MODEL`, `LAYA_VARIANTS` ou `LAYA_STAGES=all`:** o script recusa com uma mensagem. Não pode ignorar em silêncio. Teste na Tarefa 5.
2. **Conjunto `test` com o JSON da configuração modificado ou nunca commitado:** o script recusa antes de chamar o sidecar. Teste na Tarefa 5.
3. **Resultado de candidata e referência em conjuntos diferentes:** o critério recusa a comparação, sem calcular. Teste na Tarefa 2.
4. **Caso marcado `(abst.)` com nota acima do limiar:** conta como não marcado, como no SDK. Teste na Tarefa 3.
5. **Conjunto de teste que repete texto do dev ou da validação:** a integridade aponta o problema. Teste na Tarefa 5.

---

### Tarefa 1: SDK — limiar por pergunta

**Arquivos:**
- Modificar:
  - `packages/sdk/src/rasp/laya-inspector.ts`
  - `packages/sdk/src/rasp/laya-shadow.ts` (`LayaShadowJob`)
  - `packages/sdk/src/rasp/types.ts` (`RaspConfig`)
  - `packages/sdk/src/interceptors/express.ts:86-100`
  - `packages/sdk/src/index.ts`
- Testes:
  - `packages/sdk/src/rasp/laya-inspector.test.ts`
  - `packages/sdk/src/rasp/laya-shadow.test.ts`

**Interfaces:**
- **Produz:**
  - `export interface LayaThresholds { readonly prompt_injection: number; readonly secret_leak: number }`
  - `export const DEFAULT_LAYA_THRESHOLDS: LayaThresholds`, com `0.85` / `0.85`
  - `export function isHit(signal: LayaSignal | undefined, threshold?: number): signal is LayaSignal`. O padrão é `LAYA_NOUL_THRESHOLD`.
  - `LayaInspectOptions.thresholds?: LayaThresholds` e `LayaInspectOptions.minConfidence?: number`. O valor de `minConfidence` vai como `min_confidence` no corpo; o padrão é `LAYA_MIN_CONFIDENCE`.
  - `LayaShadowJob.thresholds?: LayaThresholds` e `RaspConfig.layaThresholds?: LayaThresholds`. O interceptor repassa um ao outro.
  - `index.ts` exporta `LayaThresholds` e `DEFAULT_LAYA_THRESHOLDS`.

- [ ] **Passo 1: escrever os testes que falham**, em `laya-inspector.test.ts`, usando o `fetchImpl` falso que o arquivo já tem.
  - `test("applies a separate threshold per question")`: com respostas noul `prompt_injection: 0.97` e `sensitive_data: 0.97` e `thresholds: { prompt_injection: 0.995, secret_leak: 0.95 }`, esperar `flagged === true`, `threatType === "secret_leak"` e `hits` igual a `["secret_leak"]`.
  - `test("sends minConfidence as min_confidence")`: o corpo enviado tem `min_confidence: 0.9` quando `minConfidence: 0.9`.
  - `test("keeps 0.85 when no thresholds are given")`: noul 0.86 em injeção marca; noul 0.84 não marca.
  - Em `laya-shadow.test.ts`, `test("passes job thresholds to the inspector")`: o `inspect` falso recebe `options.thresholds` igual ao do job.

- [ ] **Passo 2:** `pnpm vitest run packages/sdk/src/rasp` → falha (`thresholds` ignorado ou `minConfidence` ausente).

- [ ] **Passo 3: implementar.**
  - `inspectPayloadWithLaya` calcula `piHit = isHit(prompt, t.prompt_injection)` e `slHit = isHit(secret, t.secret_leak)`, com `t = options?.thresholds ?? DEFAULT_LAYA_THRESHOLDS`.
  - O job do sombra repassa `thresholds` nas opções de `inspect`.

- [ ] **Passo 4:** `pnpm vitest run packages/sdk` → tudo passa, incluindo os testes antigos sem `thresholds`.

- [ ] **Passo 5: commit**
  ```bash
  git add packages/sdk/src
  git commit -m "feat(sdk): accept a laya threshold per question"
  ```

---

### Tarefa 2: módulo de registro — tipos, validação e critério

**Arquivos:**
- Criar: `scripts/experiments/laya-registry.ts`
- Teste: `scripts/experiments/laya-registry.test.ts`

**Interfaces:**
- **Consome:** `LayaThresholds` (Tarefa 1).
- **Produz:**
  ```ts
  export const REGISTRY_DIR = path.join("docs", "tcc", "experimento-4-registro");
  export type ConfigStatus = "referencia" | "pre-registrada" | "exploratoria";
  export type Checkpoint = "roteamento" | "multilingual" | "english" | "multilingual-cal" | "english-cal";
  export type DatasetName = "dev" | "validation" | "test";
  export interface LayaConfig {
    id: string;                     // /^C\d{2}$/
    titulo: string;
    status: ConfigStatus;
    motivada_por: string[];
    variante: "sdk" | "baseline";
    checkpoint: Checkpoint | { prompt_injection: Checkpoint; secret_leak: Checkpoint };
    limiares: LayaThresholds;
    min_confidence: number;
    padroes_credencial: boolean;
    conjunto_ajuste: DatasetName[];
    conjunto_teste: DatasetName;
    criterio: "tres-condicoes-v1";
    referencia: string | null;      // null só em status "referencia"
  }
  export interface ResultMetrics {
    tp: number; fp: number; fn: number; tn: number;
    precision: number; recall: number; f1: number;
    recallPi: number; recallSl: number;
    hardFp: number; hardTotal: number;
    latencyMeanMs: number | null; latencyP95Ms: number | null;
  }
  export interface LayaResult {
    config: string; conjunto: DatasetName; data: string;   // data = AAAA-MM-DD
    commit_config: string | null;
    origem: "execucao" | "extraido-de-saida";
    saida: string;                  // caminho relativo a REGISTRY_DIR
    metricas: ResultMetrics;
  }
  export interface CriterionCheck { nome: string; valor: number; exigido: number; ok: boolean }
  export interface CriterionVerdict { condicoes: CriterionCheck[]; atende: boolean; rotulo: string }
  export function parseLayaConfig(raw: unknown): LayaConfig;          // lança Error com todos os problemas
  export function loadLayaConfig(id: string, dir?: string): LayaConfig;
  export function loadAllConfigs(dir?: string): LayaConfig[];
  export function loadAllResults(dir?: string): LayaResult[];
  export function evaluateCriterion(config: LayaConfig, candidate: LayaResult, reference: LayaResult): CriterionVerdict;
  export function wilsonInterval(k: number, n: number, z?: number): [number, number];
  ```

- [ ] **Passo 1: escrever os testes que falham.**
  - `parseLayaConfig` aceita o JSON de exemplo do spec com `id: "C10"`.
  - `parseLayaConfig` recusa, citando cada campo:
    - limiar fora de `[0,1]`;
    - id `"X1"`;
    - `referencia: null` com status diferente de `referencia`;
    - checkpoint em forma de objeto com status diferente de `exploratoria`.
  - `evaluateCriterion` com referência `{f1: 0.502, recallSl: 0.144, hardFp: 8, hardTotal: 54}` e candidata C01 `{f1: 0.864, recallSl: 0.615, hardFp: 15, hardTotal: 54}`, config `pre-registrada`, `conjunto_teste: "validation"`:
    - `atende === false`;
    - `rotulo === "não passou"`;
    - a condição 3 tem `exigido` ≈ 0.198 (`toBeCloseTo(0.198, 3)`).
  - A mesma candidata com `hardFp: 5` → `rotulo === "passou"`.
  - Config `exploratoria` que atende → `rotulo === "atende numericamente (sem pré-registro)"`. Não atendendo → `"não atende"`.
  - `pre-registrada` executada num conjunto diferente do seu `conjunto_teste` → rótulos de exploratória.
  - Candidata e referência com `conjunto` diferente → lança `Error` com `/mesmo conjunto/`.
  - `wilsonInterval(9, 54)` ≈ `[0.090, 0.288]` com 3 casas.

- [ ] **Passo 2:** `pnpm vitest run scripts/experiments/laya-registry.test.ts` → falha (módulo inexistente).

- [ ] **Passo 3: implementar** em `laya-registry.ts`.
  - `loadAllResults` lê `resultados/*.json` e os ordena por `config` e depois por `conjunto`.
  - A taxa de FP em difíceis é `hardFp / hardTotal`.

- [ ] **Passo 4:** o mesmo comando → passa.

- [ ] **Passo 5: commit**
  ```bash
  git add scripts/experiments/laya-registry.ts scripts/experiments/laya-registry.test.ts
  git commit -m "feat(experiments): add the laya configuration registry model"
  ```

---

### Tarefa 3: re-pontuação a partir das saídas salvas

**Arquivos:**
- Criar: `scripts/experiments/laya-rescore.ts`
- Teste: `scripts/experiments/laya-rescore.test.ts`, com fixture embutida de uma saída curta (3 casos, duas seções 4.1 e uma 4.2)

**Interfaces:**
- **Consome:** `LayaThresholds`, `ResultMetrics`, `buildAccuracyReport` e `CaseVerdict` de `laya-stats.ts`, `LayaCase`.
- **Produz:**
  ```ts
  export interface CaseScore { id: string; piNoul: number | null; slNoul: number | null; piAbst: boolean; slAbst: boolean }
  export type OutputSection = "sdk" | "baseline";   // "SDK atual (R1–R5)" | "Linha de base (pré-R1)"
  export function parseCaseScores(markdown: string, section: OutputSection): CaseScore[];
  export function parseLatency(markdown: string, section: OutputSection): { meanMs: number; p95Ms: number } | null;
  export function verdictFromScore(score: CaseScore, t: LayaThresholds, pick: "sdk" | "baseline"): CaseVerdict;
  export function mergeScores(piFrom: CaseScore[], slFrom: CaseScore[]): CaseScore[];   // por id; lança se faltar id
  export function metricsFor(dataset: readonly LayaCase[], scores: CaseScore[], t: LayaThresholds, pick: "sdk" | "baseline"): ResultMetrics;
  ```
  `metricsFor` devolve `latencyMeanMs` e `latencyP95Ms` como `null`; quem chama preenche com `parseLatency` quando fizer sentido.

- [ ] **Passo 1: escrever os testes que falham.**
  - `parseCaseScores` lê `| val-pi-006 | pt | prompt_injection | não | secret_leak | 0.740 (abst.) | 0.897 |` como `{piNoul: 0.74, piAbst: true, slNoul: 0.897, slAbst: false}` e `—` como `null`.
  - A seção `baseline` só lê linhas abaixo de `### 4.1 Acurácia — Linha de base`.
  - `verdictFromScore`:
    - `piNoul 0.99`, `piAbst: true`, limiar 0.85 → `piHit === false`;
    - `slNoul 0.9`, limiar 0.95 → `slHit === false`;
    - `slNoul 0.96` → `slHit === true` e `threatType === "secret_leak"`;
    - `flagged === piHit || slHit`.
  - `pick: "baseline"` com os dois sinais marcados escolhe a maior nota, como `baselinePick`.
  - `parseLatency` lê `| Laya /v1/systemone | 784.1 | 653.0 | 1564.0 |` → `{meanMs: 784.1, p95Ms: 1564}`.
  - `mergeScores` pega a injeção do primeiro e a credencial do segundo, e lança quando falta um id.

- [ ] **Passo 2:** `pnpm vitest run scripts/experiments/laya-rescore.test.ts` → falha.

- [ ] **Passo 3: implementar.**
  - `verdictFromScore` usa `isHit` do SDK com o limiar de cada pergunta. Um sinal abstido é passado como `abstention: "abstained"`.
  - O tipo vem de `pickThreatType` (sdk) ou da regra de `BASELINE_POLICY.pickThreatType` (baseline).
  - `metricsFor` monta os vereditos e chama `buildAccuracyReport`.
  - Mapeamento dos campos: `recallPi = report.promptInjection.recall`, `recallSl = report.secretLeak.recall`, `hardFp/hardTotal = report.hardBenign`.

- [ ] **Passo 4:** o mesmo comando → passa.

- [ ] **Passo 5: commit**
  ```bash
  git add scripts/experiments/laya-rescore.ts scripts/experiments/laya-rescore.test.ts
  git commit -m "feat(experiments): rescore laya verdicts from saved per-case outputs"
  ```

---

### Tarefa 4: gerador do índice

**Arquivos:**
- Modificar: `scripts/experiments/laya-registry.ts`
- Criar: `scripts/experiments/laya-index.ts` (CLI)
- Modificar: `package.json`, adicionando `"experiment:laya:index": "tsx scripts/experiments/laya-index.ts"`
- Teste: `scripts/experiments/laya-registry.test.ts`

**Interfaces:**
- **Consome:** tipos e `evaluateCriterion` (Tarefa 2).
- **Produz:** `export function buildIndex(configs: LayaConfig[], results: LayaResult[]): string`. A CLI grava em `path.join(REGISTRY_DIR, "indice.md")`.

**Formato do índice:**
- Título `# Registro de configurações — Experimento 4 (Laya)` e a linha `Gerado por pnpm run experiment:laya:index. Não editar à mão.`
- Seção `## Pré-registradas e referência`, depois `## Exploratórias (sem pré-registro)`.
- Colunas: `| Id | Configuração | Status | Checkpoint | Limiar PI / SL | Conjunto | F1 | Recall SL | Recall PI | FP difíceis | Latência média (ms) | Veredito |`.
- Uma linha por resultado.
- O veredito vem de `evaluateCriterion` quando existe resultado da referência no mesmo conjunto; senão, `—`.
- A referência mostra `referência`.
- Números com vírgula decimal e 3 casas.
- FP em difíceis como `15/54`.
- Checkpoint em forma de objeto como `PI english · SL multilingual`.

- [ ] **Passo 1: escrever os testes que falham.**
  - `buildIndex` com C00 (referência) + C01 (pré-registrada) + C02 (exploratória), todos em `validation`:
    - contém as duas seções;
    - a linha de C01 termina em `| não passou |`;
    - a linha de C02 está depois de `## Exploratórias`;
    - a linha de C00 mostra `| referência |`;
    - aparece `15/54`;
    - aparece `0,864`.
  - Um resultado sem referência no mesmo conjunto mostra `| — |`.

- [ ] **Passo 2:** `pnpm vitest run scripts/experiments/laya-registry.test.ts` → falha.

- [ ] **Passo 3: implementar** `buildIndex` e a CLI.

- [ ] **Passo 4:** o mesmo comando → passa.

- [ ] **Passo 5: commit**
  ```bash
  git add scripts/experiments/laya-registry.ts scripts/experiments/laya-registry.test.ts scripts/experiments/laya-index.ts package.json
  git commit -m "feat(experiments): generate the laya registry index"
  ```

---

### Tarefa 5: `laya-eval.ts` com `LAYA_CONFIG`, conjunto de teste e prova por git

**Arquivos:**
- Criar: `scripts/experiments/laya-run-config.ts`, com a lógica testável separada do `main`
- Modificar:
  - `scripts/experiments/laya-eval.ts`
  - `scripts/experiments/laya-dataset-loader.ts` (`IntegrityOptions.minHardBenign?: number`)
- Testes:
  - `scripts/experiments/laya-run-config.test.ts`
  - `scripts/experiments/laya-dataset-loader.test.ts`

**Interfaces:**
- **Consome:**
  - `loadLayaConfig` e `LayaResult` (Tarefa 2);
  - `ResultMetrics` montado a partir de `AccuracyReport`;
  - `isHit` com limiar (Tarefa 1).
- **Produz:**
  ```ts
  export interface RunPlan { config: LayaConfig; dataset: DatasetName }
  export function resolveRunPlan(env: Record<string, string | undefined>, load?: (id: string) => LayaConfig): RunPlan | null;
  //   null quando LAYA_CONFIG está vazio (comportamento antigo intacto)
  export function assertCommitted(file: string, git?: (args: string[]) => string): string;  // devolve o hash
  export function configCommit(file: string, git?: (args: string[]) => string): string | null;
  export function metricsFromReport(report: AccuracyReport, latency: LatencySummary): ResultMetrics;
  export function sdkPolicy(t: LayaThresholds): VerdictPolicy;
  export const TEST_FILE = path.join("scripts", "experiments", "data", "laya-test.json");
  ```

**Regras de `resolveRunPlan`** (cada recusa lança um `Error` que cita a variável):
- Recusa `LAYA_MODEL`, `LAYA_VARIANTS` ou `LAYA_STAGES` diferente de `accuracy` quando há `LAYA_CONFIG`.
- Recusa checkpoint em forma de objeto ("híbrido não é executável; registro só por re-pontuação").
- Recusa `variante: "baseline"` com limiares diferentes de `0.8` / `0.8`.
- `LAYA_DATASET` vazio vira `config.conjunto_teste`.

**`assertCommitted`:**
- Lança se `git status --porcelain -- <file>` não estiver vazio.
- Lança se `git log -1 --format=%H -- <file>` estiver vazio.

**`laya-dataset-loader`:** `minHardBenign` gera o problema `legítimos difíceis: N, mínimo M`.

- [ ] **Passo 1: escrever os testes que falham** (os itens 1, 2 e 5 do Foco da revisão).
  - `resolveRunPlan({LAYA_CONFIG: "C02", LAYA_MODEL: "english"})` lança `/LAYA_MODEL/`.
  - Idem com `LAYA_VARIANTS` e com `LAYA_STAGES: "all"`.
  - `resolveRunPlan({})` → `null`.
  - `resolveRunPlan({LAYA_CONFIG: "C02"})` usa `conjunto_teste` como dataset.
  - `assertCommitted` com um `git` falso:
    - que devolve `" M docs/...C10.json"` no status → lança `/não commitad/`;
    - com status vazio e log `"abc123"` → devolve `"abc123"`;
    - com status vazio e log vazio → lança.
  - `sdkPolicy({prompt_injection: 0.995, secret_leak: 0.99}).isHit` depende da pergunta.
    - Ajuste em `VerdictPolicy`: `isHit(signal, question: SemanticThreat)`. `majorityVerdict` passa `"prompt_injection"` e `"secret_leak"`.
    - `SDK_POLICY` e `BASELINE_POLICY` ignoram o segundo argumento.
  - `checkDatasetIntegrity` com `minHardBenign: 100` e 54 difíceis aponta `legítimos difíceis: 54, mínimo 100`.
  - Com `disjointFrom` igual a dev + validation, um texto repetido da validação é apontado.

- [ ] **Passo 2:** `pnpm vitest run scripts/experiments` → falha.

- [ ] **Passo 3: implementar `laya-run-config.ts` e ligar no `laya-eval.ts`.**
  - **Com `RunPlan`:**
    - roda só a variante do JSON;
    - `inspect` usa `model` (vazio em `roteamento`), `thresholds` e `minConfidence` do JSON;
    - a política é `sdkPolicy(limiares)` ou `BASELINE_POLICY`;
    - a camada R10 é aplicada só se `padroes_credencial` for verdadeiro;
    - etapas 4.3 e 4.4 puladas.
  - **Cabeçalho:** imprime `Configuração: C10 — <titulo> · status: pre-registrada · commit: <hash|não commitado>`. O limiar sai do JSON (`PI ≥ 0.995 · SL ≥ 0.99`), não da constante.
  - **Conjunto `test`:**
    - chama `assertCommitted` **antes** de `warmUpSidecar`;
    - carrega `TEST_FILE` com `checkDatasetIntegrity(cases, {minPerClass: 90, minHardBenign: 100, disjointFrom: [...LAYA_DATASET, ...validation]})`.
  - **Captura da saída:** um wrapper de `console.log` acumula o texto.
  - **Ao fim, grava:**
    - `saidas/<id>--<conjunto>.md`, com o texto capturado;
    - `resultados/<id>--<conjunto>.json`, com `origem: "execucao"`, `commit_config` de `configCommit` e `data` de hoje.
  - **Sem `LAYA_CONFIG`:** tudo como antes.

- [ ] **Passo 4:**
  - `pnpm vitest run scripts/experiments` → passa;
  - `pnpm vitest run` (suíte inteira) → passa.

- [ ] **Passo 5: commit**
  ```bash
  git add scripts/experiments
  git commit -m "feat(experiments): run laya experiments from a registered configuration"
  ```

---

### Tarefa 6: registros retroativos C00–C09

**Arquivos:**
- Mover com `git mv` (de `docs/tcc/experimento-4-validacao/` para `docs/tcc/experimento-4-registro/saidas/`):

  | Origem | Destino |
  |---|---|
  | `saida-routing.md` | `C01--validation.md` |
  | `saida-dev-reexecucao.md` | `C01--dev.md` |
  | `saida-multilingual.md` | `C02--validation.md` |
  | `saida-english.md` | `C03--validation.md` |
  | `saida-english-cal.md` | `C04--validation.md` |
  | `saida-multilingual-cal.md` | `C05--validation.md` |

- Criar:
  - `docs/tcc/experimento-4-registro/configuracoes/C00.json` … `C09.json`;
  - as fichas em `fichas/`;
  - `README.md`;
  - `scripts/experiments/laya-registry-backfill.ts`, com teste `laya-registry-backfill.test.ts`.
- Modificar: `package.json` (`"experiment:laya:backfill"`).

**Interfaces:**
- **Consome:** Tarefas 2, 3 e 4.
- **Produz:** `export const BACKFILL: readonly BackfillEntry[]` e `export function backfillResult(entry: BackfillEntry, dataset: readonly LayaCase[], read: (rel: string) => string): LayaResult`.

**Tabela `BACKFILL`:**

| Config | Conjunto | Fonte (seção) | Limiares | Escolha do tipo |
|---|---|---|---|---|
| C00 | validation | C01--validation (baseline) | 0.8/0.8 | baseline |
| C00 | dev | C01--dev (baseline) | 0.8/0.8 | baseline |
| C01 | validation | C01--validation (sdk) | 0.85/0.85 | sdk |
| C01 | dev | C01--dev (sdk) | 0.85/0.85 | sdk |
| C02 | validation | C02--validation (sdk) | 0.85/0.85 | sdk |
| C03 | validation | C03--validation (sdk) | 0.85/0.85 | sdk |
| C04 | validation | C04--validation (sdk) | 0.85/0.85 | sdk |
| C05 | validation | C05--validation (sdk) | 0.85/0.85 | sdk |
| C06 | validation | C01--validation (sdk) | 0.97/0.97 | sdk |
| C07 | validation | PI de C01--validation + SL de C02--validation | 0.85/0.85 | sdk |
| C08 | validation | PI de C03--validation + SL de C02--validation | 0.97/0.99 | sdk |
| C09 | validation | C02--validation (sdk) | 0.995/0.99 | sdk |

Regras:
- Latência por `parseLatency` só quando a fonte é uma única saída com os mesmos limiares (C00, C01, C02, C03, C04, C05). Nos demais, `null`.
- `saida` aponta para o arquivo-fonte.
- `commit_config: null`.

**Configs:**
- C00: `status: "referencia"`, `variante: "baseline"`, `referencia: null`, `conjunto_teste: "validation"`.
- C01: `pre-registrada`, `conjunto_teste: "validation"`. A ficha cita o pré-registro do critério em `d7dd160`.
- C02 a C09: `exploratoria`, `conjunto_teste: "validation"`, `referencia: "C00"`.
  - C04 e C05 usam checkpoint `english-cal` e `multilingual-cal`.
  - C07 e C08 usam checkpoint em forma de objeto: C07 com `prompt_injection: "roteamento"`, C08 com `prompt_injection: "english"`.
- `motivada_por`:

  | Config | Motivada por |
  |---|---|
  | C01 | `[]` |
  | C02, C03 | `["C01"]` |
  | C04 | `["C03"]` |
  | C05 | `["C02"]` |
  | C06 | `["C01"]` |
  | C07 | `["C01","C02"]` |
  | C08 | `["C07"]` |
  | C09 | `["C02"]` |

- [ ] **Passo 1: escrever o teste que falha**, que reproduz os números já publicados no relatório lendo as saídas reais do repositório:
  - C01 validation → `tp/fp/fn/tn = 171/15/39/91`, `f1` ≈ 0,864, `recallSl` ≈ 0,615, `hardFp = 15`;
  - C00 validation → `73/8/137/98` e `hardFp = 8`;
  - C02 validation → `184/20/26/86` e `hardFp = 19`;
  - C07 validation → `f1` ≈ 0,910, `recallSl` ≈ 0,913, `hardFp = 14`;
  - C08 validation → `f1` ≈ 0,885, `recallSl` ≈ 0,740, `recallPi` ≈ 0,802, `hardFp = 8`;
  - C09 validation → `f1` ≈ 0,814, `recallSl` ≈ 0,740, `recallPi` ≈ 0,519, `hardFp = 9`.

  Se algum número não bater, a re-pontuação está errada: use superpowers:systematic-debugging, não ajuste o teste.

- [ ] **Passo 2:** `pnpm vitest run scripts/experiments/laya-registry-backfill.test.ts` → falha.

- [ ] **Passo 3: implementar o backfill e a CLI.** A CLI grava `resultados/*.json` com `origem: "extraido-de-saida"`. Em seguida, escrever:
  - os 10 JSON de configuração;
  - o `README.md`, com: protocolo; ciclo de vida (rascunho → pré-registro → execução → registro); campos do JSON; palavras do veredito; regra de congelamento; comandos; o critério `tres-condicoes-v1` com o texto da §14.1;
  - as 10 fichas, nas 10 seções do spec, com motivação e números das §13–§17. As exploratórias levam no topo: `> Exploratória: definida depois de ver os dados. Nunca recebe "passou".`

- [ ] **Passo 4:**
  - `pnpm vitest run scripts/experiments` → passa;
  - depois `pnpm run experiment:laya:backfill` e `pnpm run experiment:laya:index`;
  - ler `indice.md` e conferir:
    - C01 validation = `não passou`;
    - C05, C06, C08 e C09 = `atende numericamente (sem pré-registro)`;
    - C02, C03, C04 e C07 = `não atende`.

- [ ] **Passo 5: commit**
  ```bash
  git add -A docs/tcc/experimento-4-registro docs/tcc/experimento-4-validacao scripts/experiments package.json
  git commit -m "docs(tcc): register laya configurations C00-C09 retroactively"
  ```

---

### Tarefa 7: regra de seleção dos limiares da C10

**Arquivos:**
- Criar:
  - `scripts/experiments/laya-select-thresholds.ts` (função + CLI)
  - `scripts/experiments/laya-select-thresholds.test.ts`
- Modificar: `package.json` (`"experiment:laya:select": "tsx scripts/experiments/laya-select-thresholds.ts"`)

**Interfaces:**
- **Consome:** `metricsFor` e `CaseScore` (Tarefa 3); `LayaThresholds`.
- **Produz:**
  ```ts
  export const SELECTION_GRID = [0.85, 0.9, 0.93, 0.95, 0.97, 0.98, 0.99, 0.995, 0.999] as const;
  export const MAX_HARD_FP_RATE = 0.15;
  export interface Selection { thresholds: LayaThresholds; metrics: ResultMetrics; candidates: number }
  export function selectThresholds(pool: { dataset: readonly LayaCase[]; scores: CaseScore[] }[], grid?: readonly number[], maxHardFpRate?: number): Selection | null;
  ```

**Algoritmo** (não determinado só pela assinatura):
- Para cada par (PI, SL) da grade, somar TP, FP, FN, TN e difíceis de todas as partes do pool.
- Descartar pares com `hardFp/hardTotal > maxHardFpRate`.
- Maximizar o F1 agregado.
- Desempatar por maior `recallPi`, depois maior `recallSl`, depois menor soma de limiares.
- `candidates` = número de pares que respeitam a restrição.
- Sem candidato → `null`.

**CLI:**
- Lê `saidas/C02--dev.md` e `saidas/C02--validation.md`.
- Imprime a escolha e a tabela dos 5 melhores.
- Com `--write C10`, grava os limiares em `configuracoes/C10.json`. Recusa se esse arquivo já tiver commit (`configCommit` não nulo), por causa do congelamento.

- [ ] **Passo 1: escrever os testes que falham**, com um pool sintético de 6 casos:
  - um par que viola a taxa é descartado mesmo tendo F1 maior;
  - o desempate por `recallPi` funciona;
  - um pool sem candidato devolve `null`;
  - `--write` recusa quando o `git` falso devolve um hash.

- [ ] **Passo 2:** `pnpm vitest run scripts/experiments/laya-select-thresholds.test.ts` → falha.

- [ ] **Passo 3: implementar.**

- [ ] **Passo 4:** o mesmo comando → passa.

- [ ] **Passo 5: commit**
  ```bash
  git add scripts/experiments/laya-select-thresholds.ts scripts/experiments/laya-select-thresholds.test.ts package.json
  git commit -m "feat(experiments): select laya thresholds by the pre-registered rule"
  ```

---

### Tarefa 8: relatório §19 e guia do conjunto de teste

**Arquivos:**
- Modificar:
  - `docs/tcc/relatorio-experimento-4-laya.md`
  - `scripts/experiments/data/README.md`

**Relatório:**
- Na §14–§17, cada tabela ganha o id da configuração no cabeçalho da coluna, por exemplo `C01 — roteamento`.
- Os links para `experimento-4-validacao/` passam a apontar para `experimento-4-registro/saidas/`.
- Nova **§19 Registro de configurações**, com:
  - o protocolo resumido;
  - o link para o `README.md` e o `indice.md` do registro;
  - a cadeia de motivação C01 → C02 → C09 → C10;
  - a frase "Configurações exploratórias nunca recebem 'passou'".

**Guia do conjunto de teste** (seção nova no README dos dados, `## Conjunto de teste (laya-test.json)`):
- mesmo formato da validação;
- `prompt_injection` ≥ 90, `secret_leak` ≥ 90, `benign` ≥ 130 com **≥ 100** `hard: true`;
- 40–60% de textos em português;
- nada copiado do dev nem da validação;
- não rodar o modelo nem ler as notas antes de entregar.

- [ ] **Passo 1:** editar os dois arquivos.

- [ ] **Passo 2:** `grep -rn "experimento-4-validacao" docs scripts` → nenhuma ocorrência.

- [ ] **Passo 3: commit**
  ```bash
  git add docs/tcc/relatorio-experimento-4-laya.md scripts/experiments/data/README.md
  git commit -m "docs(tcc): document the laya registry and the test set guide"
  ```

---

### Tarefa 9: pré-registro da C10 (opção A)

**Arquivos:**
- Criar:
  - `docs/tcc/experimento-4-registro/saidas/C02--dev.md` e `resultados/C02--dev.json` (gerados pela execução)
  - `configuracoes/C10.json`
  - `fichas/C10-multilingual-limiares-por-pergunta.md`

**Precisa do sidecar.** Se `docker compose --profile laya up -d laya` não deixar o `/health` respondendo, **parar e avisar o Gabriel**. É uma ação fora do repositório.

- [ ] **Passo 1:** `LAYA_CONFIG=C02 LAYA_DATASET=dev pnpm run experiment:laya`.
  - Esperado: 40 casos, nenhuma falha de transporte.
  - Grava `saidas/C02--dev.md` e `resultados/C02--dev.json`.
  - C02 é exploratória e o conjunto não é `test`, então não há checagem de commit.

- [ ] **Passo 2: escrever o rascunho de `C10.json`:**
  - `status: "pre-registrada"`, `variante: "sdk"`, `checkpoint: "multilingual"`;
  - `min_confidence: 0.8`, `padroes_credencial: false`;
  - `conjunto_ajuste: ["dev","validation"]`, `conjunto_teste: "test"`, `referencia: "C00"`;
  - `motivada_por: ["C02","C09"]`;
  - limiares provisórios `0.85/0.85`.

  Depois, `pnpm run experiment:laya:select -- --write C10`.
  - Esperado: um par escolhido com `hardFp/hardTotal ≤ 0.15` no pool.
  - Os limiares ficam gravados no JSON.

- [ ] **Passo 3: escrever a ficha C10, seções 1–7.**
  - A seção 5 traz a regra literal (grade, restrição de 0,15, objetivo, desempates) e a tabela dos 5 melhores pares impressa pela CLI.
  - A seção 6 diz que C00 também roda no teste.
  - As seções 8–10 ficam como `Pendente — aguardando laya-test.json.`
  - Regenerar o índice.

- [ ] **Passo 4: commit de pré-registro**
  ```bash
  git add docs/tcc/experimento-4-registro
  git commit -m "prereg(laya): C10 multilingual with per-question thresholds"
  git log -1 --format=%B | grep -ic "claude\|co-authored"   # → 0
  ```
  Esperado: o hash deste commit é a prova do pré-registro e vai na mensagem final ao Gabriel.

- [ ] **Passo 5:** `pnpm vitest run` → toda a suíte passa.

**Depois deste plano** (quando o Gabriel entregar `laya-test.json`), fora do escopo:
1. `LAYA_CONFIG=C00 LAYA_DATASET=test pnpm run experiment:laya`;
2. `LAYA_CONFIG=C10 pnpm run experiment:laya`;
3. preencher as fichas e regenerar o índice;
4. commit `result(laya): C10 passou|não passou`.
