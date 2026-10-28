"use client";

import clsx from "clsx";

interface ConnectionStatusProps {
  connected: boolean;
  error: string | null;
  eventCount: number;
}

export function ConnectionStatus({
  connected,
  error,
  eventCount,
}: ConnectionStatusProps) {
  return (
    <div
      role="status"
      className="flex flex-col gap-2.5 rounded-tg-lg border border-tg-border bg-tg-surface p-3.5"
    >
      <div className="flex items-center gap-2 text-[13px] text-tg-text">
        <span
          aria-hidden="true"
          className={clsx(
            "h-2 w-2 rounded-full",
            connected ? "bg-tg-ok shadow-[0_0_0_3px_rgb(127_184_148/.15)]" : "bg-tg-error"
          )}
        />
        {connected ? "WebSocket conectado" : "Reconectando…"}
      </div>
      <div className="flex justify-between text-xs text-tg-text-3">
        <span>Eventos recebidos</span>
        <span className="font-mono text-[#D4D4D8]">{eventCount}</span>
      </div>
      {error && <p className="m-0 text-xs text-tg-error-text">{error}</p>}
    </div>
  );
}
