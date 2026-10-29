/**
 * Experimento 4 — Laya (sidecar em modo sombra)
 *
 * 4.1 Acurácia: dataset rotulado direto no sidecar, com o mesmo payload
 *     ({"message": texto}), limiar e perguntas do SDK (inspectPayloadWithLaya).
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
import path from "node:path";
import type { ClassificationMetrics } from "../../packages/shared/src/metrics.ts";
import type { RaspEvent } from "../../packages/shared/src/rasp.ts";
import {
  inspectPayloadWithLaya,
  LAYA_NOUL_THRESHOLD,
  type LayaInspectionResult,
} from "../../packages/sdk/src/rasp/laya-inspector.ts";
import { LAYA_DATASET } from "./laya-dataset.ts";
import {
  buildAccuracyReport,
  majorityVerdict,
  matchDeliveries,
  summarizeLatency,
  type CaseVerdict,
  type LatencySummary,
  type SentCase,
} from "./laya-stats.ts";

const LAYA_URL = (process.env.LAYA_SIDECAR_URL ?? "http://localhost:8000").replace(/\/$/, "");
const LAYA_API_KEY = process.env.LAYA_API_KEY ?? "traceguard-secret";
const API_URL = (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const API_KEY = process.env.API_KEY;
const DEMO_PORT = parseInt(process.env.EXPERIMENT_DEMO_PORT ?? "4100", 10);
const REPS = 3;
const SIDECAR_WARMUP = 3;
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
 * Classifica o texto como o SDK o envia em POST /api/chat: o sombra serializa
 * req.body inteiro, então o sidecar vê {"message":"..."} e não o texto cru.
 */
function inspect(text: string): Promise<LayaInspectionResult | null> {
  return inspectPayloadWithLaya(JSON.stringify({ message: text }), LAYA_URL, LAYA_API_KEY);
}

/**
 * O sidecar roteia por idioma (ex.: "english" e "multilingual") e baixa o
 * checkpoint na primeira chamada que cai nele. O aquecimento passa pelos dois
 * idiomas para que esse download não vire timeout dentro da medição.
 */
const WARMUP_TEXTS = [
  "Olá, qual o prazo de entrega para São Paulo?",
  "Hi, when will my order be shipped?",
];

async function warmUpSidecar(): Promise<void> {
  let ok = 0;
  for (let i = 0; i < SIDECAR_WARMUP * WARMUP_TEXTS.length; i++) {
    if (await inspect(WARMUP_TEXTS[i % WARMUP_TEXTS.length]!)) ok += 1;
  }
  if (ok === 0) {
    throw new Error(
      "sidecar respondeu /health mas /v1/systemone falhou — confira LAYA_API_KEY"
    );
  }
}

async function runAccuracyStage(): Promise<{
  verdicts: Map<string, CaseVerdict | null>;
  modelLatency: LatencySummary;
  models: Map<string, number>;
}> {
  const verdicts = new Map<string, CaseVerdict | null>();
  const latencies: number[] = [];
  const models = new Map<string, number>();

  for (const item of LAYA_DATASET) {
    const runs: (LayaInspectionResult | null)[] = [];
    for (let rep = 0; rep < REPS; rep++) {
      const result = await inspect(item.text);
      if (result) {
        latencies.push(result.latencyMs);
        models.set(result.modelUsed, (models.get(result.modelUsed) ?? 0) + 1);
      }
      runs.push(result);
    }
    verdicts.set(item.id, majorityVerdict(runs));
  }

  return { verdicts, modelLatency: summarizeLatency(latencies), models };
}

function fmtNoul(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
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

function printAccuracy(
  verdicts: Map<string, CaseVerdict | null>,
  modelLatency: LatencySummary,
  models: Map<string, number>
): void {
  console.log("### 4.1 Acurácia\n");
  console.log("| Caso | Idioma | Rótulo | Difícil | Veredito | noul PI | noul SL |");
  console.log("|---|---|---|---|---|---:|---:|");
  for (const item of LAYA_DATASET) {
    const v = verdicts.get(item.id) ?? null;
    console.log(
      `| ${item.id} | ${item.lang} | ${item.label === "benign" ? "legítimo" : item.label} | ${item.hard ? "sim" : "não"} | ${verdictLabel(v)} | ${fmtNoul(v?.piNoul ?? null)} | ${fmtNoul(v?.slNoul ?? null)} |`
    );
  }

  const report = buildAccuracyReport(
    LAYA_DATASET.map((item) => ({ item, verdict: verdicts.get(item.id) ?? null }))
  );

  printMetricsTable("Binário (ameaça vs. legítimo)", report.binary);
  printMetricsTable("prompt_injection", report.promptInjection);
  printMetricsTable("secret_leak", report.secretLeak);

  console.log(
    `\nFalsos positivos em legítimos difíceis: ${report.hardBenign.falsePositives}/${report.hardBenign.total} · ` +
      `recall PT ${pct(report.recallByLang.pt)} · recall EN ${pct(report.recallByLang.en)} · ` +
      `textos instáveis entre repetições: ${report.unstable}/${report.evaluated} · ` +
      `erros de transporte: ${report.transportErrors}`
  );

  console.log("\n### 4.2 Latência do modelo\n");
  console.log("| Alvo | média (ms) | p50 (ms) | p95 (ms) |");
  console.log("|---|---:|---:|---:|");
  printLatencyRow("Laya /v1/systemone", modelLatency);
  const routing = [...models.entries()].map(([name, n]) => `${name} ${n}`).join(" · ");
  console.log(`
Roteamento do sidecar (chamadas por checkpoint): ${routing || "—"}`);
}

// ── Demo-api como processo filho ───────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function startDemoApi(withLaya: boolean): Promise<{ stop(): Promise<void> }> {
  if (!existsSync(DEMO_ENTRY)) {
    throw new Error(`${DEMO_ENTRY} não encontrado. Rode pela raiz do repo: pnpm experiment:laya`);
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(DEMO_PORT),
    RASP_MODE: "monitor",
    TRACEGUARD_ENDPOINT: `${API_URL}/api/v1/ingest`,
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
      if (res.ok) return { stop };
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

async function measureHotPath(): Promise<number[]> {
  for (let i = 0; i < DEMO_WARMUP; i++) {
    await postChat(LAYA_DATASET[i % LAYA_DATASET.length]!.text);
  }
  const samples: number[] = [];
  for (const item of LAYA_DATASET) {
    for (let rep = 0; rep < REPS; rep++) {
      samples.push((await postChat(item.text)).ms);
    }
  }
  return samples;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function printHotPath(without: LatencySummary, withLaya: LatencySummary): void {
  console.log("\n### 4.3 Custo no caminho quente\n");
  console.log(
    `Amostras por rodada: ${LAYA_DATASET.length * REPS} (+${DEMO_WARMUP} de aquecimento descartadas) · demo-api em :${DEMO_PORT}, RASP_MODE=monitor\n`
  );
  console.log("| Alvo | média (ms) | p50 (ms) | p95 (ms) |");
  console.log("|---|---:|---:|---:|");
  printLatencyRow("POST /api/chat sem sidecar", without);
  printLatencyRow("POST /api/chat com sidecar", withLaya);
  console.log(
    `\nDiferença com − sem: p50 ${signed(withLaya.p50 - without.p50)} ms · p95 ${signed(withLaya.p95 - without.p95)} ms`
  );
  console.log(
    "\nNa rodada com sidecar as inspeções rodam em paralelo com as respostas (até 4 em voo), então a disputa de CPU com o sidecar na mesma máquina entra na medição."
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
  modelLatency: LatencySummary
): Promise<void> {
  const pacingMs = Math.max(100, Math.ceil(modelLatency.p95));
  const sent: SentCase[] = [];

  for (const item of LAYA_DATASET) {
    const verdict = verdicts.get(item.id) ?? null;
    const { traceId, header } = newTraceparent();
    const record: SentCase = { caseId: item.id, traceId, sentAt: Date.now() };
    if (verdict?.flagged && verdict.threatType) record.expectedThreatType = verdict.threatType;
    sent.push(record);
    await postChat(item.text, { traceparent: header });
    await sleep(pacingMs);
  }

  await sleep(Math.ceil(modelLatency.p95) + 3_000);
  const report = matchDeliveries(sent, await fetchRaspEvents());
  const delay = summarizeLatency(report.delaysMs);

  console.log("\n### 4.4 Integração por traceId\n");
  console.log(
    `Cada texto enviado uma vez com traceparent próprio · intervalo entre envios: ${pacingMs} ms (p95 do modelo)\n`
  );
  console.log("| Métrica | Valor |");
  console.log("|---|---:|");
  console.log(`| Esperados (marcados na 4.1) | ${report.expected} |`);
  console.log(`| Entregues com traceId correto | ${report.delivered} |`);
  console.log(`| Perdidos (fila, timeout ou flush) | ${report.lost} |`);
  console.log(`| Tipo divergente da 4.1 | ${report.typeMismatch} |`);
  console.log(`| Eventos inesperados | ${report.unexpected} |`);
  console.log(`| Taxa de entrega | ${pct(report.deliveryRate)} |`);
  console.log(`| Atraso do sombra, média (ms) | ${delay.avg.toFixed(0)} |`);
  console.log(`| Atraso do sombra, p95 (ms) | ${delay.p95.toFixed(0)} |`);
  if (report.lostCaseIds.length > 0) {
    console.log(`\nPerdidos: ${report.lostCaseIds.join(", ")}`);
  }
}

async function main(): Promise<void> {
  await assertReachable(
    `${LAYA_URL}/health`,
    "Suba o sidecar com: docker compose --profile laya up -d --build laya"
  );
  await assertReachable(`${API_URL}/health`, "Suba o backend com: pnpm dev:backend");
  await warmUpSidecar();

  console.log("## Experimento 4 — Laya (sidecar em modo sombra)\n");
  console.log(`Sidecar: ${LAYA_URL}`);
  console.log(`Backend: ${API_URL}`);
  console.log(
    `Casos: ${LAYA_DATASET.length} · repetições por caso: ${REPS} · limiar noul ≥ ${LAYA_NOUL_THRESHOLD.toFixed(2)}\n`
  );

  const { verdicts, modelLatency, models } = await runAccuracyStage();
  printAccuracy(verdicts, modelLatency, models);

  const withoutDemo = await startDemoApi(false);
  let withoutSamples: number[];
  try {
    withoutSamples = await measureHotPath();
  } finally {
    await withoutDemo.stop();
  }

  const withDemo = await startDemoApi(true);
  try {
    const withSamples = await measureHotPath();
    printHotPath(summarizeLatency(withoutSamples), summarizeLatency(withSamples));
    // A rodada anterior deixa inspeções em voo; espera a fila esvaziar antes de medir a entrega.
    await sleep(Math.ceil(modelLatency.p95) * 4);
    await runIntegrationStage(verdicts, modelLatency);
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
