"use client";

import type { RaspEvent } from "@traceguard/shared";
import { formatTime } from "../lib/format";
import { threatLabel } from "../lib/labels";
import { MethodTag } from "./EventTable";
import { LiveIndicator, TableCard } from "./ui/Card";
import { Pill } from "./ui/Controls";
import { EmptyState } from "./ui/EmptyState";

export type RaspEventWithId = RaspEvent & { id?: string };

interface RaspPanelProps {
  events: RaspEventWithId[];
  onSelectTrace?: (traceId: string) => void;
  live: boolean;
}

export function RaspPanel({ events, onSelectTrace, live }: RaspPanelProps) {
  if (events.length === 0) {
    return (
      <TableCard title="Detecções RASP" meta={<LiveIndicator live={live} />}>
        <EmptyState>
          Nenhum evento RASP. Execute <code>pnpm dev:demo-api</code> e <code>pnpm demo:scrape</code>.
        </EmptyState>
      </TableCard>
    );
  }

  return (
    <TableCard title="Detecções RASP" meta={<LiveIndicator live={live} />}>
      <table className="tg-table min-w-[900px]">
        <thead>
          <tr>
            <th scope="col">Hora</th>
            <th scope="col">IP</th>
            <th scope="col">Ameaça</th>
            <th scope="col">Ação</th>
            <th scope="col">Score</th>
            <th scope="col">Path</th>
            <th scope="col">Trace</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev, idx) => {
            const blocked = ev.action === "blocked";
            const score = Math.max(0, Math.min(ev.score, 100));
            return (
              <tr key={ev.id ?? `${ev.traceId}-${ev.timestamp}-${idx}`}>
                <td className="font-mono !text-tg-text-2">{formatTime(ev.timestamp)}</td>
                <td className="font-mono">{ev.clientIp}</td>
                <td>
                  <Pill tone="threat">{threatLabel(ev.threatType)}</Pill>
                </td>
                <td>
                  {blocked ? (
                    <Pill tone="error" icon="ban">
                      blocked
                    </Pill>
                  ) : (
                    <Pill tone="info">{ev.action}</Pill>
                  )}
                </td>
                <td>
                  <span className="inline-flex items-center gap-2">
                    <span className="font-mono !text-tg-text">{ev.score}</span>
                    <span aria-hidden="true" className="h-1 w-9 overflow-hidden rounded-sm bg-[#26262B]">
                      <span
                        className="block h-full rounded-sm"
                        style={{
                          width: `${score}%`,
                          background: blocked ? "var(--tg-error)" : "var(--tg-info)",
                        }}
                      />
                    </span>
                  </span>
                </td>
                <td className="max-w-[260px] truncate">
                  <MethodTag>{ev.method}</MethodTag>
                  <span className="font-mono text-tg-text">{ev.path}</span>
                </td>
                <td className="font-mono">
                  <button
                    type="button"
                    title="Abrir detalhe do trace"
                    onClick={() => onSelectTrace?.(ev.traceId)}
                    className="rounded-sm text-tg-text-3 hover:text-tg-text hover:underline"
                  >
                    {ev.traceId.slice(0, 8)}…
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}
