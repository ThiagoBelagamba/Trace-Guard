"use client";

import type { RaspStats } from "@traceguard/shared";
import { threatLabel } from "../lib/labels";
import { percentOf, threatTone } from "../lib/view";
import { Card, CardHeader, Meta } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { ProportionBar } from "./ui/ProportionBar";
import { VerticalBars } from "./ui/VerticalBars";

interface RaspStatsChartsProps {
  stats: RaspStats;
}

function ActionStat({ label, color, value, total }: { label: string; color: string; value: number; total: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-3.5 rounded-tg-lg border border-tg-border bg-tg-surface-2 p-[18px]">
      <span className="flex items-center gap-2 text-[13px] text-tg-text-2">
        <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: color }} />
        {label}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="text-[36px] font-semibold leading-none tracking-[-0.03em]">{value}</span>
        <span className="font-mono text-xs text-tg-text-3">{percentOf(value, total)}%</span>
      </span>
    </div>
  );
}

export function RaspStatsCharts({ stats }: RaspStatsChartsProps) {
  const threats = Object.entries(stats.byThreatType).map(([type, count]) => ({
    key: type,
    label: threatLabel(type),
    value: count,
    tone: threatTone(type),
  }));
  const threatTotal = threats.reduce((acc, t) => acc + t.value, 0);
  const actionTotal = stats.blocked + stats.logged;

  return (
    <div className="flex flex-wrap gap-4">
      <Card className="flex-[1_1_380px]">
        <CardHeader title="Ameaças por tipo" meta={<Meta>{threatTotal} total</Meta>} />
        {threatTotal > 0 ? (
          <VerticalBars
            items={threats}
            ariaLabel={threats.map((t) => `${t.label}: ${t.value} ameaças`).join(". ")}
          />
        ) : (
          <EmptyState>Sem dados</EmptyState>
        )}
      </Card>

      <Card className="flex-[1_1_380px]">
        <CardHeader title="Bloqueados vs registrados" meta={<Meta>24h</Meta>} />
        {actionTotal > 0 ? (
          <div className="flex flex-1 flex-col justify-between gap-6">
            <div className="grid grid-cols-2 gap-3">
              <ActionStat label="Bloqueados" color="var(--tg-error)" value={stats.blocked} total={actionTotal} />
              <ActionStat label="Registrados" color="var(--tg-info)" value={stats.logged} total={actionTotal} />
            </div>
            <div className="flex flex-col gap-2.5">
              <ProportionBar
                height={44}
                ariaLabel={`${percentOf(stats.blocked, actionTotal)}% bloqueados, ${percentOf(stats.logged, actionTotal)}% registrados`}
                segments={[
                  { key: "blocked", value: stats.blocked, style: "error" },
                  { key: "logged", value: stats.logged, style: "info" },
                ]}
              />
              <div aria-hidden="true" className="flex justify-between font-mono text-[11px] text-tg-text-3">
                <span>0</span>
                <span>{Math.round(actionTotal / 2)}</span>
                <span>{actionTotal}</span>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState>Sem dados</EmptyState>
        )}
      </Card>
    </div>
  );
}
