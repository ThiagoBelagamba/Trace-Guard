/**
 * Execução a partir de uma configuração registrada (LAYA_CONFIG=Cnn).
 * O JSON é a única fonte dos parâmetros; no conjunto de teste, ele precisa
 * estar commitado (o hash é a prova do pré-registro).
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  isHit,
  LAYA_NOUL_THRESHOLD,
  pickThreatType,
  type LayaThresholds,
} from "../../../../packages/sdk/src/rasp/laya-inspector.ts";
import { loadLayaConfig, type DatasetName, type LayaConfig, type ResultMetrics } from "./laya-registry.ts";
import type { AccuracyReport, LatencySummary, VerdictPolicy } from "../core/laya-stats.ts";


export interface RunPlan {
  config: LayaConfig;
  dataset: DatasetName;
}

const DATASETS: readonly DatasetName[] = ["dev", "validation", "test"];
const BASELINE_LIMIAR = 0.8;
const LOOSE_VARIABLES = ["LAYA_MODEL", "LAYA_VARIANTS", "LAYA_REPS"] as const;

/** null sem LAYA_CONFIG: o script segue com as variáveis avulsas de antes. */
export function resolveRunPlan(
  env: Record<string, string | undefined>,
  load: (id: string) => LayaConfig = (id) => loadLayaConfig(id)
): RunPlan | null {
  const id = env.LAYA_CONFIG?.trim();
  if (!id) return null;

  for (const name of LOOSE_VARIABLES) {
    if (env[name]?.trim()) {
      throw new Error(`${name} não pode ser usado com LAYA_CONFIG: o parâmetro vem do JSON da configuração ${id}`);
    }
  }
  const stages = env.LAYA_STAGES?.trim();
  if (stages && stages !== "accuracy") {
    throw new Error(`LAYA_STAGES=${stages} não pode ser usado com LAYA_CONFIG: o registro mede só a acurácia`);
  }

  const config = load(id);
  if (typeof config.checkpoint !== "string") {
    throw new Error(`${id}: checkpoint por pergunta (híbrido) não é executável; registre-o por re-pontuação`);
  }
  if (config.variante === "baseline") assertFrozenBaseline(config);

  const wanted = env.LAYA_DATASET?.trim() || config.conjunto_teste;
  if (!DATASETS.includes(wanted as DatasetName)) {
    throw new Error(`LAYA_DATASET=${wanted} desconhecido. Use ${DATASETS.join(", ")}.`);
  }
  return { config, dataset: wanted as DatasetName };
}

/**
 * A variante baseline (laya-baseline.ts) ignora checkpoint, min_confidence e
 * limiares do JSON; qualquer valor diferente do congelado seria um registro falso.
 */
function assertFrozenBaseline(config: LayaConfig): void {
  const problems: string[] = [];
  if (config.limiares.prompt_injection !== BASELINE_LIMIAR || config.limiares.secret_leak !== BASELINE_LIMIAR) {
    problems.push(`limiares ${BASELINE_LIMIAR} nas duas perguntas`);
  }
  if (config.checkpoint !== "roteamento") problems.push("checkpoint roteamento");
  if (config.min_confidence !== BASELINE_LIMIAR) problems.push(`min_confidence ${BASELINE_LIMIAR}`);
  if (config.padroes_credencial) problems.push("padroes_credencial false");
  if (problems.length > 0) {
    throw new Error(`${config.id}: a variante baseline é congelada; exige ${problems.join(", ")}`);
  }
}

/** Checkpoint enviado ao sidecar; "roteamento" deixa o sidecar escolher pelo idioma. */
export function modelFor(config: LayaConfig): string | undefined {
  return config.checkpoint === "roteamento" || typeof config.checkpoint !== "string" ? undefined : config.checkpoint;
}

type Git = (args: string[]) => string;

const runGit: Git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();

/** Hash do último commit que tocou o arquivo, ou null se nunca foi commitado. */
export function configCommit(file: string, git: Git = runGit): string | null {
  const hash = git(["log", "-1", "--format=%H", "--", file]).trim();
  return hash || null;
}

/** Hash do commit só quando o JSON está igual a ele; com mudança local, null. */
export function cleanCommit(file: string, git: Git = runGit): string | null {
  if (git(["status", "--porcelain", "--", file]).trim()) return null;
  return configCommit(file, git);
}

/** Revisão do código que executou (HEAD) e se havia mudança não commitada. */
export function codeRevision(git: Git = runGit): { commit: string; modificado: boolean } {
  return {
    commit: git(["rev-parse", "HEAD"]).trim(),
    modificado: git(["status", "--porcelain", "--untracked-files=no"]).trim() !== "",
  };
}

/** O conjunto de teste roda uma vez: um resultado existente não é sobrescrito. */
export function refuseTestOverwrite(
  dataset: DatasetName,
  resultFile: string,
  exists: (file: string) => boolean = existsSync
): void {
  if (dataset === "test" && exists(resultFile)) {
    throw new Error(`${resultFile} já existe: o conjunto de teste roda uma única vez por configuração`);
  }
}

/** Recusa um JSON com mudança pendente ou sem commit; devolve o hash do pré-registro. */
export function assertCommitted(file: string, git: Git = runGit): string {
  if (git(["status", "--porcelain", "--", file]).trim()) {
    throw new Error(`${file} tem mudanças não commitadas: commite o pré-registro antes de rodar no conjunto de teste`);
  }
  const hash = configCommit(file, git);
  if (!hash) throw new Error(`${file} não commitado: commite o pré-registro antes de rodar no conjunto de teste`);
  return hash;
}

export function sdkPolicy(t: LayaThresholds): VerdictPolicy {
  return {
    isHit: (signal, question) => isHit(signal, question ? t[question] : LAYA_NOUL_THRESHOLD),
    pickThreatType: (piHit, slHit) => pickThreatType(piHit, slHit),
  };
}

export function metricsFromReport(report: AccuracyReport, latency: LatencySummary | null): ResultMetrics {
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
    latencyMeanMs: latency ? latency.avg : null,
    latencyP95Ms: latency ? latency.p95 : null,
  };
}
