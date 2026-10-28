"use client";

import type { DashboardEvent } from "@traceguard/shared";
import { formatTime, truncateTraceId } from "../lib/format";
import { levelTone, parseHttpMessage } from "../lib/view";
import { LiveIndicator, TableCard } from "./ui/Card";
import { Pill } from "./ui/Controls";
import { EmptyState } from "./ui/EmptyState";

interface EventTableProps {
  events: DashboardEvent[];
  onSelectTrace?: (traceId: string) => void;
  live: boolean;
}

export function MethodTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-2 rounded-[5px] border border-[#26262A] bg-tg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-tg-text-2">
      {children}
    </span>
  );
}

export function EventTable({ events, onSelectTrace, live }: EventTableProps) {
  if (events.length === 0) {
    return (
      <TableCard title="Eventos recentes" meta={<LiveIndicator live={live} />}>
        <EmptyState>
          Nenhum evento recebido. Execute <code>pnpm dev:demo</code> para gerar telemetria.
        </EmptyState>
      </TableCard>
    );
  }

  return (
    <TableCard
      title="Eventos recentes"
      meta={<LiveIndicator live={live} />}
      bodyClassName="max-h-[420px] overflow-y-auto"
    >
      <table className="tg-table min-w-[880px]">
        <thead className="sticky top-0 z-10">
          <tr>
            <th scope="col">Hora</th>
            <th scope="col">Level</th>
            <th scope="col">Service</th>
            <th scope="col">Trace ID</th>
            <th scope="col">Mensagem</th>
            <th scope="col" className="text-right">ms</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const http = parseHttpMessage(event.message);
            return (
              <tr key={event.id}>
                <td className="font-mono !text-tg-text-2">{formatTime(event.createdAt)}</td>
                <td>
                  <Pill tone={levelTone(event.level)} mono>
                    {event.level}
                  </Pill>
                </td>
                <td>
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-sm bg-[#6B6B73]" />
                    {event.service}
                  </span>
                </td>
                <td className="font-mono">
                  <button
                    type="button"
                    title="Abrir detalhe do trace"
                    onClick={() => onSelectTrace?.(event.traceId)}
                    className="-mx-1 -my-[11px] inline-block rounded-sm px-1 py-[11px] text-tg-text-3 hover:text-tg-text hover:underline"
                  >
                    {truncateTraceId(event.traceId)}
                  </button>
                </td>
                <td className="!text-tg-text">
                  <div className="max-w-md truncate">
                    {http ? (
                      <>
                        <MethodTag>HTTP {http.method}</MethodTag>
                        {http.rest}
                      </>
                    ) : (
                      event.message
                    )}
                  </div>
                </td>
                <td className="text-right font-mono !text-tg-text-2">
                  {event.durationMs != null ? Number(event.durationMs).toFixed(0) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}
