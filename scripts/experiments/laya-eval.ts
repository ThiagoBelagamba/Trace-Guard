/**
 * Experimento 4 — Laya (sidecar em modo sombra)
 *
 * 4.1 Acurácia: dataset rotulado direto no sidecar, com o mesmo texto que o
 *     sombra extrai de { message } (extractInspectableText), limiar e
 *     perguntas do SDK (inspectPayloadWithLaya).
 * 4.2 Latência do modelo em /v1/systemone.
 * 4.3 Custo no caminho quente: o script sobe a demo-api duas vezes (sem e com
 *     LAYA_SIDECAR_URL) e mede POST /api/chat.
 * 4.4 Integração: cada texto vai com traceparent próprio e o evento é
 *     conferido em /api/v1/rasp/events pelo mesmo traceId.
 *
 * Usa http.request (não fetch) na demo-api para controlar os cabeçalhos, e um
 * X-Forwarded-For único por requisição para o rate limit do RASP não interferir.
 *
 * Requer: sidecar Laya (docker compose --profile laya up -d --build laya)
 * e backend (pnpm dev:backend).
 *
 * Uso: pnpm experiment:laya
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import type { ClassificationMetrics } from "../../packages/shared/src/metrics.ts";
import type { RaspEvent } from "../../packages/shared/src/rasp.ts";
import {
  inspectPayloadWithLaya,
  LAYA_NOUL_THRESHOLD,
  type LayaInspectionResult,
} from "../../packages/sdk/src/rasp/laya-inspector.ts";
import { extractInspectableText, type LayaShadowCounters } from "../../packages/sdk/src/rasp/laya-shadow.ts";
import { LAYA_DATASET, type LayaCase } from "./laya-dataset.ts";
import { checkDatasetIntegrity, loadLayaDatasetFile } from "./laya-dataset-loader.ts";
import {
  brierScore,
  buildAccuracyReport,
  calibrationPairs,
  diffShadowStats,
  expectedCalibrationError,
  formatNoul,
  majorityVerdict,
  matchDeliveries,
  pendingCheckpoints,
  SDK_POLICY,
  summarizeLatency,
  type AccuracyReport,
  type CaseVerdict,
  type DeliveryReport,
  type LatencySummary,
  type SentCase,
  type VerdictPolicy,
} from "./laya-stats.ts";
import { BASELINE_POLICY, inspectBaseline } from "./laya-baseline.ts";

const LAYA_URL = (process.env.LAYA_SIDECAR_URL ?? "http://localhost:8000").replace(/\/$/, "");
const LAYA_API_KEY = process.env.LAYA_API_KEY ?? "traceguard-secret";
/** Checkpoint forçado (R7); vale para a variante sdk e para a demo-api filha. */
const LAYA_MODEL = process.env.LAYA_MODEL?.trim() || undefined;
const API_URL = (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const API_KEY = process.env.API_KEY;
const DEMO_PORT = parseInt(process.env.EXPERIMENT_DEMO_PORT ?? "4100", 10);
/** O modelo é determinístico (relatório §6.1): 1 repetição basta para a acurácia. */
const REPS = Math.max(1, parseInt(process.env.LAYA_REPS ?? "1", 10) || 1);
/** O caminho quente mede tempo de resposta, que varia: mantém 3 amostras por texto. */
const HOT_PATH_REPS = 3;
const DATASET_NAME = process.env.LAYA_DATASET ?? "dev";
const VALIDATION_FILE = path.join("scripts", "experiments", "data", "laya-validation.json");
const STAGES = process.env.LAYA_STAGES ?? "all";
/** GET /api/v1/rasp/events devolve no máximo 100 eventos. */
const MAX_INTEGRATION_TEXTS = 100;
let DATASET: readonly LayaCase[] = LAYA_DATASET;

/** dev = os 40 textos do relatório; validation = o JSON independente (R9), conferido antes de usar. */
function resolveDataset(): readonly LayaCase[] {
  if (DATASET_NAME === "dev") return LAYA_DATASET;
  if (DATASET_NAME !== "validation") {
    throw new Error(`LAYA_DATASET=${DATASET_NAME} desconhecido. Use dev ou validation.`);
  }
  if (!existsSync(VALIDATION_FILE)) {
    throw new Error(`${VALIDATION_FILE} não encontrado. Veja scripts/experiments/data/README.md.`);
  }
  const cases = loadLayaDatasetFile(VALIDATION_FILE);
  const problems = checkDatasetIntegrity(cases, { minPerClass: 100, disjointFrom: LAYA_DATASET });
  if (problems.length > 0) {
    throw new Error(`conjunto de validação recusado:\n- ${problems.join("\n- ")}`);
  }
  return cases;
}
const DEMO_WARMUP = 10;
const DEMO_ENTRY = path.join("apps", "demo-api", "src", "index.ts");
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0";

async function assertReachable(url: string, hint: string): Promise<void> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(5_000) });
  } catch {
    throw new Error(`${url} recusou conexão. ${hint}`);
  }
}

/**
 * O texto que o sombra extrai do corpo de POST /api/chat ({ message }): o
 * script passa pelo mesmo extractInspectableText do SDK.
 */
function payloadFor(text: string): string {
  const payload = extractInspectableText({ message: text });
  if (payload === null) throw new Error(`texto sem conteúdo inspecionável: ${text.slice(0, 40)}`);
  return payload;
}

function inspect(text: string): Promise<LayaInspectionResult | null> {
  return inspectPayloadWithLaya(payloadFor(text), LAYA_URL, LAYA_API_KEY, LAYA_MODEL ? { model: LAYA_MODEL } : undefined);
}

/**
 * O sidecar roteia por idioma (ex.: "english" e "multilingual"). Um checkpoint
 * que ainda está carregando segura até as requisições do outro idioma, e na
 * 1ª execução isso virou timeout dentro da medição (relatório §8.1). O
 * aquecimento só termina quando cada checkpoint exigido respondeu.
 */
const WARMUP_TEXTS = [
  "Olá, qual o prazo de entrega para São Paulo?",
  "Hi, when will my order be shipped?",
];
/** Com LAYA_MODEL, o sidecar só usa aquele checkpoint; sem ele, os dois do roteamento. */
const REQUIRED_CHECKPOINTS: readonly string[] = LAYA_MODEL ? [LAYA_MODEL] : ["multilingual", "english"];
const WARMUP_DEADLINE_MS = 180_000;
const WARMUP_CALL_TIMEOUT_MS = 30_000;

async function warmUpSidecar(): Promise<{ elapsedMs: number; seen: string[] }> {
  const started = Date.now();
  const seen = new Set<string>();
  let valid = 0;
  for (let i = 0; Date.now() - started < WARMUP_DEADLINE_MS; i++) {
    const text = payloadFor(WARMUP_TEXTS[i % WARMUP_TEXTS.length]!);
    const result = await inspectPayloadWithLaya(text, LAYA_URL, LAYA_API_KEY, {
      timeoutMs: WARMUP_CALL_TIMEOUT_MS,
      ...(LAYA_MODEL ? { model: LAYA_MODEL } : {}),
    });
    if (result) {
      valid += 1;
      seen.add(result.modelUsed);
      if (pendingCheckpoints(seen, REQUIRED_CHECKPOINTS).length === 0) {
        return { elapsedMs: Date.now() - started, seen: [...seen] };
      }
    }
  }
  if (valid === 0) {
    throw new Error(
      "sidecar respondeu /health mas /v1/systemone falhou — confira LAYA_API_KEY"
    );
  }
  const pending = pendingCheckpoints(seen, REQUIRED_CHECKPOINTS);
  throw new Error(
    `aquecimento: sem resposta do(s) checkpoint(s) ${pending.join(", ")} em ${WARMUP_DEADLINE_MS / 1000} s. ` +
      "Confira LAYA_MODELS=multilingual,english e o log do sidecar."
  );
}

/**
 * Configurações comparadas na 4.1. `sdk` é a atual (é a que a demo-api usa
 * na 4.3/4.4); `baseline` é a cópia congelada de antes dos ajustes R1–R5.
 */
interface Variant {
  id: "sdk" | "baseline";
  label: string;
  inspect(text: string): Promise<LayaInspectionResult | null>;
  policy: VerdictPolicy;
}

const ALL_VARIANTS: readonly Variant[] = [
  { id: "sdk", label: "SDK atual (R1–R5)", inspect, policy: SDK_POLICY },
  {
    id: "baseline",
    label: "Linha de base (pré-R1)",
    inspect: (text) => inspectBaseline(text, LAYA_URL, LAYA_API_KEY),
    policy: BASELINE_POLICY,
  },
];

/** LAYA_VARIANTS (padrão "sdk,baseline"); `sdk` sempre roda, porque a 4.4 depende dele. */
function selectedVariants(): Variant[] {
  const wanted = new Set(
    (process.env.LAYA_VARIANTS ?? "sdk,baseline").split(",").map((v) => v.trim()).filter(Boolean)
  );
  wanted.add("sdk");
  return ALL_VARIANTS.filter((v) => wanted.has(v.id));
}

interface AccuracyRun {
  variant: Variant;
  verdicts: Map<string, CaseVerdict | null>;
  modelLatency: LatencySummary;
  models: Map<string, number>;
  failedCalls: number;
  report: AccuracyReport;
}

async function runAccuracyStage(variant: Variant): Promise<AccuracyRun> {
  const verdicts = new Map<string, CaseVerdict | null>();
  const latencies: number[] = [];
  const models = new Map<string, number>();
  let failedCalls = 0;

  for (const item of DATASET) {
    const runs: (LayaInspectionResult | null)[] = [];
    for (let rep = 0; rep < REPS; rep++) {
      const result = await variant.inspect(item.text);
      if (result) {
        latencies.push(result.latencyMs);
        models.set(result.modelUsed, (models.get(result.modelUsed) ?? 0) + 1);
      } else {
        failedCalls += 1;
      }
      runs.push(result);
    }
    verdicts.set(item.id, majorityVerdict(runs, variant.policy));
  }

  const report = buildAccuracyReport(
    DATASET.map((item) => ({ item, verdict: verdicts.get(item.id) ?? null }))
  );
  return { variant, verdicts, modelLatency: summarizeLatency(latencies), models, failedCalls, report };
}

function verdictLabel(verdict: CaseVerdict | null): string {
  if (!verdict) return "erro";
  if (!verdict.flagged) return "legítimo";
  return verdict.threatType ?? "ameaça";
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function printMetricsTable(title: string, m: ClassificationMetrics): void {
  console.log(`\n**${title}**\n`);
  console.log("| Métrica | Valor |");
  console.log("|---|---:|");
  console.log(`| TP | ${m.tp} |`);
  console.log(`| FP | ${m.fp} |`);
  console.log(`| FN | ${m.fn} |`);
  console.log(`| TN | ${m.tn} |`);
  console.log(`| Precisão | ${m.precision.toFixed(3)} |`);
  console.log(`| Recall | ${m.recall.toFixed(3)} |`);
  console.log(`| F1 | ${m.f1.toFixed(3)} |`);
  console.log(`| Youden | ${m.youden.toFixed(3)} |`);
}

function printLatencyRow(label: string, s: LatencySummary): void {
  console.log(`| ${label} | ${s.avg.toFixed(1)} | ${s.p50.toFixed(1)} | ${s.p95.toFixed(1)} |`);
}

function printAccuracy(run: AccuracyRun): void {
  const { verdicts, modelLatency, models, failedCalls, report } = run;
  console.log(`### 4.1 Acurácia — ${run.variant.label}\n`);
  console.log("| Caso | Idioma | Rótulo | Difícil | Veredito | noul PI | noul SL |");
  console.log("|---|---|---|---|---|---:|---:|");
  for (const item of DATASET) {
    const v = verdicts.get(item.id) ?? null;
    console.log(
      `| ${item.id} | ${item.lang} | ${item.label === "benign" ? "legítimo" : item.label} | ${item.hard ? "sim" : "não"} | ${verdictLabel(v)} | ${formatNoul(v?.piNoul ?? null, v?.piAbstained ?? false)} | ${formatNoul(v?.slNoul ?? null, v?.slAbstained ?? false)} |`
    );
  }

  console.log("\nNotas com 3 casas. (abst.) = o sidecar se absteve (confidence < min_confidence).");

  printMetricsTable("Binário (ameaça vs. legítimo)", report.binary);
  printMetricsTable("prompt_injection", report.promptInjection);
  printMetricsTable("secret_leak", report.secretLeak);

  console.log(
    `\nFalsos positivos em legítimos difíceis: ${report.hardBenign.falsePositives}/${report.hardBenign.total} · ` +
      `recall PT ${pct(report.recallByLang.pt)} · recall EN ${pct(report.recallByLang.en)} · ` +
      `textos instáveis entre repetições: ${REPS === 1 ? "n/a (1 repetição)" : `${report.unstable}/${report.evaluated}`} · ` +
      `textos sem nenhuma resposta (fora das métricas): ${report.transportErrors} · ` +
      `textos decididos com menos de ${REPS} execuções: ${report.partialTexts} · ` +
      `chamadas com falha (timeout/HTTP): ${failedCalls}/${DATASET.length * REPS} · ` +
      `tipo correto: ${report.typeCorrect.correct}/${report.typeCorrect.detected} ameaças detectadas`
  );

  const rows = DATASET.map((item) => ({ item, verdict: verdicts.get(item.id) ?? null }));
  console.log("\n**Calibração das notas** (p = noul mediano, y = rótulo do texto)\n");
  console.log("| Sinal | n | Brier | ECE (10 bins) |");
  console.log("|---|---:|---:|---:|");
  for (const signal of ["prompt_injection", "secret_leak"] as const) {
    const pairs = calibrationPairs(rows, signal);
    console.log(
      `| ${signal} | ${pairs.length} | ${brierScore(pairs).toFixed(3)} | ${expectedCalibrationError(pairs).toFixed(3)} |`
    );
  }

  console.log("\n### 4.2 Latência do modelo\n");
  console.log("| Alvo | média (ms) | p50 (ms) | p95 (ms) |");
  console.log("|---|---:|---:|---:|");
  printLatencyRow("Laya /v1/systemone", modelLatency);
  if (failedCalls > 0) {
    console.log(`\n${failedCalls} chamada(s) com falha ficam fora da latência acima (o SDK desiste em 8 s).`);
  }
  const routing = [...models.entries()].map(([name, n]) => `${name} ${n}`).join(" · ");
  console.log(`\nRoteamento do sidecar (chamadas por checkpoint): ${routing || "—"}`);
}

/** Mesmas métricas lado a lado, uma coluna por configuração. */
function printComparison(runs: AccuracyRun[]): void {
  if (runs.length < 2) return;
  console.log("\n### 4.1 Comparação entre configurações\n");
  console.log(`| Métrica | ${runs.map((r) => r.variant.label).join(" | ")} |`);
  console.log(`|---|${runs.map(() => "---:").join("|")}|`);
  const row = (label: string, value: (r: AccuracyRun) => string) =>
    console.log(`| ${label} | ${runs.map(value).join(" | ")} |`);
  row("TP / FP / FN / TN", ({ report: { binary: b } }) => `${b.tp} / ${b.fp} / ${b.fn} / ${b.tn}`);
  row("Precisão", (r) => r.report.binary.precision.toFixed(3));
  row("Recall", (r) => r.report.binary.recall.toFixed(3));
  row("F1", (r) => r.report.binary.f1.toFixed(3));
  row("Youden", (r) => r.report.binary.youden.toFixed(3));
  row("Recall prompt_injection", (r) => r.report.promptInjection.recall.toFixed(3));
  row("Recall secret_leak", (r) => r.report.secretLeak.recall.toFixed(3));
  row("FP em legítimos difíceis", (r) => `${r.report.hardBenign.falsePositives}/${r.report.hardBenign.total}`);
  row("Tipo correto", (r) => `${r.report.typeCorrect.correct}/${r.report.typeCorrect.detected}`);
  row("Latência do modelo, média (ms)", (r) => r.modelLatency.avg.toFixed(0));
  row("Latência do modelo, p95 (ms)", (r) => r.modelLatency.p95.toFixed(0));
}

// ── Demo-api como processo filho ───────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function answersOnPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "localhost", port });
    socket.setTimeout(1_000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function startDemoApi(withLaya: boolean): Promise<{ stop(): Promise<void> }> {
  if (!existsSync(DEMO_ENTRY)) {
    throw new Error(`${DEMO_ENTRY} não encontrado. Rode pela raiz do repo: pnpm experiment:laya`);
  }
  // Se algo já responde na porta, o /health abaixo mediria o servidor errado.
  if (await answersOnPort(DEMO_PORT)) {
    throw new Error(
      `a porta ${DEMO_PORT} já está em uso (talvez uma demo-api de execução anterior). Encerre-a ou troque EXPERIMENT_DEMO_PORT.`
    );
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(DEMO_PORT),
    RASP_MODE: "monitor",
    TRACEGUARD_ENDPOINT: `${API_URL}/api/v1/ingest`,
    // Sem isso, um backend com API_KEY recusa o ingest (401) e a 4.4 mostraria tudo como perdido.
    TRACEGUARD_API_KEY: process.env.TRACEGUARD_API_KEY ?? API_KEY,
  };
  if (withLaya) {
    env.LAYA_SIDECAR_URL = LAYA_URL;
    env.LAYA_API_KEY = LAYA_API_KEY;
  } else {
    delete env.LAYA_SIDECAR_URL;
    delete env.LAYA_API_KEY;
  }

  const child: ChildProcess = spawn(process.execPath, ["--import", "tsx", DEMO_ENTRY], {
    env,
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-2_000);
  });
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));

  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
  };

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const res = await fetch(`http://localhost:${DEMO_PORT}/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (res.ok && child.exitCode === null) return { stop };
    } catch {
      // ainda subindo
    }
    await sleep(250);
  }

  await stop();
  const tail = stderr.trim() ? `\n${stderr.trim()}` : "";
  throw new Error(
    `demo-api não respondeu em :${DEMO_PORT}/health. Rode pnpm build (a demo-api usa o dist do SDK) ou troque EXPERIMENT_DEMO_PORT.${tail}`
  );
}

let forwardedCounter = 0;

function nextForwardedFor(): string {
  forwardedCounter += 1;
  const n = forwardedCounter;
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
}

function newTraceparent(): { traceId: string; header: string } {
  const traceId = randomBytes(16).toString("hex");
  const spanId = randomBytes(8).toString("hex");
  return { traceId, header: `00-${traceId}-${spanId}-01` };
}

function postChat(
  message: string,
  opts: { traceparent?: string } = {}
): Promise<{ status: number; ms: number }> {
  const body = JSON.stringify({ message });
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const req = http.request(
      {
        hostname: "localhost",
        port: DEMO_PORT,
        path: "/api/chat",
        method: "POST",
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "application/json",
          "Accept-Language": "pt-BR,pt;q=0.9",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "X-Forwarded-For": nextForwardedFor(),
          ...(opts.traceparent ? { traceparent: opts.traceparent } : {}),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          const ms = performance.now() - started;
          if (res.statusCode !== 200) {
            reject(new Error(`POST /api/chat respondeu HTTP ${res.statusCode}`));
            return;
          }
          resolve({ status: res.statusCode, ms });
        });
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}

/**
 * Contadores do sombra (R8) lidos do /health da demo-api, depois que as
 * inspeções em voo terminam (scheduled = dropped + inspected + failed).
 */
async function readShadowStats(): Promise<LayaShadowCounters> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const res = await fetch(`http://localhost:${DEMO_PORT}/health`);
    const body = (await res.json()) as { laya?: LayaShadowCounters | null };
    const stats = body.laya;
    if (!stats) {
      throw new Error("o /health da demo-api não traz os contadores do Laya. Rode pnpm build (a demo-api usa o dist do SDK).");
    }
    if (stats.scheduled === stats.dropped + stats.inspected + stats.failed || Date.now() > deadline) return stats;
    await sleep(100);
  }
}

function printCoverage(label: string, c: LayaShadowCounters, sent: number): void {
  console.log(
    `${label}: inspecionadas ${c.inspected} de ${sent} · descartadas pelo gate ${c.dropped} · falhas ${c.failed} (timeout ${c.timedOut})`
  );
}

async function measureHotPath(afterWarmup?: () => Promise<void>): Promise<number[]> {
  for (let i = 0; i < DEMO_WARMUP; i++) {
    await postChat(DATASET[i % DATASET.length]!.text);
  }
  await afterWarmup?.();
  const samples: number[] = [];
  for (const item of DATASET) {
    for (let rep = 0; rep < HOT_PATH_REPS; rep++) {
      samples.push((await postChat(item.text)).ms);
    }
  }
  return samples;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function printHotPath(
  without: LatencySummary,
  burst: LatencySummary,
  paced: LatencySummary,
  pacedCount: number,
  pacingMs: number,
  coverage: { burst: LayaShadowCounters; paced: LayaShadowCounters }
): void {
  console.log("\n### 4.3 Custo no caminho quente\n");
  console.log(`demo-api em :${DEMO_PORT}, RASP_MODE=monitor\n`);
  console.log("| Alvo | amostras | média (ms) | p50 (ms) | p95 (ms) |");
  console.log("|---|---:|---:|---:|---:|");
  const row = (label: string, n: number, s: LatencySummary) =>
    console.log(`| ${label} | ${n} | ${s.avg.toFixed(1)} | ${s.p50.toFixed(1)} | ${s.p95.toFixed(1)} |`);
  row("POST /api/chat sem sidecar", DATASET.length * HOT_PATH_REPS, without);
  row("POST /api/chat com sidecar, ritmado (toda requisição inspecionada)", pacedCount, paced);
  row("POST /api/chat com sidecar, rajada (fila de 4 saturada)", DATASET.length * HOT_PATH_REPS, burst);
  console.log(
    `\nDiferença ritmado − sem: p50 ${signed(paced.p50 - without.p50)} ms · p95 ${signed(paced.p95 - without.p95)} ms`
  );
  console.log("\nCobertura do sombra (contadores do SDK, /health da demo-api):\n");
  printCoverage("Rajada", coverage.burst, DATASET.length * HOT_PATH_REPS);
  console.log("");
  printCoverage("Ritmado", coverage.paced, pacedCount);
  console.log(
    `\nA linha ritmada é o custo por requisição inspecionada: um envio a cada ${pacingMs} ms (p95 do modelo), então cada corpo chega ao sidecar enquanto a resposta já saiu. ` +
      "Na rajada, as requisições chegam a cada ~1 ms e o SDK descarta as que encontram as 4 vagas ocupadas: a maioria não é inspecionada. " +
      `As rodadas sem sidecar e em rajada têm ${DEMO_WARMUP} aquecimentos descartados; a disputa de CPU com o sidecar na mesma máquina entra nas linhas com sidecar.`
  );
}

async function fetchRaspEvents(): Promise<RaspEvent[]> {
  const res = await fetch(`${API_URL}/api/v1/rasp/events?limit=100`, {
    headers: API_KEY ? { "x-api-key": API_KEY } : {},
  });
  if (!res.ok) throw new Error(`GET /api/v1/rasp/events respondeu HTTP ${res.status}`);
  const data = (await res.json()) as { events: RaspEvent[] };
  return data.events;
}

async function runIntegrationStage(
  verdicts: Map<string, CaseVerdict | null>,
  pacingMs: number
): Promise<{ report: DeliveryReport; pacedSamples: number[] }> {
  const sent: SentCase[] = [];
  const pacedSamples: number[] = [];

  for (const item of DATASET) {
    const verdict = verdicts.get(item.id) ?? null;
    const { traceId, header } = newTraceparent();
    const record: SentCase = { caseId: item.id, traceId, sentAt: Date.now() };
    if (verdict?.flagged && verdict.threatType) record.expectedThreatType = verdict.threatType;
    sent.push(record);
    pacedSamples.push((await postChat(item.text, { traceparent: header })).ms);
    await sleep(pacingMs);
  }

  await sleep(pacingMs + 3_000);
  return { report: matchDeliveries(sent, await fetchRaspEvents()), pacedSamples };
}

function printIntegration(report: DeliveryReport, pacingMs: number): void {
  const delay = summarizeLatency(report.delaysMs);

  console.log("\n### 4.4 Integração por traceId\n");
  console.log(
    `Cada texto enviado uma vez com traceparent próprio · intervalo entre envios: ${pacingMs} ms (p95 do modelo)\n`
  );
  console.log("| Métrica | Valor |");
  console.log("|---|---:|");
  console.log(`| Esperados (marcados na 4.1) | ${report.expected} |`);
  console.log(`| Entregues com traceId correto | ${report.delivered} |`);
  console.log(`| Não chegaram ao backend | ${report.lost} |`);
  console.log(`| Tipo divergente da 4.1 | ${report.typeMismatch} |`);
  console.log(`| Eventos inesperados | ${report.unexpected} |`);
  console.log(`| Taxa de entrega | ${pct(report.deliveryRate)} |`);
  console.log(`| Atraso do sombra, média (ms) | ${delay.avg.toFixed(0)} |`);
  console.log(`| Atraso do sombra, p95 (ms) | ${delay.p95.toFixed(0)} |`);
  if (report.lostCaseIds.length > 0) {
    console.log(`\nNão chegaram: ${report.lostCaseIds.join(", ")}`);
  }
  console.log(
    "\nO esperado vem do veredito por maioria da 4.1; o sombra decide com uma única chamada. Um texto que não chegou pode ser perda no transporte (fila, timeout, flush) ou variação do modelo nessa chamada. O atraso vai do envio até o fim da classificação (timestamp do evento no SDK)."
  );
}

async function main(): Promise<void> {
  DATASET = resolveDataset();
  if (STAGES !== "all" && STAGES !== "accuracy") {
    throw new Error(`LAYA_STAGES=${STAGES} desconhecido. Use all ou accuracy.`);
  }
  if (STAGES === "all" && DATASET.length > MAX_INTEGRATION_TEXTS) {
    throw new Error(
      `a integração (4.4) confere no máximo ${MAX_INTEGRATION_TEXTS} textos e o conjunto tem ${DATASET.length}. ` +
        "Rode com LAYA_STAGES=accuracy."
    );
  }
  await assertReachable(
    `${LAYA_URL}/health`,
    "Suba o sidecar com: docker compose --profile laya up -d --build laya"
  );
  await assertReachable(`${API_URL}/health`, "Suba o backend com: pnpm dev:backend");
  const warmup = await warmUpSidecar();

  console.log("## Experimento 4 — Laya (sidecar em modo sombra)\n");
  console.log(`Sidecar: ${LAYA_URL}`);
  console.log(
    `Aquecimento: ${(warmup.elapsedMs / 1000).toFixed(1)} s · checkpoints: ${warmup.seen.join(", ")}`
  );
  console.log(`Backend: ${API_URL} · checkpoint: ${LAYA_MODEL ?? "roteamento por idioma"}`);
  console.log(
    `Conjunto: ${DATASET_NAME} · casos: ${DATASET.length} · repetições por caso: ${REPS} · limiar noul ≥ ${LAYA_NOUL_THRESHOLD.toFixed(2)} · etapas: ${STAGES}\n`
  );

  const runs: AccuracyRun[] = [];
  for (const variant of selectedVariants()) {
    const run = await runAccuracyStage(variant);
    printAccuracy(run);
    runs.push(run);
  }
  printComparison(runs);
  const { verdicts, modelLatency } = runs[0]!;
  if (STAGES === "accuracy") {
    console.log("\nEtapas 4.3 e 4.4 puladas (LAYA_STAGES=accuracy).");
    return;
  }
  const pacingMs = Math.max(100, Math.ceil(modelLatency.p95));

  const withoutDemo = await startDemoApi(false);
  let withoutSamples: number[];
  try {
    withoutSamples = await measureHotPath();
  } finally {
    await withoutDemo.stop();
  }

  const withDemo = await startDemoApi(true);
  try {
    let burstStart: LayaShadowCounters | undefined;
    const burstSamples = await measureHotPath(async () => {
      burstStart = await readShadowStats();
    });
    // A rajada deixa inspeções em voo; espera a fila esvaziar antes de medir a entrega.
    await sleep(pacingMs * 4);
    const burstEnd = await readShadowStats();
    const { report, pacedSamples } = await runIntegrationStage(verdicts, pacingMs);
    const pacedEnd = await readShadowStats();
    printHotPath(
      summarizeLatency(withoutSamples),
      summarizeLatency(burstSamples),
      summarizeLatency(pacedSamples),
      pacedSamples.length,
      pacingMs,
      { burst: diffShadowStats(burstStart!, burstEnd), paced: diffShadowStats(burstEnd, pacedEnd) }
    );
    printIntegration(report, pacingMs);
  } finally {
    await withDemo.stop();
  }

  console.log(
    "\nDocumente o hardware (CPU/RAM) na monografia. A acurácia vale para este dataset controlado; não generalize como desempenho em produção."
  );
}

main().catch((error) => {
  console.error("[experiment:laya]", error instanceof Error ? error.message : error);
  process.exit(1);
});
