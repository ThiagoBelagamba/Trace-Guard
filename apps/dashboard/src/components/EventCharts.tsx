"use client";

import type { EventStats } from "@traceguard/shared";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTime } from "../lib/format";

interface EventChartsProps {
  stats: EventStats;
}

export function EventCharts({ stats }: EventChartsProps) {
  const timelineData = stats.timeline.map((point) => ({
    ...point,
    label: formatTime(point.bucket),
  }));

  const levelData = Object.entries(stats.byLevel).map(([level, count]) => ({
    level,
    count,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-surface-border bg-surface-card p-4">
        <h3 className="mb-4 text-sm font-medium text-gray-400">
          Eventos por período (24h)
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={timelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
            <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#1a2332",
                border: "1px solid #2d3748",
                borderRadius: 8,
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border border-surface-border bg-surface-card p-4">
        <h3 className="mb-4 text-sm font-medium text-gray-400">
          Distribuição por nível
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={levelData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
            <XAxis dataKey="level" tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#1a2332",
                border: "1px solid #2d3748",
                borderRadius: 8,
              }}
            />
            <Bar dataKey="count" fill="#60a5fa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
