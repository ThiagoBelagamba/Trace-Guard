"use client";

import type { EventStats } from "@traceguard/shared";
import { formatTime } from "../lib/format";
import { levelTone, orderLevels } from "../lib/view";
import { Card, CardHeader, Meta } from "./ui/Card";
import { Chip } from "./ui/Controls";
import { EmptyState } from "./ui/EmptyState";
import { LineChartCard } from "./ui/LineChartCard";
import { VerticalBars } from "./ui/VerticalBars";

interface EventChartsProps {
  stats: EventStats;
}

export function EventCharts({ stats }: EventChartsProps) {
  const timelineData = stats.timeline.map((point) => ({
    label: formatTime(point.bucket),
    value: point.count,
  }));
  const last = timelineData.at(-1);
  const previous = timelineData.length >= 2 ? timelineData.at(-2) : undefined;

  const levels = orderLevels(stats.byLevel);
  const levelTotal = levels.reduce((acc, l) => acc + l.count, 0);

  const timelineLabel = last
    ? `Eventos por período: ${previous ? `${previous.value} às ${previous.label} e ` : ""}${last.value} às ${last.label}`
    : "Eventos por período: sem dados";

  return (
    <div className="flex flex-wrap gap-4">
      <Card className="flex-[2_1_520px]">
        <CardHeader title="Eventos por período" meta={<Chip icon="clock">24h</Chip>} />
        {last ? (
          <>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-[34px] font-semibold leading-none tracking-[-0.03em]">
                {last.value}
              </span>
              <span className="text-[13px] text-tg-text-2">eventos no último período</span>
              {previous && (
                <span className="font-mono text-xs text-tg-text-3">anterior: {previous.value}</span>
              )}
            </div>
            <LineChartCard data={timelineData} ariaLabel={timelineLabel} tooltipName="Eventos" />
          </>
        ) : (
          <EmptyState>Sem eventos nas últimas 24h.</EmptyState>
        )}
      </Card>

      <Card className="flex-[1_1_300px]">
        <CardHeader title="Distribuição por nível" meta={<Meta>{levelTotal} eventos</Meta>} />
        {levelTotal > 0 ? (
          <VerticalBars
            monoLabels
            ariaLabel={levels.map((l) => `${l.level}: ${l.count} eventos`).join(", ")}
            items={levels.map((l) => ({
              key: l.level,
              label: l.level,
              value: l.count,
              tone: levelTone(l.level),
            }))}
          />
        ) : (
          <EmptyState>Sem dados</EmptyState>
        )}
      </Card>
    </div>
  );
}
