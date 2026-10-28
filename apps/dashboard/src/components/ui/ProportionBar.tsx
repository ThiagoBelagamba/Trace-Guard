import type { CSSProperties } from "react";
import type { Tone } from "../../lib/view";
import { BAR_TONES } from "./tones";

export interface ProportionSegment {
  key: string;
  value: number;
  style: "hatch" | "solid" | Tone;
}

interface ProportionBarProps {
  segments: ProportionSegment[];
  ariaLabel: string;
  height?: number;
}

function segmentStyle(style: ProportionSegment["style"], radius: number): CSSProperties {
  if (style === "hatch") {
    return {
      borderRadius: radius,
      border: "1px solid #26262B",
      background: "repeating-linear-gradient(135deg, #222226 0 4px, #18181B 4px 8px)",
    };
  }
  if (style === "solid") return { borderRadius: radius, background: "#D6D6DA" };
  const tone = BAR_TONES[style];
  return { borderRadius: radius, background: tone.fill, border: `1px solid ${tone.line}` };
}

/** Barra de proporção: segmentos separados por 4px, largura proporcional ao valor. */
export function ProportionBar({ segments, ariaLabel, height = 12 }: ProportionBarProps) {
  const radius = height >= 24 ? 8 : 4;
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div role="img" aria-label={ariaLabel} className="flex gap-1" style={{ height }}>
      {visible.length === 0 ? (
        <div className="flex-1" style={segmentStyle("hatch", radius)} />
      ) : (
        visible.map((s) => (
          <div key={s.key} style={{ flex: `${s.value} 1 0`, ...segmentStyle(s.style, radius) }} />
        ))
      )}
    </div>
  );
}
