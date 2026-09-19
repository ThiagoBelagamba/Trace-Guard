export interface ClassificationCase {
  expectedThreat: boolean;
  detected: boolean;
}

export interface ClassificationMetrics {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
  youden: number;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Métricas de classificação para o experimento RASP (TCC).
 * Youden = TPR − FPR, o índice usado em avaliações OWASP Benchmark.
 */
export function computeClassificationMetrics(
  cases: ClassificationCase[]
): ClassificationMetrics {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  for (const row of cases) {
    if (row.expectedThreat && row.detected) tp += 1;
    else if (!row.expectedThreat && row.detected) fp += 1;
    else if (row.expectedThreat && !row.detected) fn += 1;
    else tn += 1;
  }

  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  const tpr = recall;
  const fpr = ratio(fp, fp + tn);
  const f1 = ratio(2 * precision * recall, precision + recall);
  const youden = tpr - fpr;

  return { tp, fp, fn, tn, precision, recall, f1, youden };
}
