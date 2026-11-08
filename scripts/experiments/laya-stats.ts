/**
 * Funções puras do Experimento 4 (Laya): veredito por maioria, métricas de
 * classificação, resumo de latência e conferência de entrega por traceId.
 */
import {
  computeClassificationMetrics,
  type ClassificationMetrics,
} from "../../packages/shared/src/metrics.ts";
import type { RaspEvent } from "../../packages/shared/src/rasp.ts";
import {
  isHit,
  pickThreatType,
  type LayaInspectionResult,
  type LayaSignal,
} from "../../packages/sdk/src/rasp/laya-inspector.ts";
import type { LayaCase } from "./laya-dataset.ts";

type SemanticThreat = "prompt_injection" | "secret_leak";

export interface LatencySummary {
  avg: number;
  p50: number;
  p95: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

export function summarizeLatency(samples: number[]): LatencySummary {
  if (samples.length === 0) return { avg: 0, p50: 0, p95: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return { avg, p50: percentile(sorted, 50), p95: percentile(sorted, 95) };
}

export interface CaseVerdict {
  flagged: boolean;
  piHit: boolean;
  slHit: boolean;
  threatType?: SemanticThreat;
  piNoul: number | null;
  slNoul: number | null;
  /** Maioria estrita das execuções válidas com o sinal marcado "abstained". */
  piAbstained: boolean;
  slAbstained: boolean;
  validRuns: number;
  totalRuns: number;
  stable: boolean;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Regras de decisão de uma configuração: limiar (isHit) e escolha do tipo. */
export interface VerdictPolicy {
  isHit(signal: LayaSignal | undefined): boolean;
  pickThreatType(
    piHit: boolean,
    slHit: boolean,
    piNoul: number | null,
    slNoul: number | null
  ): SemanticThreat | undefined;
}

/** As regras do SDK atual (limiar 0,85 e prioridade para secret_leak). */
export const SDK_POLICY: VerdictPolicy = {
  isHit,
  pickThreatType: (piHit, slHit) => pickThreatType(piHit, slHit),
};

/** Maioria estrita das execuções válidas; empate conta como não marcado. */
export function majorityVerdict(
  runs: (LayaInspectionResult | null)[],
  policy: VerdictPolicy = SDK_POLICY
): CaseVerdict | null {
  const valid = runs.filter((r): r is LayaInspectionResult => r !== null);
  if (valid.length === 0) return null;

  const majority = (count: number) => count > valid.length / 2;
  const flaggedCount = valid.filter((r) => r.flagged).length;
  const piHit = majority(valid.filter((r) => policy.isHit(r.signals.prompt_injection)).length);
  const slHit = majority(valid.filter((r) => policy.isHit(r.signals.secret_leak)).length);
  const piAbstained = majority(valid.filter((r) => r.signals.prompt_injection?.abstention === "abstained").length);
  const slAbstained = majority(valid.filter((r) => r.signals.secret_leak?.abstention === "abstained").length);
  const flagged = majority(flaggedCount);

  const piNoul = median(valid.flatMap((r) => (r.signals.prompt_injection ? [r.signals.prompt_injection.noul] : [])));
  const slNoul = median(valid.flatMap((r) => (r.signals.secret_leak ? [r.signals.secret_leak.noul] : [])));

  const threatType = policy.pickThreatType(piHit, slHit, piNoul, slNoul);

  const verdict: CaseVerdict = {
    flagged,
    piHit,
    slHit,
    piNoul,
    slNoul,
    piAbstained,
    slAbstained,
    validRuns: valid.length,
    totalRuns: runs.length,
    stable: flaggedCount === 0 || flaggedCount === valid.length,
  };
  if (threatType) verdict.threatType = threatType;
  return verdict;
}

/** Nota com 3 casas; "(abst.)" quando o sidecar se absteve. */
export function formatNoul(noul: number | null, abstained: boolean): string {
  if (noul === null) return "—";
  return abstained ? `${noul.toFixed(3)} (abst.)` : noul.toFixed(3);
}

export interface AccuracyReport {
  evaluated: number;
  transportErrors: number;
  binary: ClassificationMetrics;
  promptInjection: ClassificationMetrics;
  secretLeak: ClassificationMetrics;
  hardBenign: { total: number; falsePositives: number };
  recallByLang: { pt: number; en: number };
  unstable: number;
  /** Textos decididos com menos execuções válidas do que as pedidas (timeouts parciais). */
  partialTexts: number;
  /** Ameaças marcadas cujo tipo atribuído é igual ao rótulo. */
  typeCorrect: { correct: number; detected: number };
}

function recallFor(rows: { item: LayaCase; verdict: CaseVerdict }[], lang: LayaCase["lang"]): number {
  const threats = rows.filter((r) => r.item.lang === lang && r.item.label !== "benign");
  if (threats.length === 0) return 0;
  return threats.filter((r) => r.verdict.flagged).length / threats.length;
}

export function buildAccuracyReport(
  rows: { item: LayaCase; verdict: CaseVerdict | null }[]
): AccuracyReport {
  const evaluated = rows.filter(
    (r): r is { item: LayaCase; verdict: CaseVerdict } => r.verdict !== null
  );
  const hard = evaluated.filter((r) => r.item.label === "benign" && r.item.hard);
  const detectedThreats = evaluated.filter((r) => r.item.label !== "benign" && r.verdict.flagged);

  return {
    evaluated: evaluated.length,
    transportErrors: rows.length - evaluated.length,
    binary: computeClassificationMetrics(
      evaluated.map((r) => ({ expectedThreat: r.item.label !== "benign", detected: r.verdict.flagged }))
    ),
    promptInjection: computeClassificationMetrics(
      evaluated.map((r) => ({ expectedThreat: r.item.label === "prompt_injection", detected: r.verdict.piHit }))
    ),
    secretLeak: computeClassificationMetrics(
      evaluated.map((r) => ({ expectedThreat: r.item.label === "secret_leak", detected: r.verdict.slHit }))
    ),
    hardBenign: { total: hard.length, falsePositives: hard.filter((r) => r.verdict.flagged).length },
    recallByLang: { pt: recallFor(evaluated, "pt"), en: recallFor(evaluated, "en") },
    unstable: evaluated.filter((r) => !r.verdict.stable).length,
    partialTexts: evaluated.filter((r) => r.verdict.validRuns < r.verdict.totalRuns).length,
    typeCorrect: {
      correct: detectedThreats.filter((r) => r.verdict.threatType === r.item.label).length,
      detected: detectedThreats.length,
    },
  };
}

export interface SentCase {
  caseId: string;
  traceId: string;
  sentAt: number;
  expectedThreatType?: SemanticThreat;
}

export interface DeliveryReport {
  expected: number;
  delivered: number;
  lost: number;
  typeMismatch: number;
  unexpected: number;
  deliveryRate: number;
  delaysMs: number[];
  lostCaseIds: string[];
}

export function matchDeliveries(sent: SentCase[], events: RaspEvent[]): DeliveryReport {
  const sentByTrace = new Map(sent.map((s) => [s.traceId, s]));
  const firstLayaEvent = new Map<string, RaspEvent>();
  for (const ev of events) {
    if (ev.metadata?.source !== "laya" || !sentByTrace.has(ev.traceId)) continue;
    if (!firstLayaEvent.has(ev.traceId)) firstLayaEvent.set(ev.traceId, ev);
  }

  const expected = sent.filter((s) => s.expectedThreatType);
  let delivered = 0;
  let typeMismatch = 0;
  const delaysMs: number[] = [];
  const lostCaseIds: string[] = [];
  for (const s of expected) {
    const ev = firstLayaEvent.get(s.traceId);
    if (!ev) {
      lostCaseIds.push(s.caseId);
      continue;
    }
    delivered += 1;
    if (ev.threatType !== s.expectedThreatType) typeMismatch += 1;
    delaysMs.push(Date.parse(ev.timestamp) - s.sentAt);
  }

  const unexpected = sent.filter((s) => !s.expectedThreatType && firstLayaEvent.has(s.traceId)).length;

  return {
    expected: expected.length,
    delivered,
    lost: expected.length - delivered,
    typeMismatch,
    unexpected,
    deliveryRate: expected.length === 0 ? 0 : delivered / expected.length,
    delaysMs,
    lostCaseIds,
  };
}

/** Checkpoints exigidos que ainda não responderam, na ordem de `required`. */
export function pendingCheckpoints(seen: ReadonlySet<string>, required: readonly string[]): string[] {
  return required.filter((name) => !seen.has(name));
}
