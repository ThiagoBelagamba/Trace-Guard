"use client";

import type { UptimeCheckWithMonitor } from "@traceguard/shared";
import { formatTime } from "../lib/format";
import { Card, CardHeader } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { LineChartCard } from "./ui/LineChartCard";

interface UptimeTimelineProps {
  checks: UptimeCheckWithMonitor[];
}

export function UptimeTimeline({ checks }: UptimeTimelineProps) {
  const recent = [...checks].reverse().slice(-30);
  const data = recent.map((c) => ({
    label: formatTime(c.checkedAt),
    value: c.latencyMs ?? 0,
  }));
  const monitorNames = Array.from(new Set(recent.map((c) => c.monitorName)));

  const legend =
    monitorNames.length > 0 ? (
      <span className="inline-flex items-center gap-[7px] text-xs text-tg-text-2">
        <span aria-hidden="true" className="h-0.5 w-3.5 bg-tg-chart-line" />
        {monitorNames.join(", ")}
      </span>
    ) : undefined;

  const values = data.map((d) => d.value);
  const ariaLabel =
    data.length > 0
      ? `Latência dos probes entre ${data[0].label} e ${data[data.length - 1].label}, de ${Math.min(...values)} a ${Math.max(...values)} ms`
      : "Latência dos probes: sem dados";

  return (
    <Card className="!gap-5">
      <CardHeader title="Latência dos probes" subtitle="Últimos checks" meta={legend} />
      {data.length === 0 ? (
        <EmptyState>Sem checks recentes para exibir timeline.</EmptyState>
      ) : (
        <LineChartCard data={data} unit="ms" ariaLabel={ariaLabel} tooltipName="Latência" />
      )}
    </Card>
  );
}
