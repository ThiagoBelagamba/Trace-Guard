"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { AlertFired } from "@traceguard/shared";
import { formatTime } from "../lib/format";
import { alertSource, alertTraceId } from "../lib/view";
import { Card } from "./ui/Card";
import { Pill, SegmentedControl } from "./ui/Controls";
import { EmptyState } from "./ui/EmptyState";
import { Icon, type IconName } from "./ui/Icon";

interface AlertsPanelProps {
  alerts: AlertFired[];
  onSelectTrace?: (traceId: string) => void;
}

const SOURCE_ICONS: Record<ReturnType<typeof alertSource>, IconName> = {
  uptime: "pulse",
  rasp: "shield",
  generic: "alert",
};

type View = "active" | "suppressed";

export function AlertsPanel({ alerts, onSelectTrace }: AlertsPanelProps) {
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
    <Card flush>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-tg-border px-5 py-3.5">
        <h2 className="m-0 text-sm font-medium">Fila de alertas</h2>
        <SegmentedControl<View>
          label="Filtro de alertas"
          value={showSuppressed ? "suppressed" : "active"}
          onChange={(v) => setShowSuppressed(v === "suppressed")}
          items={[
            { value: "active", label: "Acionáveis", count: active.length },
            { value: "suppressed", label: "Ruído filtrado", count: suppressed.length },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <EmptyState>
          {showSuppressed ? (
            "Nenhum alerta suprimido por cooldown."
          ) : (
            <>
              Nenhum alerta acionável. Execute <code>pnpm dev:demo:stress</code> para testar.
            </>
          )}
        </EmptyState>
      ) : (
        <ul className="m-0 list-none p-0">
          {list.map((alert) => (
            <li
              key={alert.id}
              className={clsx(
                "flex flex-wrap items-center gap-4 border-b border-tg-border-subtle px-5 py-[18px] last:border-b-0",
                alert.suppressed && "opacity-70"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#27272C] bg-tg-surface-3 text-[#D4D4D8]">
                <Icon name={SOURCE_ICONS[alertSource(alert.metadata)]} size={18} />
              </div>
              <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Pill tone={alert.severity === "critical" ? "error" : "warn"} mono>
                    {alert.severity}
                  </Pill>
                  {alert.suppressed && <Pill tone="neutral">suprimido</Pill>}
                  <h3 className="m-0 text-[15px] font-medium">{alert.title}</h3>
                </div>
                <p className="m-0 text-[13px] text-tg-text-2">{alert.message}</p>
                <p className="m-0 mt-0.5 text-xs text-tg-text-3">
                  Regra: {alert.ruleName} · {alert.eventCount} eventos
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2.5">
                {alertTraceId(alert.metadata) && (
                  <button
                    type="button"
                    title="Abrir detalhe correlacionado do trace"
                    onClick={() => {
                      const id = alertTraceId(alert.metadata);
                      if (id) onSelectTrace?.(id);
                    }}
                    className="rounded-tg-sm border border-tg-border-strong bg-tg-surface-2 px-2 py-[3px] font-mono text-xs text-tg-text-2 hover:border-[#3A3A41] hover:text-tg-text"
                  >
                    trace {alertTraceId(alert.metadata)?.slice(0, 8)}…
                  </button>
                )}
                <span className="rounded-tg-sm border border-tg-border-strong px-2 py-[3px] text-xs text-tg-text-2">
                  {alert.service}
                </span>
                <span className="min-w-16 text-right font-mono text-xs text-tg-text-2">
                  {formatTime(alert.firedAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
