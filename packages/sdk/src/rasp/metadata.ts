import type { RaspThreatType } from "@traceguard/shared";
import type { RaspConfig } from "./types.js";

export type RaspEventMetadata = {
  threats: RaspThreatType[];
  blockThreshold: number;
  mode: "monitor" | "block";
};

/**
 * Metadata do evento RASP: ameaças detectadas mais a política efetiva
 * (limiar e modo) usada na decisão, para o diagnóstico citar valores reais.
 */
export function buildRaspMetadata(
  threats: RaspThreatType[],
  config: Pick<RaspConfig, "blockThreshold" | "mode">
): RaspEventMetadata {
  return {
    threats,
    blockThreshold: config.blockThreshold,
    mode: config.mode,
  };
}
