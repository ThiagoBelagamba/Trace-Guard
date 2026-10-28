"use client";

import { useEffect, useState } from "react";
import type { TraceDetail } from "@traceguard/shared";
import { fetchTrace } from "../lib/api";
import { formatTime } from "../lib/format";
import { threatLabel } from "../lib/labels";
import { levelTone } from "../lib/view";
import { Button, Pill } from "./ui/Controls";

interface TraceDrawerProps {
  traceId: string | null;
  onClose: () => void;
}

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
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60">
      <button
        type="button"
        aria-label="Fechar detalhe do trace"
        className="h-full flex-1 cursor-default"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="trace-drawer-title"
        className="flex h-full w-full max-w-xl flex-col border-l border-tg-border bg-tg-surface"
      >
        <header className="flex items-start justify-between gap-4 border-b border-tg-border px-5 py-4">
          <div className="min-w-0">
            <p className="m-0 text-xs text-tg-text-3">Trace</p>
            <h2 id="trace-drawer-title" className="m-0 mt-1 break-all font-mono text-[13px] font-medium text-tg-text">
              {traceId}
            </h2>
            {detail && (
              <p className="m-0 mt-1.5 font-mono text-xs text-tg-text-3">
                {detail.spanCount} span{detail.spanCount === 1 ? "" : "s"}
                {detail.durationMs != null ? ` · ${detail.durationMs} ms` : ""}
                {detail.raspEvents.length > 0
                  ? ` · ${detail.raspEvents.length} evento(s) RASP`
                  : ""}
              </p>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4">
          {loading && <p className="m-0 text-sm text-tg-text-2">Carregando correlação APM + RASP…</p>}
          {error && <p className="m-0 text-sm text-tg-error-text">{error}</p>}

          {detail && (
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
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
                      className="rounded-tg-lg border border-tg-border bg-tg-surface-2 p-3.5"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Pill tone={levelTone(item.event.level)} mono>
                          {item.event.level}
                        </Pill>
                        <span className="font-mono text-xs text-tg-text-2">
                          {formatTime(item.event.createdAt)}
                        </span>
                      </div>
                      <p className="m-0 text-sm text-tg-text">{item.event.message}</p>
                      <p className="m-0 mt-1.5 break-all font-mono text-xs text-tg-text-3">
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
                      className="rounded-tg-lg border border-tg-threat-line bg-tg-surface-2 p-3.5"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Pill tone="threat">RASP · {threatLabel(item.event.threatType)}</Pill>
                        <span className="font-mono text-xs text-tg-text-2">
                          {formatTime(item.event.timestamp)}
                        </span>
                      </div>
                      <p className="m-0 text-sm text-tg-text">
                        {item.event.action === "blocked" ? "Bloqueado" : "Registrado"} · score{" "}
                        <span className="font-mono">{item.event.score}</span>
                      </p>
                      <p className="m-0 mt-1.5 break-all font-mono text-xs text-tg-text-3">
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
