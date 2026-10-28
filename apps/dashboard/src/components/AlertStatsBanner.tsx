"use client";

import type { AlertStats } from "@traceguard/shared";
import { percentOf } from "../lib/view";
import { Card, CardHeader } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { Icon } from "./ui/Icon";
import { ProportionBar } from "./ui/ProportionBar";

interface AlertStatsBannerProps {
  stats: AlertStats;
}

function InnerStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-[1_1_160px] flex-col justify-between gap-2.5 rounded-tg-lg border border-tg-border bg-tg-surface-2 p-4">
      <span className="text-[13px] text-tg-text-2">{label}</span>
      <span className="text-[28px] font-semibold leading-none tracking-[-0.02em]">{value}</span>
    </div>
  );
}

export function AlertStatsBanner({ stats }: AlertStatsBannerProps) {
  const title = (
    <>
      <Icon name="filter" size={15} className="text-tg-text-2" />
      Mitigação de fadiga
    </>
  );

  if (stats.fired === 0 && stats.suppressed === 0) {
    return (
      <Card aria-labelledby="fadiga">
        <CardHeader id="fadiga" title={title} />
        <EmptyState>Nenhum alerta registrado nas últimas 24h.</EmptyState>
      </Card>
    );
  }

  const total = stats.fired + stats.suppressed;
  const suppressedPct = percentOf(stats.suppressed, total);
  const firedPct = percentOf(stats.fired, total);

  return (
    <Card aria-labelledby="fadiga" className="!gap-5 !p-[22px]">
      <div className="flex flex-wrap items-stretch gap-6">
        <div className="flex flex-[2_1_320px] flex-col gap-2.5">
          <CardHeader id="fadiga" title={title} />
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-[44px] font-semibold leading-none tracking-[-0.03em]">
              {stats.suppressionRate}%
            </span>
            <span className="text-sm text-tg-text-2">do total suprimido por cooldown</span>
          </div>
        </div>
        <InnerStat label="Suprimidos" value={stats.suppressed} />
        <InnerStat label="Acionáveis · 24h" value={stats.fired} />
      </div>
      <div className="flex flex-col gap-2.5">
        <ProportionBar
          ariaLabel={`${suppressedPct}% suprimidos, ${firedPct}% acionáveis`}
          segments={[
            { key: "suppressed", value: stats.suppressed, style: "hatch" },
            { key: "fired", value: stats.fired, style: "solid" },
          ]}
        />
        <div className="flex justify-between text-xs text-tg-text-3">
          <span>Ruído suprimido</span>
          <span>Acionáveis</span>
        </div>
      </div>
    </Card>
  );
}
