import clsx from "clsx";
import { barScale, percentOf, type Tone } from "../../lib/view";
import { BAR_TONES } from "./tones";

export interface BarItem {
  key: string;
  label: string;
  value: number;
  tone: Tone;
}

interface VerticalBarsProps {
  items: BarItem[];
  ariaLabel: string;
  height?: number;
  monoLabels?: boolean;
}

/** Barras verticais: trilho hachurado, preenchimento sólido com valor no topo e % embaixo. */
export function VerticalBars({ items, ariaLabel, height = 250, monoLabels = false }: VerticalBarsProps) {
  const scale = barScale(items.map((i) => i.value));
  const total = items.reduce((acc, i) => acc + i.value, 0);
  const dense = items.length >= 5;

  return (
    <div role="img" aria-label={ariaLabel} className={clsx("flex", dense ? "gap-2" : "gap-3")} style={{ height }}>
      {items.map((item) => {
        const tone = BAR_TONES[item.tone];
        const pct = scale > 0 ? (item.value / scale) * 100 : 0;
        return (
          <div key={item.key} className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="tg-hatch relative flex-1 overflow-hidden rounded-[10px] border border-[#1F1F23]">
              {item.value > 0 && (
                <div
                  className={clsx(
                    "absolute inset-x-0 bottom-0 flex flex-col justify-between rounded-[9px] border-t",
                    dense ? "p-2.5" : "p-3.5"
                  )}
                  style={{
                    height: `${pct}%`,
                    minHeight: dense ? 64 : 76,
                    background: tone.fill,
                    borderTopColor: tone.line,
                  }}
                >
                  <span
                    className={clsx("font-semibold leading-none tracking-[-0.02em]", dense ? "text-xl" : "text-2xl")}
                    style={{ color: tone.value }}
                  >
                    {item.value}
                  </span>
                  <span className="font-mono text-xs" style={{ color: tone.percent }}>
                    {percentOf(item.value, total)}%
                  </span>
                </div>
              )}
            </div>
            <span
              className={clsx(
                "break-words text-center leading-tight text-tg-text-2",
                monoLabels ? "font-mono text-xs" : dense ? "text-xs" : "text-[13px]"
              )}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
