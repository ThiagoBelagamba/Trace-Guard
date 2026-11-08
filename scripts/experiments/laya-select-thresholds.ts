/**
 * Regra de seleção dos limiares da C10 (pré-registrada no spec de 08/11/2026):
 * grade por pergunta; restrição de taxa de FP em legítimos difíceis ≤ 0,17 no
 * pool de ajuste (dev + validation); maior F1; desempate por maior recall de
 * injeção, depois maior recall de credencial, depois menor soma de limiares.
 *
 * Uso: pnpm run experiment:laya:select [-- --write C10]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { LayaThresholds } from "../../packages/sdk/src/rasp/laya-inspector.ts";
import { LAYA_DATASET, type LayaCase } from "./laya-dataset.ts";
import { loadLayaDatasetFile } from "./laya-dataset-loader.ts";
import { configPath, REGISTRY_DIR, type ResultMetrics } from "./laya-registry.ts";
import { parseCaseScores, verdictFromScore, type CaseScore } from "./laya-rescore.ts";
import { configCommit } from "./laya-run-config.ts";

export const SELECTION_GRID = [0.85, 0.9, 0.93, 0.95, 0.97, 0.98, 0.99, 0.995, 0.999] as const;
/**
 * Teto revisto de 0,15 para 0,17 em 08/11/2026, antes do pré-registro da C10 e
 * sem ver o conjunto de teste: com 0,15 o pool escolhia recall de injeção 0,381,
 * abaixo da linha de base (ficha C10, seção 5).
 */
export const MAX_HARD_FP_RATE = 0.17;

export interface Selection {
  thresholds: LayaThresholds;
  metrics: ResultMetrics;
  /** Pares da grade que respeitam a restrição. */
  candidates: number;
}

export interface PoolPart {
  dataset: readonly LayaCase[];
  scores: CaseScore[];
}

/** Soma as contagens de todas as partes do pool antes de calcular taxas. */
export function poolMetrics(pool: readonly PoolPart[], t: LayaThresholds): ResultMetrics {
  let tp = 0, fp = 0, fn = 0, tn = 0, hardFp = 0, hardTotal = 0;
  let pi = 0, piHit = 0, sl = 0, slHit = 0;
  for (const part of pool) {
    const byId = new Map(part.scores.map((s) => [s.id, s]));
    for (const item of part.dataset) {
      const score = byId.get(item.id);
      if (!score) continue;
      const v = verdictFromScore(score, t, "sdk");
      if (item.label === "benign") {
        if (v.flagged) fp += 1;
        else tn += 1;
        if (item.hard) {
          hardTotal += 1;
          if (v.flagged) hardFp += 1;
        }
        continue;
      }
      if (v.flagged) tp += 1;
      else fn += 1;
      if (item.label === "prompt_injection") {
        pi += 1;
        if (v.piHit) piHit += 1;
      } else {
        sl += 1;
        if (v.slHit) slHit += 1;
      }
    }
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return {
    tp, fp, fn, tn, precision, recall, f1,
    recallPi: pi === 0 ? 0 : piHit / pi,
    recallSl: sl === 0 ? 0 : slHit / sl,
    hardFp, hardTotal,
    latencyMeanMs: null, latencyP95Ms: null,
  };
}

/**
 * Negativo quando `a` vem antes: maior F1, maior recall de injeção, maior
 * recall de credencial, menor soma de limiares e, por fim, menor limiar de injeção.
 */
export function compareSelections(a: Selection, b: Selection): number {
  const am = a.metrics, bm = b.metrics;
  if (am.f1 !== bm.f1) return bm.f1 - am.f1;
  if (am.recallPi !== bm.recallPi) return bm.recallPi - am.recallPi;
  if (am.recallSl !== bm.recallSl) return bm.recallSl - am.recallSl;
  const sum = (s: Selection) => s.thresholds.prompt_injection + s.thresholds.secret_leak;
  if (sum(a) !== sum(b)) return sum(a) - sum(b);
  return a.thresholds.prompt_injection - b.thresholds.prompt_injection;
}

/** Todos os pares que respeitam a restrição, do melhor para o pior. */
export function rankThresholds(
  pool: readonly PoolPart[],
  grid: readonly number[] = SELECTION_GRID,
  maxHardFpRate: number = MAX_HARD_FP_RATE
): Selection[] {
  const ok: Selection[] = [];
  for (const prompt_injection of grid) {
    for (const secret_leak of grid) {
      const thresholds = { prompt_injection, secret_leak };
      const metrics = poolMetrics(pool, thresholds);
      if (metrics.hardTotal > 0 && metrics.hardFp / metrics.hardTotal > maxHardFpRate + 1e-9) continue;
      ok.push({ thresholds, metrics, candidates: 0 });
    }
  }
  ok.sort(compareSelections);
  return ok.map((s) => ({ ...s, candidates: ok.length }));
}

export function selectThresholds(
  pool: readonly PoolPart[],
  grid: readonly number[] = SELECTION_GRID,
  maxHardFpRate: number = MAX_HARD_FP_RATE
): Selection | null {
  return rankThresholds(pool, grid, maxHardFpRate)[0] ?? null;
}

/** Grava os limiares no JSON da configuração; recusa um JSON já commitado (congelado). */
export function writeThresholds(
  id: string,
  thresholds: LayaThresholds,
  deps: { commitOf?: (file: string) => string | null } = {}
): void {
  const file = configPath(id);
  const commit = (deps.commitOf ?? configCommit)(file);
  if (commit) {
    throw new Error(`${file} já tem commit (${commit.slice(0, 7)}): configuração congelada, crie um id novo`);
  }
  const config = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  config.limiares = { prompt_injection: thresholds.prompt_injection, secret_leak: thresholds.secret_leak };
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

const VALIDATION_FILE = path.join("scripts", "experiments", "data", "laya-validation.json");
const fmt = (v: number) => v.toFixed(3).replace(".", ",");

function main(): void {
  const read = (stem: string) => readFileSync(path.join(REGISTRY_DIR, "saidas", `${stem}.md`), "utf8");
  const pool: PoolPart[] = [
    { dataset: LAYA_DATASET, scores: parseCaseScores(read("C02--dev"), "sdk") },
    { dataset: loadLayaDatasetFile(VALIDATION_FILE), scores: parseCaseScores(read("C02--validation"), "sdk") },
  ];
  const ranked = rankThresholds(pool);
  const best = ranked[0];
  if (!best) throw new Error(`nenhum par da grade respeita a taxa de FP em difíceis ≤ ${MAX_HARD_FP_RATE}`);

  console.log(`Pool: C02 em dev + validation · grade ${SELECTION_GRID.join(", ")} · FP em difíceis ≤ ${MAX_HARD_FP_RATE}`);
  console.log(`Pares que respeitam a restrição: ${best.candidates} de ${SELECTION_GRID.length ** 2}\n`);
  console.log("| # | Limiar PI | Limiar SL | F1 | Recall PI | Recall SL | FP difíceis |");
  console.log("|---:|---:|---:|---:|---:|---:|---:|");
  ranked.slice(0, 5).forEach((s, i) => {
    const m = s.metrics;
    console.log(
      `| ${i + 1} | ${s.thresholds.prompt_injection} | ${s.thresholds.secret_leak} | ${fmt(m.f1)} | ${fmt(m.recallPi)} | ${fmt(m.recallSl)} | ${m.hardFp}/${m.hardTotal} |`
    );
  });

  const writeIndex = process.argv.indexOf("--write");
  if (writeIndex >= 0) {
    const id = process.argv[writeIndex + 1];
    if (!id) throw new Error("--write precisa de um id (ex.: --write C10)");
    writeThresholds(id, best.thresholds);
    console.log(`\nLimiares gravados em ${configPath(id)}.`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error("[experiment:laya:select]", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
