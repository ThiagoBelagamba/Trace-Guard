"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface LinePoint {
  label: string;
  value: number;
}

interface LineChartCardProps {
  data: LinePoint[];
  ariaLabel: string;
  tooltipName: string;
  height?: number;
  unit?: string;
}

const AXIS_TICK = { fill: "#85858D", fontSize: 11, fontFamily: "var(--tg-mono)" };

/** Gráfico de linha do redesign: linha clara, grade tracejada, área hachurada, último ponto marcado. */
export function LineChartCard({ data, ariaLabel, tooltipName, height = 200, unit }: LineChartCardProps) {
  const patternId = `hatch-${useId().replace(/:/g, "")}`;
  const lastIndex = data.length - 1;

  return (
    <div role="img" aria-label={ariaLabel} style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 28, bottom: 0, left: 0 }}>
          <defs>
            <pattern
              id={patternId}
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="7" stroke="#26262B" strokeWidth="2" />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="var(--tg-chart-grid)" />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--tg-chart-axis)" }}
            minTickGap={24}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={44}
            unit={unit}
          />
          <Tooltip
            cursor={{ stroke: "var(--tg-border-strong)" }}
            contentStyle={{
              background: "var(--tg-surface-2)",
              border: "1px solid var(--tg-border-strong)",
              borderRadius: 8,
              fontFamily: "var(--tg-mono)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--tg-text-2)" }}
            itemStyle={{ color: "var(--tg-text)" }}
            formatter={(value: number) => [`${value}${unit ?? ""}`, tooltipName]}
          />
          <Area
            type="linear"
            dataKey="value"
            stroke="var(--tg-chart-line)"
            strokeWidth={2}
            fill={`url(#${patternId})`}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: "var(--tg-chart-line)", stroke: "var(--tg-surface)", strokeWidth: 2 }}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              if (index !== lastIndex || cx == null || cy == null) {
                return <g key={`dot-${index}`} />;
              }
              return (
                <g key={`dot-${index}`}>
                  <circle cx={cx} cy={cy} r={9} fill="rgb(228 228 231 / .12)" />
                  <circle cx={cx} cy={cy} r={5} fill="var(--tg-chart-line)" />
                </g>
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
