"use client";

import type { ReactNode } from "react";
import type { UptimeCheckWithMonitor, UptimeMonitor, UptimeStats } from "@traceguard/shared";
import { formatTime } from "../lib/format";
import { activeMonitorsLabel, uptimeTone } from "../lib/view";
import { Card, Meta, TableCard } from "./ui/Card";
import { Button, Pill } from "./ui/Controls";
import { EmptyState } from "./ui/EmptyState";
import { Icon, type IconName } from "./ui/Icon";
import { DOT_TONES } from "./ui/tones";

interface UptimePanelProps {
  monitors: UptimeMonitor[];
  stats: UptimeStats;
  latestChecks: Map<string, UptimeCheckWithMonitor>;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
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
      <Card>
        <EmptyState>Nenhum monitor configurado. Crie um alvo HTTP para começar.</EmptyState>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <StatCard label="Monitors" value={stats.monitors} icon="monitor" />
        <StatCard label="Up" value={stats.up} icon="arrow-up" dot="var(--tg-ok)" />
        <StatCard label="Down" value={stats.down} icon="arrow-down" dot="var(--tg-error)" danger />
        <StatCard
          label="Latência média"
          value={
            <>
              {stats.avgLatencyMs}
              <span className="ml-[3px] text-base font-medium text-tg-text-2">ms</span>
            </>
          }
          icon="stopwatch"
        />
      </div>

      <TableCard title="Monitores" meta={<Meta>{activeMonitorsLabel(monitors)}</Meta>}>
        <table className="tg-table min-w-[900px]">
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">URL</th>
              <th scope="col">Status</th>
              <th scope="col">Latência</th>
              <th scope="col">Uptime 24h</th>
              <th scope="col">Último check</th>
              <th scope="col" className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {monitors.map((m) => {
              const check = latestChecks.get(m.id);
              const pct = stats.uptimePercent24h[m.id];
              const tone = uptimeTone(check?.status);
              return (
                <tr key={m.id}>
                  <td>
                    <span className="inline-flex items-center gap-2.5 font-medium !text-tg-text">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ background: DOT_TONES[tone] }}
                      />
                      {m.name}
                    </span>
                  </td>
                  <td className="font-mono !text-tg-text-2">
                    <div className="max-w-[240px] truncate">{m.url}</div>
                  </td>
                  <td>
                    {check ? <Pill tone={tone}>{check.status}</Pill> : <span className="text-tg-text-3">—</span>}
                  </td>
                  <td className="font-mono">
                    {check?.latencyMs != null ? `${check.latencyMs}ms` : "—"}
                  </td>
                  <td>
                    {pct != null ? (
                      <span className="inline-flex items-center gap-2.5">
                        <span className="font-mono">{pct}%</span>
                        <span aria-hidden="true" className="h-1 w-[72px] overflow-hidden rounded-sm bg-[#26262B]">
                          <span
                            className="block h-full rounded-sm bg-tg-ok"
                            style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }}
                          />
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="font-mono !text-tg-text-2">
                    {check ? formatTime(check.checkedAt) : "—"}
                  </td>
                  <td className="text-right">
                    <span className="inline-flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => onToggle(m.id, !m.enabled)}>
                        {m.enabled ? "Pausar" : "Ativar"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(m.id)}>
                        Remover
                      </Button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  dot,
  danger = false,
}: {
  label: string;
  value: ReactNode;
  icon: IconName;
  dot?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 rounded-tg-xl border border-tg-border bg-tg-surface px-5 py-[18px]">
      <div className="flex flex-col gap-3.5">
        <span className="flex items-center gap-[7px] text-[13px] text-tg-text-2">
          {dot && <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ background: dot }} />}
          {label}
        </span>
        <span
          className="text-[32px] font-semibold leading-none tracking-[-0.03em]"
          style={danger ? { color: "#F2CFCB" } : undefined}
        >
          {value}
        </span>
      </div>
      <div
        className={
          danger
            ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-tg-lg border border-[#4A302D] bg-[#2A1E1D] text-tg-error-text"
            : "flex h-12 w-12 shrink-0 items-center justify-center rounded-tg-lg border border-[#27272C] bg-tg-surface-3 text-tg-text-2"
        }
      >
        <Icon name={icon} size={20} />
      </div>
    </div>
  );
}
