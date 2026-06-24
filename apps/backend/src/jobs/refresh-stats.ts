import { refreshHourlyStats } from "../db/alerts.js";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Atualiza a view materializada telemetry_hourly_stats periodicamente.
 * CONCURRENTLY evita bloquear leituras durante o refresh.
 */
export function startStatsRefreshJob(): void {
  if (timer) return;

  const run = () => {
    void refreshHourlyStats().catch((err) => {
      console.error("[jobs] Falha ao refresh telemetry_hourly_stats:", err);
    });
  };

  run();
  timer = setInterval(run, REFRESH_INTERVAL_MS);
  timer.unref();

  console.log("[jobs] Refresh de telemetry_hourly_stats a cada 5 min");
}

export function stopStatsRefreshJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
