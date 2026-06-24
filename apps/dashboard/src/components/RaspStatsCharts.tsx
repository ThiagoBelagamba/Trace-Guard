"use client";

import type { RaspStats } from "@traceguard/shared";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RaspStatsChartsProps {
  stats: RaspStats;
}

const THREAT_COLORS: Record<string, string> = {
  rate_limit: "#f59e0b",
  bot_user_agent: "#ef4444",
  sequential_scan: "#a855f7",
  missing_headers: "#3b82f6",
};

const THREAT_LABELS: Record<string, string> = {
  rate_limit: "Rate limit",
  bot_user_agent: "Bot UA",
  sequential_scan: "Varredura",
  missing_headers: "Headers",
};

export function RaspStatsCharts({ stats }: RaspStatsChartsProps) {
  const threatData = Object.entries(stats.byThreatType).map(([type, count]) => ({
    type,
    label: THREAT_LABELS[type] ?? type,
    count,
    fill: THREAT_COLORS[type] ?? "#6b7280",
  }));

  const actionData = [
    { name: "Bloqueados", value: stats.blocked, fill: "#ef4444" },
    { name: "Registrados", value: stats.logged, fill: "#3b82f6" },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-surface-border bg-surface-card p-4">
        <h3 className="mb-4 text-sm font-medium text-gray-400">
          Ameaças por tipo (24h)
        </h3>
        {threatData.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-600">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={threatData}>
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
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {threatData.map((entry) => (
                  <Cell key={entry.type} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border border-surface-border bg-surface-card p-4">
        <h3 className="mb-4 text-sm font-medium text-gray-400">
          Bloqueados vs registrados (24h)
        </h3>
        {actionData.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-600">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={actionData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {actionData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#1a2332",
                  border: "1px solid #2d3748",
                  borderRadius: 8,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
