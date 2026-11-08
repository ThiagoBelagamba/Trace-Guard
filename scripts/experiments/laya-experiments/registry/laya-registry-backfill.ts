/**
 * Registros retroativos C00–C09: re-pontua as saídas já salvas (sem sidecar)
 * e grava resultados/Cnn--<conjunto>.json com origem "extraido-de-saida".
 *
 * Uso: pnpm run experiment:laya:backfill
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { LAYA_DATASET, type LayaCase } from "../core/laya-dataset.ts";
import { loadLayaDatasetFile } from "../core/laya-dataset-loader.ts";
import { REGISTRY_DIR, VALIDATION_FILE } from "../paths.ts";
import {
  loadLayaConfig,
  type DatasetName,
  type LayaConfig,
  type LayaResult,
} from "./laya-registry.ts";
import {
  mergeScores,
  metricsFor,
  parseCaseScores,
  parseLatency,
  type OutputSection,
} from "./laya-rescore.ts";

interface Source {
  /** Saída bruta, relativa a REGISTRY_DIR. */
  file: string;
  section: OutputSection;
}

export interface BackfillEntry {
  config: string;
  conjunto: DatasetName;
  /** Fonte única, ou fonte da injeção quando há `slFrom`. */
  from: Source;
  /** Fonte do sinal de credencial (híbridos). */
  slFrom?: Source;
  /** Latência só vale quando a fonte é uma única saída com os mesmos limiares. */
  latency: boolean;
}

const out = (stem: string, section: OutputSection = "sdk"): Source => ({ file: `saidas/${stem}.md`, section });

export const BACKFILL: readonly BackfillEntry[] = [
  { config: "C00", conjunto: "dev", from: out("C01--dev", "baseline"), latency: true },
  { config: "C00", conjunto: "validation", from: out("C01--validation", "baseline"), latency: true },
  { config: "C01", conjunto: "dev", from: out("C01--dev"), latency: true },
  { config: "C01", conjunto: "validation", from: out("C01--validation"), latency: true },
  { config: "C02", conjunto: "validation", from: out("C02--validation"), latency: true },
  { config: "C03", conjunto: "validation", from: out("C03--validation"), latency: true },
  { config: "C04", conjunto: "validation", from: out("C04--validation"), latency: true },
  { config: "C05", conjunto: "validation", from: out("C05--validation"), latency: true },
  { config: "C06", conjunto: "validation", from: out("C01--validation"), latency: false },
  { config: "C07", conjunto: "validation", from: out("C01--validation"), slFrom: out("C02--validation"), latency: false },
  { config: "C08", conjunto: "validation", from: out("C03--validation"), slFrom: out("C02--validation"), latency: false },
  { config: "C09", conjunto: "validation", from: out("C02--validation"), latency: false },
];

type Reader = (rel: string) => string;

const readRegistry: Reader = (rel) => readFileSync(path.join(REGISTRY_DIR, rel), "utf8");

export function backfillResult(
  entry: BackfillEntry,
  config: LayaConfig,
  dataset: readonly LayaCase[],
  read: Reader = readRegistry
): LayaResult {
  const main = read(entry.from.file);
  const piScores = parseCaseScores(main, entry.from.section);
  const scores = entry.slFrom
    ? mergeScores(piScores, parseCaseScores(read(entry.slFrom.file), entry.slFrom.section))
    : piScores;
  const metricas = metricsFor(dataset, scores, config.limiares, config.variante);
  const latency = entry.latency ? parseLatency(main, entry.from.section) : null;
  if (latency) {
    metricas.latencyMeanMs = latency.meanMs;
    metricas.latencyP95Ms = latency.p95Ms;
  }
  return {
    config: entry.config,
    conjunto: entry.conjunto,
    data: "2026-11-08",
    commit_config: null,
    origem: "extraido-de-saida",
    saida: entry.from.file,
    metricas,
  };
}

export function backfillAll(read: Reader = readRegistry): LayaResult[] {
  const datasets: Partial<Record<DatasetName, readonly LayaCase[]>> = {
    dev: LAYA_DATASET,
    validation: loadLayaDatasetFile(VALIDATION_FILE),
  };
  return BACKFILL.map((entry) => {
    const dataset = datasets[entry.conjunto];
    if (!dataset) throw new Error(`${entry.config}: conjunto ${entry.conjunto} sem dados para re-pontuar`);
    return backfillResult(entry, loadLayaConfig(entry.config), dataset, read);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  for (const result of backfillAll()) {
    const file = path.join(REGISTRY_DIR, "resultados", `${result.config}--${result.conjunto}.json`);
    writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(`gravado ${file}`);
  }
}
