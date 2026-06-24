"use client";

import type { UptimeCheckWithMonitor, UptimeMonitor, UptimeStats } from "@traceguard/shared";
import { formatTime } from "../lib/format";

interface UptimePanelProps {
  monitors: UptimeMonitor[];
  stats: UptimeStats;
  latestChecks: Map<string, UptimeCheckWithMonitor>;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}

function statusBadge(status: string | undefined): string {
  if (status === "up") return "bg-emerald-900/50 text-emerald-300";
  if (status === "degraded") return "bg-amber-900/50 text-amber-300";
  return "bg-red-900/50 text-red-300";
}

export function UptimePanel({
  monitors,
  stats,
  latestChecks,
  onToggle,
  onDelete,
}: UptimePanelProps) {
  if (monitors.length === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-card p-8 text-center text-gray-500">
        Nenhum monitor configurado. Crie um alvo HTTP para começar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Monitors" value={stats.monitors} />
        <StatCard label="Up" value={stats.up} accent="text-emerald-400" />
        <StatCard label="Down" value={stats.down} accent="text-red-400" />
        <StatCard
          label="Latência média"
          value={`${stats.avgLatencyMs}ms`}
          accent="text-blue-400"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-surface-border bg-surface-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-border text-xs uppercase text-gray-500">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Latência</th>
              <th className="px-4 py-3">Uptime 24h</th>
              <th className="px-4 py-3">Último check</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {monitors.map((m) => {
              const check = latestChecks.get(m.id);
              const pct = stats.uptimePercent24h[m.id];
              return (
                <tr
                  key={m.id}
                  className="border-b border-surface-border/50 hover:bg-surface-border/20"
                >
                  <td className="px-4 py-2 font-medium text-gray-200">{m.name}</td>
                  <td className="max-w-[200px] truncate px-4 py-2 text-gray-400">
                    {m.url}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${statusBadge(check?.status)}`}
                    >
                      {check?.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-gray-300">
                    {check?.latencyMs != null ? `${check.latencyMs}ms` : "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-300">
                    {pct != null ? `${pct}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {check ? formatTime(check.checkedAt) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onToggle(m.id, !m.enabled)}
                        className="text-xs text-gray-400 hover:text-gray-200"
                      >
                        {m.enabled ? "Pausar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(m.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "text-gray-200",
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
