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
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <span
          className={clsx("h-2 w-2 rounded-full", {
            "bg-emerald-400 animate-pulse": connected,
            "bg-red-400": !connected,
          })}
        />
        <span className="text-gray-400">
          {connected ? "WebSocket conectado" : "Reconectando…"}
        </span>
      </div>
      <span className="text-gray-500">{eventCount} eventos</span>
      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}
