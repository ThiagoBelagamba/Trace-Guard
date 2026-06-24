"use client";

import type { AlertStats } from "@traceguard/shared";

interface AlertStatsBannerProps {
  stats: AlertStats;
}

export function AlertStatsBanner({ stats }: AlertStatsBannerProps) {
  if (stats.fired === 0 && stats.suppressed === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-sm text-gray-500">
        Nenhum alerta registrado nas últimas 24h.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-4 py-3">
      <p className="text-sm text-emerald-300">
        Mitigação de fadiga:{" "}
        <strong>{stats.suppressed}</strong> alertas suprimidos por cooldown (
        {stats.suppressionRate}% do total) —{" "}
        <strong>{stats.fired}</strong> alertas acionáveis nas últimas 24h
      </p>
    </div>
  );
}
