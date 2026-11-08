/**
 * Re-pontuação: reconstrói vereditos a partir das tabelas por caso já salvas
 * pelo laya-eval (seção 4.1). Permite registrar configurações antigas e aplicar
 * limiares novos sem chamar o sidecar de novo.
 */
import {
  isHit,
  pickThreatType,
  type LayaSignal,
  type LayaThresholds,
} from "../../packages/sdk/src/rasp/laya-inspector.ts";
import { BASELINE_POLICY } from "./laya-baseline.ts";
import type { LayaCase } from "./laya-dataset.ts";
import type { ResultMetrics } from "./laya-registry.ts";
import { buildAccuracyReport, type CaseVerdict } from "./laya-stats.ts";

export interface CaseScore {
  id: string;
  piNoul: number | null;
  slNoul: number | null;
  piAbst: boolean;
  slAbst: boolean;
}

export type OutputSection = "sdk" | "baseline";

const SECTION_TITLE: Record<OutputSection, string> = {
  sdk: "### 4.1 Acurácia — SDK atual",
  baseline: "### 4.1 Acurácia — Linha de base",
};

/** Linhas da seção 4.1 da variante pedida, até a próxima seção 4.1 ou o fim. */
function sectionLines(markdown: string, section: OutputSection): string[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(SECTION_TITLE[section]));
  if (start < 0) throw new Error(`saída sem a seção "${SECTION_TITLE[section]}"`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("### 4.1"));
  return end < 0 ? rest : rest.slice(0, end);
}

function readCell(cell: string): { noul: number | null; abst: boolean } {
  const text = cell.trim();
  const abst = text.includes("(abst.)");
  const value = Number.parseFloat(text);
  return { noul: Number.isFinite(value) ? value : null, abst };
}

export function parseCaseScores(markdown: string, section: OutputSection): CaseScore[] {
  const scores: CaseScore[] = [];
  for (const line of sectionLines(markdown, section)) {
    const cells = line.split("|");
    // | id | idioma | rótulo | difícil | veredito | PI | SL |
    if (cells.length < 9 || !/^\s*[a-z]+-[a-z]+-\d+\s*$/i.test(cells[1] ?? "")) continue;
    const pi = readCell(cells[6] ?? "");
    const sl = readCell(cells[7] ?? "");
    scores.push({ id: cells[1]!.trim(), piNoul: pi.noul, piAbst: pi.abst, slNoul: sl.noul, slAbst: sl.abst });
  }
  return scores;
}

export function parseLatency(markdown: string, section: OutputSection): { meanMs: number; p95Ms: number } | null {
  const row = sectionLines(markdown, section).find((l) => l.startsWith("| Laya /v1/systemone"));
  if (!row) return null;
  const cells = row.split("|").map((c) => c.trim());
  const mean = Number.parseFloat(cells[2] ?? "");
  const p95 = Number.parseFloat(cells[4] ?? "");
  return Number.isFinite(mean) && Number.isFinite(p95) ? { meanMs: mean, p95Ms: p95 } : null;
}

function signal(noul: number | null, abst: boolean, question: LayaSignal["question"]): LayaSignal | undefined {
  if (noul === null) return undefined;
  return { noul, question, ...(abst ? { abstention: "abstained" } : {}) };
}

export function verdictFromScore(score: CaseScore, t: LayaThresholds, pick: "sdk" | "baseline"): CaseVerdict {
  const piHit = isHit(signal(score.piNoul, score.piAbst, "prompt_injection"), t.prompt_injection);
  const slHit = isHit(signal(score.slNoul, score.slAbst, "sensitive_data"), t.secret_leak);
  const threatType =
    pick === "sdk"
      ? pickThreatType(piHit, slHit)
      : BASELINE_POLICY.pickThreatType(piHit, slHit, score.piNoul, score.slNoul);
  const verdict: CaseVerdict = {
    flagged: piHit || slHit,
    piHit,
    slHit,
    piNoul: score.piNoul,
    slNoul: score.slNoul,
    piAbstained: score.piAbst,
    slAbstained: score.slAbst,
    validRuns: 1,
    totalRuns: 1,
    stable: true,
  };
  if (threatType) verdict.threatType = threatType;
  return verdict;
}

/** Injeção de `piFrom`, credencial de `slFrom`, casados por id (híbridos exploratórios). */
export function mergeScores(piFrom: CaseScore[], slFrom: CaseScore[]): CaseScore[] {
  const sl = new Map(slFrom.map((s) => [s.id, s]));
  return piFrom.map((p) => {
    const other = sl.get(p.id);
    if (!other) throw new Error(`mergeScores: caso ${p.id} ausente na fonte de credencial`);
    return { id: p.id, piNoul: p.piNoul, piAbst: p.piAbst, slNoul: other.slNoul, slAbst: other.slAbst };
  });
}

export function metricsFor(
  dataset: readonly LayaCase[],
  scores: CaseScore[],
  t: LayaThresholds,
  pick: "sdk" | "baseline"
): ResultMetrics {
  const byId = new Map(scores.map((s) => [s.id, s]));
  const report = buildAccuracyReport(
    dataset.map((item) => {
      const s = byId.get(item.id);
      return { item, verdict: s ? verdictFromScore(s, t, pick) : null };
    })
  );
  const b = report.binary;
  return {
    tp: b.tp,
    fp: b.fp,
    fn: b.fn,
    tn: b.tn,
    precision: b.precision,
    recall: b.recall,
    f1: b.f1,
    recallPi: report.promptInjection.recall,
    recallSl: report.secretLeak.recall,
    hardFp: report.hardBenign.falsePositives,
    hardTotal: report.hardBenign.total,
    latencyMeanMs: null,
    latencyP95Ms: null,
  };
}
