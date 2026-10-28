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

const THREAT_TONED = new Set(["sequential_scan", "prompt_injection", "secret_leak"]);

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
