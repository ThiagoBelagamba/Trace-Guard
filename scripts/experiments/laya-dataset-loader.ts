/**
 * Conjunto de validação do Experimento 4 (R9): JSON escrito por outra pessoa,
 * carregado e conferido antes de qualquer chamada ao sidecar.
 *
 * Prefixos de provedor entram como placeholders ({{AWS}}, {{GH}}, {{STRIPE}})
 * para o arquivo não casar com o secret scanning do GitHub.
 */
import { readFileSync } from "node:fs";
import { LAYA_MAX_PAYLOAD_CHARS } from "../../packages/sdk/src/rasp/laya-shadow.ts";
import type { LayaCase, LayaLabel } from "./laya-dataset.ts";

const LABELS: readonly LayaLabel[] = ["prompt_injection", "secret_leak", "benign"];
const PLACEHOLDERS: Record<string, string> = {
  "{{AWS}}": "AK" + "IA",
  "{{GH}}": "gh" + "p_",
  "{{STRIPE}}": "sk" + "_live_",
};
const MIN_HARD_BENIGN_SHARE = 0.4;
const LANG_SHARE_RANGE = [0.4, 0.6] as const;

function expandPlaceholders(text: string): string {
  let out = text;
  for (const [token, value] of Object.entries(PLACEHOLDERS)) out = out.split(token).join(value);
  return out;
}

function toCase(raw: unknown, index: number): LayaCase {
  const value = (raw ?? {}) as Record<string, unknown>;
  const name = typeof value.id === "string" && value.id ? value.id : `#${index}`;
  const fail = (field: string) => {
    throw new Error(`caso ${index} (${name}): campo "${field}" inválido`);
  };
  if (typeof value.id !== "string" || !value.id) fail("id");
  if (value.lang !== "pt" && value.lang !== "en") fail("lang");
  if (!LABELS.includes(value.label as LayaLabel)) fail("label");
  if (typeof value.hard !== "boolean") fail("hard");
  if (typeof value.category !== "string" || !value.category) fail("category");
  if (typeof value.text !== "string") fail("text");
  return {
    id: value.id as string,
    lang: value.lang as LayaCase["lang"],
    label: value.label as LayaLabel,
    hard: value.hard as boolean,
    category: value.category as string,
    text: expandPlaceholders(value.text as string),
  };
}

export function loadLayaDatasetFile(file: string): LayaCase[] {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${file}: o conteúdo precisa ser um array JSON de casos`);
  return parsed.map(toCase);
}

export interface IntegrityOptions {
  minPerClass: number;
  /** Mínimo absoluto de legítimos difíceis (conjunto de teste). */
  minHardBenign?: number;
  /** Conjuntos anteriores (desenvolvimento, validação) que não podem se repetir. */
  disjointFrom?: readonly LayaCase[];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Uma frase por problema; lista vazia quer dizer que o conjunto pode ser usado. */
export function checkDatasetIntegrity(cases: readonly LayaCase[], opts: IntegrityOptions): string[] {
  const problems: string[] = [];

  for (const label of LABELS) {
    const n = cases.filter((c) => c.label === label).length;
    if (n < opts.minPerClass) problems.push(`${label}: ${n} casos, mínimo ${opts.minPerClass}`);
  }

  const benign = cases.filter((c) => c.label === "benign");
  const hard = benign.filter((c) => c.hard).length;
  if (benign.length > 0 && hard / benign.length < MIN_HARD_BENIGN_SHARE) {
    problems.push(`legítimos difíceis: ${hard}/${benign.length}, mínimo ${MIN_HARD_BENIGN_SHARE * 100}%`);
  }
  if (opts.minHardBenign !== undefined && hard < opts.minHardBenign) {
    problems.push(`legítimos difíceis: ${hard}, mínimo ${opts.minHardBenign}`);
  }

  const seen = new Set<string>();
  for (const c of cases) {
    if (seen.has(c.id)) problems.push(`id repetido: ${c.id}`);
    seen.add(c.id);
    if (c.label === "secret_leak" && !/example/i.test(c.text)) {
      problems.push(`${c.id}: credencial sem o marcador EXAMPLE`);
    }
    if (!c.text.trim() || c.text.length > LAYA_MAX_PAYLOAD_CHARS) {
      problems.push(`${c.id}: texto vazio ou maior que ${LAYA_MAX_PAYLOAD_CHARS} caracteres`);
    }
  }

  if (cases.length > 0) {
    const ptShare = cases.filter((c) => c.lang === "pt").length / cases.length;
    if (ptShare < LANG_SHARE_RANGE[0] || ptShare > LANG_SHARE_RANGE[1]) {
      problems.push(`idiomas desequilibrados: ${(ptShare * 100).toFixed(0)}% PT (esperado 40–60%)`);
    }
  }

  if (opts.disjointFrom) {
    const devIds = new Set(opts.disjointFrom.map((c) => c.id));
    const devTexts = new Set(opts.disjointFrom.map((c) => normalize(c.text)));
    for (const c of cases) {
      if (devIds.has(c.id)) problems.push(`${c.id}: id já usado num conjunto anterior (desenvolvimento ou validação)`);
      if (devTexts.has(normalize(c.text))) problems.push(`${c.id}: texto igual a um de conjunto anterior (desenvolvimento ou validação)`);
    }
  }

  return problems;
}
