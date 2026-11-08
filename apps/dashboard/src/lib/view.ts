/** Funções puras de apresentação: só derivam percentuais, somas e tons de dados existentes. */

export type Tone = "error" | "warn" | "info" | "threat" | "ok" | "neutral";

export function percentOf(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

/** Topo da escala das barras verticais: maior valor com 7% de folga. */
export function barScale(values: number[]): number {
  const max = values.reduce((acc, v) => Math.max(acc, v), 0);
  return max > 0 ? max * 1.07 : 0;
}

/**
 * Tamanho (px) do número dentro da barra vertical, para não ser cortado
 * quando há muitas barras estreitas ou valores com muitos dígitos.
 */
export function barValueFontSize(itemCount: number, maxValue: number): number {
  const digits = String(Math.max(0, Math.round(maxValue))).length;
  if (itemCount >= 5) return digits >= 3 ? 14 : 20;
  if (itemCount >= 4) return digits >= 4 ? 15 : digits === 3 ? 19 : 24;
  return digits >= 4 ? 20 : 24;
}

/**
 * Topo do eixo Y dos gráficos de linha: 15% de folga para o último ponto não ser cortado,
 * igual a 4 × um passo "redondo" (1, 2, 2,5, 5 ou 10 × 10^n, nunca menor que 1),
 * gerando 5 marcas inteiras e fáceis de ler.
 */
export function chartYMax(dataMax: number): number {
  if (dataMax <= 0) return 4;
  const rawStep = (dataMax * 1.15) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const multipliers = magnitude >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10];
  const step = (multipliers.find((m) => m * magnitude >= rawStep) ?? 10) * magnitude;
  return Math.max(1, step) * 4;
}

export function activeMonitorsLabel(monitors: Array<{ enabled: boolean }>): string {
  const active = monitors.filter((m) => m.enabled).length;
  return `${active} de ${monitors.length} ativos`;
}

export function parseHttpMessage(
  message: string
): { method: string; rest: string } | null {
  const match = /^HTTP (\w+) (.+)$/.exec(message);
  return match ? { method: match[1], rest: match[2] } : null;
}

export function alertSource(
  metadata: Record<string, unknown> | undefined
): "uptime" | "rasp" | "generic" {
  if (metadata?.monitorId !== undefined) return "uptime";
  if (metadata?.raspCount !== undefined) return "rasp";
  return "generic";
}

export function levelTone(level: string): Tone {
  if (level === "error" || level === "warn" || level === "info") return level;
  return "neutral";
}

const LEVEL_ORDER = ["error", "warn", "info", "debug"];

export function orderLevels(
  byLevel: Record<string, number>
): Array<{ level: string; count: number }> {
  const known = LEVEL_ORDER.filter((l) => byLevel[l] !== undefined);
  const unknown = Object.keys(byLevel).filter((l) => !LEVEL_ORDER.includes(l));
  return [...known, ...unknown].map((level) => ({ level, count: byLevel[level] }));
}

const THREAT_TONED = new Set(["sequential_scan"]);

export function threatTone(type: string): Tone {
  return THREAT_TONED.has(type) ? "threat" : "neutral";
}

export function uptimeTone(status: string | undefined): Tone {
  if (status === "up") return "ok";
  if (status === "degraded") return "warn";
  if (status === "down") return "error";
  return "neutral";
}

export function countByLevel(events: Array<{ level: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of events) counts[e.level] = (counts[e.level] ?? 0) + 1;
  return counts;
}

export function alertTraceId(metadata: Record<string, unknown> | undefined): string | null {
  const raw = metadata?.traceId;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function insightTone(severity: "critical" | "warning" | "info" | "ok"): Tone {
  if (severity === "critical") return "error";
  if (severity === "warning") return "warn";
  if (severity === "info") return "info";
  return "ok";
}

export function pillarLabel(pillar: "apm" | "rasp" | "alert"): string {
  if (pillar === "apm") return "APM";
  if (pillar === "rasp") return "RASP";
  return "Alerta";
}

export function buildMcpInvestigateSnippet(traceId: string): string {
  return JSON.stringify(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "investigate_trace",
        arguments: { traceId },
      },
    },
    null,
    2
  );
}
