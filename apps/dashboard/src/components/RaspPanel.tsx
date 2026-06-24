"use client";

import type { RaspEvent } from "@traceguard/shared";
import { formatTime } from "../lib/format";

export type RaspEventWithId = RaspEvent & { id?: string };

interface RaspPanelProps {
  events: RaspEventWithId[];
}

const THREAT_LABELS: Record<string, string> = {
  rate_limit: "Rate limit",
  bot_user_agent: "Bot UA",
  sequential_scan: "Varredura",
  missing_headers: "Headers ausentes",
};

function actionClass(action: string): string {
  return action === "blocked"
    ? "bg-red-900/50 text-red-300"
    : "bg-blue-900/40 text-blue-300";
}

export function RaspPanel({ events }: RaspPanelProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-card p-8 text-center text-gray-500">
        Nenhum evento RASP. Execute{" "}
        <code className="text-emerald-400">pnpm dev:demo-api</code> e{" "}
        <code className="text-emerald-400">pnpm demo:scrape</code>.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-surface-border bg-surface-card">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border text-xs uppercase text-gray-500">
            <th className="px-4 py-3">Hora</th>
            <th className="px-4 py-3">IP</th>
            <th className="px-4 py-3">Ameaça</th>
            <th className="px-4 py-3">Ação</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Path</th>
            <th className="px-4 py-3">Trace</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev, idx) => (
            <tr
              key={ev.id ?? `${ev.traceId}-${ev.timestamp}-${idx}`}
              className="border-b border-surface-border/50 hover:bg-surface-border/20"
            >
              <td className="whitespace-nowrap px-4 py-2 text-gray-400">
                {formatTime(ev.timestamp)}
              </td>
              <td className="px-4 py-2 font-mono text-xs text-gray-300">
                {ev.clientIp}
              </td>
              <td className="px-4 py-2">
                <span className="rounded bg-purple-900/40 px-2 py-0.5 text-xs text-purple-300">
                  {THREAT_LABELS[ev.threatType] ?? ev.threatType}
                </span>
              </td>
              <td className="px-4 py-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${actionClass(ev.action)}`}
                >
                  {ev.action}
                </span>
              </td>
              <td className="px-4 py-2 font-mono text-gray-300">{ev.score}</td>
              <td className="max-w-[200px] truncate px-4 py-2 text-gray-400">
                {ev.method} {ev.path}
              </td>
              <td className="px-4 py-2 font-mono text-xs text-gray-500">
                {ev.traceId.slice(0, 8)}…
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
