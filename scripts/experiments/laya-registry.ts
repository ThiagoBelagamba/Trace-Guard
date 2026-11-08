/**
 * Registro de configurações do Experimento 4 (Laya).
 *
 * Cada configuração é um JSON em `configuracoes/Cnn.json`, pré-registrado por
 * commit antes de rodar. Cada execução gera `resultados/Cnn--<conjunto>.json`.
 * O índice e os vereditos saem destes arquivos (spec 2026-11-08).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { LayaThresholds } from "../../packages/sdk/src/rasp/laya-inspector.ts";

export const REGISTRY_DIR = path.join("docs", "tcc", "experimento-4-registro");

export type ConfigStatus = "referencia" | "pre-registrada" | "exploratoria";
export type Checkpoint = "roteamento" | "multilingual" | "english" | "multilingual-cal" | "english-cal";
export type DatasetName = "dev" | "validation" | "test";

export interface LayaConfig {
  id: string;
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
  referencia: string | null;
}

export interface ResultMetrics {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
  recallPi: number;
  recallSl: number;
  hardFp: number;
  hardTotal: number;
  latencyMeanMs: number | null;
  latencyP95Ms: number | null;
}

export interface LayaResult {
  config: string;
  conjunto: DatasetName;
  data: string;
  commit_config: string | null;
  origem: "execucao" | "extraido-de-saida";
  /** Caminho da saída bruta, relativo a REGISTRY_DIR. */
  saida: string;
  metricas: ResultMetrics;
}

export interface CriterionCheck {
  nome: string;
  valor: number;
  exigido: number;
  ok: boolean;
}

export interface CriterionVerdict {
  condicoes: CriterionCheck[];
  atende: boolean;
  rotulo: string;
}

const STATUSES: readonly ConfigStatus[] = ["referencia", "pre-registrada", "exploratoria"];
const CHECKPOINTS: readonly Checkpoint[] = ["roteamento", "multilingual", "english", "multilingual-cal", "english-cal"];
const DATASETS: readonly DatasetName[] = ["dev", "validation", "test"];
const ID = /^C\d{2}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isUnit(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

/** Valida um JSON de configuração; lança um Error que lista todos os problemas. */
export function parseLayaConfig(raw: unknown): LayaConfig {
  const problems: string[] = [];
  if (!isRecord(raw)) throw new Error("configuração: o conteúdo precisa ser um objeto JSON");
  const r = raw;

  if (typeof r.id !== "string" || !ID.test(r.id)) problems.push(`id: "${String(r.id)}" não segue Cnn`);
  if (typeof r.titulo !== "string" || !r.titulo.trim()) problems.push("titulo: obrigatório");
  if (!STATUSES.includes(r.status as ConfigStatus)) problems.push(`status: use ${STATUSES.join(", ")}`);
  if (!Array.isArray(r.motivada_por) || !r.motivada_por.every((m) => typeof m === "string" && ID.test(m))) {
    problems.push("motivada_por: lista de ids Cnn");
  }
  if (r.variante !== "sdk" && r.variante !== "baseline") problems.push("variante: use sdk ou baseline");

  if (isRecord(r.checkpoint)) {
    const c = r.checkpoint;
    if (!CHECKPOINTS.includes(c.prompt_injection as Checkpoint) || !CHECKPOINTS.includes(c.secret_leak as Checkpoint)) {
      problems.push("checkpoint: checkpoint desconhecido em prompt_injection ou secret_leak");
    }
    if (r.status !== "exploratoria") problems.push("checkpoint: por pergunta só em configuração exploratória");
  } else if (!CHECKPOINTS.includes(r.checkpoint as Checkpoint)) {
    problems.push(`checkpoint: use ${CHECKPOINTS.join(", ")}`);
  }

  const lim = isRecord(r.limiares) ? r.limiares : {};
  if (!isUnit(lim.prompt_injection)) problems.push("limiares.prompt_injection: número entre 0 e 1");
  if (!isUnit(lim.secret_leak)) problems.push("limiares.secret_leak: número entre 0 e 1");
  if (!isUnit(r.min_confidence)) problems.push("min_confidence: número entre 0 e 1");
  if (typeof r.padroes_credencial !== "boolean") problems.push("padroes_credencial: true ou false");
  if (!Array.isArray(r.conjunto_ajuste) || !r.conjunto_ajuste.every((d) => DATASETS.includes(d as DatasetName))) {
    problems.push(`conjunto_ajuste: lista com ${DATASETS.join(", ")}`);
  }
  if (!DATASETS.includes(r.conjunto_teste as DatasetName)) problems.push(`conjunto_teste: use ${DATASETS.join(", ")}`);
  if (r.criterio !== "tres-condicoes-v1") problems.push("criterio: só existe tres-condicoes-v1");

  if (r.status === "referencia") {
    if (r.referencia !== null) problems.push("referencia: null na própria referência");
  } else if (typeof r.referencia !== "string" || !ID.test(r.referencia)) {
    problems.push("referencia: id Cnn obrigatório fora do status referencia");
  }

  if (problems.length > 0) {
    throw new Error(`configuração ${String(r.id)} inválida:\n- ${problems.join("\n- ")}`);
  }
  return raw as unknown as LayaConfig;
}

export function configPath(id: string, dir: string = REGISTRY_DIR): string {
  return path.join(dir, "configuracoes", `${id}.json`);
}

export function loadLayaConfig(id: string, dir: string = REGISTRY_DIR): LayaConfig {
  const config = parseLayaConfig(JSON.parse(readFileSync(configPath(id, dir), "utf8")));
  if (config.id !== id) throw new Error(`${configPath(id, dir)}: id interno ${config.id} difere do nome do arquivo`);
  return config;
}

function jsonFiles(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

export function loadAllConfigs(dir: string = REGISTRY_DIR): LayaConfig[] {
  return jsonFiles(path.join(dir, "configuracoes")).map((f) => loadLayaConfig(f.replace(/\.json$/, ""), dir));
}

const DATASET_ORDER: Record<DatasetName, number> = { dev: 0, validation: 1, test: 2 };

export function loadAllResults(dir: string = REGISTRY_DIR): LayaResult[] {
  const results = jsonFiles(path.join(dir, "resultados")).map(
    (f) => JSON.parse(readFileSync(path.join(dir, "resultados", f), "utf8")) as LayaResult
  );
  return results.sort(
    (a, b) => a.config.localeCompare(b.config) || DATASET_ORDER[a.conjunto] - DATASET_ORDER[b.conjunto]
  );
}

export function hardFpRate(m: ResultMetrics): number {
  return m.hardTotal === 0 ? 0 : m.hardFp / m.hardTotal;
}

const EPS = 1e-9;

/**
 * Critério tres-condicoes-v1 (relatório §14.1), contra a referência no mesmo conjunto.
 * "passou"/"não passou" só para configuração pré-registrada no seu conjunto de teste.
 */
export function evaluateCriterion(config: LayaConfig, candidate: LayaResult, reference: LayaResult): CriterionVerdict {
  if (candidate.conjunto !== reference.conjunto) {
    throw new Error(
      `${candidate.config} (${candidate.conjunto}) e ${reference.config} (${reference.conjunto}): o critério só compara resultados do mesmo conjunto`
    );
  }
  const c = candidate.metricas;
  const r = reference.metricas;
  const condicoes: CriterionCheck[] = [
    { nome: "F1 binário", valor: c.f1, exigido: r.f1 + 0.1, ok: c.f1 >= r.f1 + 0.1 - EPS },
    { nome: "Recall de secret_leak", valor: c.recallSl, exigido: r.recallSl + 0.2, ok: c.recallSl >= r.recallSl + 0.2 - EPS },
    {
      nome: "Taxa de FP em legítimos difíceis",
      valor: hardFpRate(c),
      exigido: hardFpRate(r) + 0.05,
      ok: hardFpRate(c) <= hardFpRate(r) + 0.05 + EPS,
    },
  ];
  const atende = condicoes.every((x) => x.ok);
  const formal = config.status === "pre-registrada" && candidate.conjunto === config.conjunto_teste;
  const rotulo = formal
    ? atende ? "passou" : "não passou"
    : atende ? "atende numericamente (sem pré-registro)" : "não atende";
  return { condicoes, atende, rotulo };
}

/** Intervalo de Wilson para k sucessos em n (95% com z = 1,96). */
export function wilsonInterval(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

function num(v: number | null, digits = 3): string {
  return v === null ? "—" : v.toFixed(digits).replace(".", ",");
}

function describeCheckpoint(c: LayaConfig["checkpoint"]): string {
  return typeof c === "string" ? c : `PI ${c.prompt_injection} · SL ${c.secret_leak}`;
}

function verdictCell(config: LayaConfig, r: LayaResult, byKey: Map<string, LayaResult>): string {
  if (config.status === "referencia") return "referência";
  const ref = config.referencia ? byKey.get(`${config.referencia}--${r.conjunto}`) : undefined;
  return ref ? evaluateCriterion(config, r, ref).rotulo : "—";
}

const HEADER =
  "| Id | Configuração | Status | Checkpoint | Limiar PI / SL | Conjunto | F1 | Recall SL | Recall PI | FP difíceis | Latência média (ms) | Veredito |\n" +
  "|---|---|---|---|---|---|---:|---:|---:|---:|---:|---|";

/** Índice comparativo (indice.md), gerado a partir dos JSON do registro. */
export function buildIndex(configs: LayaConfig[], results: LayaResult[]): string {
  const byId = new Map(configs.map((c) => [c.id, c]));
  const byKey = new Map(results.map((r) => [`${r.config}--${r.conjunto}`, r]));
  const row = (r: LayaResult): string | null => {
    const c = byId.get(r.config);
    if (!c) return null;
    const m = r.metricas;
    return [
      "",
      ` ${c.id} `,
      ` ${c.titulo} `,
      ` ${c.status} `,
      ` ${describeCheckpoint(c.checkpoint)} `,
      ` ${num(c.limiares.prompt_injection)} / ${num(c.limiares.secret_leak)} `,
      ` ${r.conjunto} `,
      ` ${num(m.f1)} `,
      ` ${num(m.recallSl)} `,
      ` ${num(m.recallPi)} `,
      ` ${m.hardFp}/${m.hardTotal} `,
      ` ${num(m.latencyMeanMs, 0)} `,
      ` ${verdictCell(c, r, byKey)} `,
      "",
    ].join("|");
  };
  const formal = results.filter((r) => byId.get(r.config)?.status !== "exploratoria").map(row).filter(Boolean);
  const explo = results.filter((r) => byId.get(r.config)?.status === "exploratoria").map(row).filter(Boolean);

  return [
    "# Registro de configurações — Experimento 4 (Laya)",
    "",
    "Gerado por `pnpm run experiment:laya:index`. Não editar à mão.",
    "",
    "Critério `tres-condicoes-v1` contra a referência no mesmo conjunto. Só configurações pré-registradas, no seu conjunto de teste, recebem \"passou\" ou \"não passou\".",
    "",
    "## Pré-registradas e referência",
    "",
    HEADER,
    ...formal,
    "",
    "## Exploratórias (sem pré-registro)",
    "",
    "Definidas depois de ver os dados. Nunca recebem \"passou\".",
    "",
    HEADER,
    ...explo,
    "",
  ].join("\n");
}
