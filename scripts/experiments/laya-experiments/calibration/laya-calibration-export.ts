/**
 * R6 — exporta o conjunto de desenvolvimento como registros rotulados para o
 * ajuste de temperatura (docker/laya/calibrate.py). O ajuste usa só estes 40
 * textos; a avaliação fica para o conjunto de validação, sem vazamento.
 *
 * Uso: pnpm experiment:laya:export-calibration
 * Saída: .cache/laya/calibration/dev.jsonl (o volume do sidecar).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { LayaQuestionId } from "../../../../packages/sdk/src/rasp/laya-inspector.ts";
import { extractInspectableText } from "../../../../packages/sdk/src/rasp/laya-shadow.ts";
import { LAYA_DATASET, type LayaCase } from "../core/laya-dataset.ts";

const OUT_FILE = path.join(".cache", "laya", "calibration", "dev.jsonl");

/** Resposta correta de cada pergunta do preset para o rótulo do texto. */
export function calibrationTargets(item: LayaCase): Record<LayaQuestionId, boolean> {
  const injection = item.label === "prompt_injection";
  return {
    jailbreak: injection,
    prompt_injection: injection,
    sensitive_data: item.label === "secret_leak",
  };
}

export interface CalibrationRecord {
  id: string;
  state: { prompt: string };
  targets: Record<LayaQuestionId, boolean>;
}

export function calibrationRecord(item: LayaCase): CalibrationRecord {
  const prompt = extractInspectableText({ message: item.text });
  if (prompt === null) throw new Error(`${item.id}: texto sem conteúdo inspecionável`);
  return { id: item.id, state: { prompt }, targets: calibrationTargets(item) };
}

function main(): void {
  mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const lines = LAYA_DATASET.map((item) => JSON.stringify(calibrationRecord(item)));
  writeFileSync(OUT_FILE, `${lines.join("\n")}\n`, "utf8");
  console.log(`${lines.length} registros em ${OUT_FILE}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
