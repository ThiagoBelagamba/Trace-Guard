"use client";

import { useEffect, useState } from "react";
import type { TraceDetail, TraceInsight } from "@traceguard/shared";
import { fetchTrace, fetchTraceInsight } from "../lib/api";
import { formatTime } from "../lib/format";
import { threatLabel } from "../lib/labels";
import {
  buildMcpInvestigateSnippet,
  insightSourceLabel,
  insightTone,
  levelTone,
  pillarLabel,
} from "../lib/view";
import { Button, Pill } from "./ui/Controls";
import { Icon } from "./ui/Icon";

interface TraceDrawerProps {
  traceId: string | null;
  onClose: () => void;
}

export function TraceDrawer({ traceId, onClose }: TraceDrawerProps) {
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const [insight, setInsight] = useState<TraceInsight | null>(null);
  const [showMcp, setShowMcp] = useState(false);
  const [copiedMcp, setCopiedMcp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);

  // A linha do tempo depende só de fetchTrace e não espera o diagnóstico (que pode demorar com LLM).
  useEffect(() => {
    if (!traceId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    void fetchTrace(traceId)
      .then((traceData) => {
        if (!cancelled) setDetail(traceData);
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

  useEffect(() => {
    setShowMcp(false);
    if (!traceId) {
      setInsight(null);
      setInsightLoading(false);
      return;
    }

    let cancelled = false;
    setInsight(null);
    setInsightLoading(true);

    void fetchTraceInsight(traceId)
      .then((insightData) => {
        if (!cancelled) setInsight(insightData);
      })
      .catch(() => {
        if (!cancelled) setInsight(null);
      })
      .finally(() => {
        if (!cancelled) setInsightLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [traceId]);

  if (!traceId) return null;

  const alerts = detail?.alerts ?? [];
  const mcpSnippet = buildMcpInvestigateSnippet(traceId);

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
            <p className="m-0 text-xs text-tg-text-3">Trace W3C Correlacionado</p>
            <h2
              id="trace-drawer-title"
              className="m-0 mt-1 break-all font-mono text-[13px] font-medium text-tg-text"
            >
              {traceId}
            </h2>
            {detail && (
              <p className="m-0 mt-1.5 font-mono text-xs text-tg-text-3">
                {detail.spanCount} span{detail.spanCount === 1 ? "" : "s"}
                {detail.durationMs != null ? ` · ${detail.durationMs} ms` : ""}
                {detail.raspEvents.length > 0
                  ? ` · ${detail.raspEvents.length} RASP`
                  : ""}
                {alerts.length > 0 ? ` · ${alerts.length} alerta(s)` : ""}
              </p>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4">
          {loading && (
            <p className="m-0 text-sm text-tg-text-2">
              Correlacionando APM + RASP + Alertas…
            </p>
          )}
          {error && <p className="m-0 text-sm text-tg-error-text">{error}</p>}

          {insightLoading && !insight && (
            <section
              aria-label="Copiloto Forense do Trace"
              aria-busy="true"
              className="mb-4 rounded-tg-lg border border-tg-border-strong bg-tg-surface-2 p-4"
            >
              <p className="m-0 text-sm text-tg-text-2">Gerando diagnóstico forense…</p>
            </section>
          )}

          {insight && (
            <section
              aria-label="Copiloto Forense do Trace"
              className="mb-4 rounded-tg-lg border border-tg-border-strong bg-tg-surface-2 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-tg-border-strong bg-tg-surface-3 text-tg-text">
                    <Icon name="sparkle" size={14} />
                  </span>
                  <span className="text-xs font-medium text-tg-text-2">
                    Copiloto Forense · {insightSourceLabel(insight)}
                  </span>
                  <Pill tone={insightTone(insight.severity)} mono>
                    {insight.verdict}
                  </Pill>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  icon="terminal"
                  onClick={() => setShowMcp((prev) => !prev)}
                >
                  {showMcp ? "Ocultar MCP" : "Contexto MCP"}
                </Button>
              </div>

              <h3 className="m-0 mt-3 text-sm font-medium text-tg-text">
                {insight.headline}
              </h3>
              <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-tg-text-2">
                {insight.narrative}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-tg-text-3">Pilares no trace:</span>
                {insight.correlatedPillars.map((pillar) => (
                  <Pill
                    key={pillar}
                    tone={
                      pillar === "rasp"
                        ? "threat"
                        : pillar === "alert"
                          ? "warn"
                          : "info"
                    }
                    mono
                  >
                    {pillarLabel(pillar)}
                  </Pill>
                ))}
                {insight.rootCause.spanId && (
                  <span className="ml-auto font-mono text-[11px] text-tg-text-3">
                    causa raiz: span {insight.rootCause.spanId}
                  </span>
                )}
              </div>

              {insight.causalChain.length > 0 && (
                <div className="mt-3 border-t border-tg-border-subtle pt-3">
                  <p className="m-0 text-[11px] font-medium uppercase tracking-wider text-tg-text-3">
                    Cadeia causal
                  </p>
                  <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0 text-xs text-tg-text-2">
                    {insight.causalChain.map((step, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="font-mono text-tg-text-3">{idx + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insight.recommendations.length > 0 && (
                <div className="mt-3 border-t border-tg-border-subtle pt-3">
                  <p className="m-0 text-[11px] font-medium uppercase tracking-wider text-tg-text-3">
                    Mitigação recomendada
                  </p>
                  <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0 text-xs text-tg-text">
                    {insight.recommendations.map((rec, idx) => (
                      <li key={idx}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {showMcp && (
                <div className="mt-3 rounded-tg-md border border-tg-border bg-tg-sidebar p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-tg-text-3">
                      POST /api/v1/mcp · Model Context Protocol
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(mcpSnippet);
                        setCopiedMcp(true);
                        setTimeout(() => setCopiedMcp(false), 1800);
                      }}
                      className="rounded border border-tg-border-strong px-2 py-0.5 font-mono text-[11px] text-tg-text-2 hover:text-tg-text"
                    >
                      {copiedMcp ? "Copiado!" : "Copiar JSON-RPC"}
                    </button>
                  </div>
                  <pre className="m-0 overflow-x-auto font-mono text-[11px] leading-relaxed text-tg-text-2">
                    {mcpSnippet}
                  </pre>
                </div>
              )}
            </section>
          )}

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
                ...alerts.map((alert) => ({
                  kind: "alert" as const,
                  at: Date.parse(alert.firedAt),
                  alert,
                })),
              ]
                .sort((a, b) => a.at - b.at)
                .map((item) => {
                  if (item.kind === "apm") {
                    return (
                      <li
                        key={item.event.id}
                        className="rounded-tg-lg border border-tg-border bg-tg-surface-2 p-3.5"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Pill tone={levelTone(item.event.level)} mono>
                            APM · {item.event.level}
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
                    );
                  }

                  if (item.kind === "rasp") {
                    return (
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
                    );
                  }

                  return (
                    <li
                      key={`alert-${item.alert.id}`}
                      className="rounded-tg-lg border border-[#5C4A2E] bg-tg-surface-2 p-3.5"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Pill
                            tone={item.alert.severity === "critical" ? "error" : "warn"}
                            mono
                          >
                            Alerta · {item.alert.severity}
                          </Pill>
                          {item.alert.suppressed && (
                            <Pill tone="neutral" mono>
                              suprimido por cooldown
                            </Pill>
                          )}
                        </div>
                        <span className="font-mono text-xs text-tg-text-2">
                          {formatTime(item.alert.firedAt)}
                        </span>
                      </div>
                      <p className="m-0 text-sm text-tg-text">{item.alert.title}</p>
                      <p className="m-0 mt-1 text-xs text-tg-text-2">{item.alert.message}</p>
                    </li>
                  );
                })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
