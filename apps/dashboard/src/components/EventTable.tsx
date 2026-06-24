"use client";

import type { DashboardEvent } from "@traceguard/shared";
import { formatTime, levelBadgeClass, truncateTraceId } from "../lib/format";

interface EventTableProps {
  events: DashboardEvent[];
}

export function EventTable({ events }: EventTableProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-card p-8 text-center text-gray-500">
        Nenhum evento recebido. Execute <code className="text-emerald-400">pnpm dev:demo</code> para gerar telemetria.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-card text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Hora</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Trace ID</th>
              <th className="px-4 py-3">Mensagem</th>
              <th className="px-4 py-3 text-right">ms</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-white/5">
                <td className="whitespace-nowrap px-4 py-2 text-gray-400">
                  {formatTime(event.createdAt)}
                </td>
                <td className="px-4 py-2">
                  <span className={levelBadgeClass(event.level)}>
                    {event.level}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-300">{event.service}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">
                  <button
                    type="button"
                    title={event.traceId}
                    onClick={() => navigator.clipboard.writeText(event.traceId)}
                    className="hover:text-emerald-400"
                  >
                    {truncateTraceId(event.traceId)}
                  </button>
                </td>
                <td className="max-w-md truncate px-4 py-2 text-gray-200">
                  {event.message}
                </td>
                <td className="px-4 py-2 text-right text-gray-500">
                  {event.durationMs != null
                    ? Number(event.durationMs).toFixed(0)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
