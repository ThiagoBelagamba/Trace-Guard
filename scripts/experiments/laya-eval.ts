/**
 * Experimento 4 — Laya (sidecar em modo sombra)
 *
 * 4.1 Acurácia: dataset rotulado direto no sidecar, com o mesmo limiar e as
 *     mesmas perguntas do SDK (inspectPayloadWithLaya).
 * 4.2 Latência do modelo em /v1/systemone.
 *
 * Requer: sidecar Laya (docker compose --profile laya up -d --build laya)
 * e backend (pnpm dev:backend).
 *
 * Uso: pnpm experiment:laya
 */
import type { ClassificationMetrics } from "../../packages/shared/src/metrics.ts";
import {
  inspectPayloadWithLaya,
  LAYA_NOUL_THRESHOLD,
  type LayaInspectionResult,
} from "../../packages/sdk/src/rasp/laya-inspector.ts";
import { LAYA_DATASET } from "./laya-dataset.ts";
import {
  buildAccuracyReport,
  majorityVerdict,
  summarizeLatency,
  type CaseVerdict,
  type LatencySummary,
} from "./laya-stats.ts";

const LAYA_URL = (process.env.LAYA_SIDECAR_URL ?? "http://localhost:8000").replace(/\/$/, "");
const LAYA_API_KEY = process.env.LAYA_API_KEY ?? "traceguard-secret";
const API_URL = (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const REPS = 3;
const SIDECAR_WARMUP = 3;

async function assertReachable(url: string, hint: string): Promise<void> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(5_000) });
  } catch {
    throw new Error(`${url} recusou conexão. ${hint}`);
  }
}

function inspect(text: string): Promise<LayaInspectionResult | null> {
  return inspectPayloadWithLaya(text, LAYA_URL, LAYA_API_KEY);
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
}

main().catch((error) => {
  console.error("[experiment:laya]", error instanceof Error ? error.message : error);
  process.exit(1);
});
