"use client";

import { useEffect, useState } from "react";
import type { TraceDetail } from "@traceguard/shared";
import { fetchTrace } from "../lib/api";
import { formatTime, levelBadgeClass } from "../lib/format";

interface TraceDrawerProps {
  traceId: string | null;
  onClose: () => void;
}

const THREAT_LABELS: Record<string, string> = {
  rate_limit: "Rate limit",
  bot_user_agent: "Bot UA",
  sequential_scan: "Varredura",
  missing_headers: "Headers ausentes",
};

export function TraceDrawer({ traceId, onClose }: TraceDrawerProps) {
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!traceId) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchTrace(traceId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDetail(null);
          setError(err instanceof Error ? err.message : "Falha ao carregar trace");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [traceId]);

  if (!traceId) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50">
      <button
        type="button"
        aria-label="Fechar detalhe do trace"
        className="h-full flex-1"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-surface-border bg-surface-card">
        <header className="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Trace</p>
            <h2 className="break-all font-mono text-sm text-white">{traceId}</h2>
            {detail && (
              <p className="mt-1 text-xs text-gray-500">
                {detail.spanCount} span{detail.spanCount === 1 ? "" : "s"}
                {detail.durationMs != null ? ` · ${detail.durationMs} ms` : ""}
                {detail.raspEvents.length > 0
                  ? ` · ${detail.raspEvents.length} evento(s) RASP`
                  : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
          >
            Fechar
          </button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4">
          {loading && <p className="text-sm text-gray-500">Carregando correlação APM + RASP…</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}

          {detail && (
            <ol className="space-y-3">
              {[
                ...detail.events.map((event) => ({
                  kind: "apm" as const,
                  at: Date.parse(event.createdAt),
                  event,
                })),
                ...detail.raspEvents.map((event, index) => ({
                  kind: "rasp" as const,
                  at: Date.parse(event.timestamp),
                  event,
                  index,
                })),
              ]
                .sort((a, b) => a.at - b.at)
                .map((item) =>
                  item.kind === "apm" ? (
                    <li
                      key={item.event.id}
                      className="rounded border border-surface-border bg-surface px-3 py-3"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className={levelBadgeClass(item.event.level)}>
                          {item.event.level}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTime(item.event.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-200">{item.event.message}</p>
                      <p className="mt-1 font-mono text-xs text-gray-500">
                        {item.event.service}
                        {item.event.spanId ? ` · span ${item.event.spanId}` : ""}
                        {typeof item.event.metadata?.parentSpanId === "string"
                          ? ` · parent ${item.event.metadata.parentSpanId}`
                          : ""}
                        {item.event.durationMs != null
                          ? ` · ${Number(item.event.durationMs).toFixed(0)} ms`
                          : ""}
                      </p>
                    </li>
                  ) : (
                    <li
                      key={`${item.event.traceId}-${item.event.timestamp}-${item.index}`}
                      className="rounded border border-purple-900/60 bg-purple-950/30 px-3 py-3"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="rounded bg-purple-900/40 px-2 py-0.5 text-xs text-purple-300">
                          RASP · {THREAT_LABELS[item.event.threatType] ?? item.event.threatType}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTime(item.event.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-200">
                        {item.event.action === "blocked" ? "Bloqueado" : "Registrado"} · score{" "}
                        {item.event.score}
                      </p>
                      <p className="mt-1 font-mono text-xs text-gray-500">
                        {item.event.method} {item.event.path} · {item.event.clientIp}
                      </p>
                    </li>
                  )
                )}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
