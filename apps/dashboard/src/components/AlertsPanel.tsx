"use client";

import { useMemo, useState } from "react";
import type { AlertFired } from "@traceguard/shared";
import { formatTime, severityBadgeClass } from "../lib/format";

interface AlertsPanelProps {
  alerts: AlertFired[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const [showSuppressed, setShowSuppressed] = useState(false);

  const active = useMemo(
    () => alerts.filter((a) => !a.suppressed),
    [alerts]
  );
  const suppressed = useMemo(
    () => alerts.filter((a) => a.suppressed),
    [alerts]
  );

  const list = showSuppressed ? suppressed : active;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setShowSuppressed(false)}
          className={`rounded-md px-3 py-1.5 text-sm ${
            !showSuppressed
              ? "bg-emerald-900/50 text-emerald-300"
              : "bg-surface-card text-gray-400 hover:text-gray-200"
          }`}
        >
          Acionáveis ({active.length})
        </button>
        <button
          type="button"
          onClick={() => setShowSuppressed(true)}
          className={`rounded-md px-3 py-1.5 text-sm ${
            showSuppressed
              ? "bg-amber-900/50 text-amber-300"
              : "bg-surface-card text-gray-400 hover:text-gray-200"
          }`}
        >
          Ruído filtrado ({suppressed.length})
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface-card p-8 text-center text-gray-500">
          {showSuppressed
            ? "Nenhum alerta suprimido por cooldown."
            : "Nenhum alerta acionável. Execute pnpm dev:demo:stress para testar."}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((alert) => (
            <article
              key={alert.id}
              className={`rounded-lg border p-4 ${
                alert.suppressed
                  ? "border-amber-900/30 bg-amber-950/20 opacity-80"
                  : "border-surface-border bg-surface-card"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={severityBadgeClass(alert.severity)}>
                  {alert.severity}
                </span>
                {alert.suppressed && (
                  <span className="rounded bg-amber-900/40 px-2 py-0.5 text-xs text-amber-400">
                    suprimido
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {formatTime(alert.firedAt)}
                </span>
                <span className="text-xs text-gray-500">· {alert.service}</span>
              </div>
              <h3 className="mt-2 font-medium text-gray-100">{alert.title}</h3>
              <p className="mt-1 text-sm text-gray-400">{alert.message}</p>
              <p className="mt-2 text-xs text-gray-600">
                Regra: {alert.ruleName} · {alert.eventCount} eventos
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
