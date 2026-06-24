"use client";

import type { UptimeCheckWithMonitor } from "@traceguard/shared";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTime } from "../lib/format";

interface UptimeTimelineProps {
  checks: UptimeCheckWithMonitor[];
}

export function UptimeTimeline({ checks }: UptimeTimelineProps) {
  const data = [...checks]
    .reverse()
    .slice(-30)
    .map((c) => ({
      label: formatTime(c.checkedAt),
      latency: c.latencyMs ?? 0,
      up: c.status === "up" ? 1 : 0,
      monitor: c.monitorName,
    }));

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-card p-8 text-center text-sm text-gray-600">
        Sem checks recentes para exibir timeline.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-surface-border bg-surface-card p-4">
      <h3 className="mb-4 text-sm font-medium text-gray-400">
        Latência dos probes (últimos checks)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
          <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} unit="ms" />
          <Tooltip
            contentStyle={{
              background: "#1a2332",
              border: "1px solid #2d3748",
              borderRadius: 8,
            }}
          />
          <Line
            type="monotone"
            dataKey="latency"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
