import type { Tone } from "../../lib/view";

/** Preenchimento sólido de barras por tom (fill + linha superior + texto do valor + texto do %). */
export const BAR_TONES: Record<Tone, { fill: string; line: string; value: string; percent: string }> = {
  error: { fill: "var(--tg-error-fill)", line: "var(--tg-error-line)", value: "#F2CFCB", percent: "#E9B3AD" },
  info: { fill: "var(--tg-info-fill)", line: "var(--tg-info-line)", value: "#CFDCF2", percent: "var(--tg-info-text)" },
  threat: { fill: "var(--tg-threat-fill)", line: "var(--tg-threat-line)", value: "#DDD6F5", percent: "#BDB2E3" },
  warn: { fill: "#3A3022", line: "#5C4A2E", value: "var(--tg-warn-text)", percent: "var(--tg-warn-text)" },
  ok: { fill: "#22322A", line: "#35503F", value: "#CDE6D6", percent: "var(--tg-ok)" },
  neutral: { fill: "#26262B", line: "#3A3A41", value: "var(--tg-text)", percent: "var(--tg-text-2)" },
};

/** Cor de ponto/indicador por tom. */
export const DOT_TONES: Record<Tone, string> = {
  error: "var(--tg-error)",
  info: "var(--tg-info)",
  threat: "var(--tg-threat)",
  warn: "var(--tg-warn)",
  ok: "var(--tg-ok)",
  neutral: "#6B6B73",
};
