import { alertEngine } from "../alerts/engine.js";
import {
  insertCheck,
  listEnabledMonitorsDueForProbe,
} from "../db/uptime.js";
import { notifyWebhook } from "../notifications/webhook.js";
import { eventHub } from "../realtime/event-hub.js";
import { probeMonitor } from "../uptime/prober.js";

const TICK_INTERVAL_MS = 15_000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runProbes(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const monitors = await listEnabledMonitorsDueForProbe();

    for (const monitor of monitors) {
      const result = await probeMonitor(monitor);
      const row = await insertCheck({
        monitorId: monitor.id,
        status: result.status,
        latencyMs: result.latencyMs,
        statusCode: result.statusCode,
        errorMessage: result.errorMessage,
      });

      const check = {
        id: row.id,
        monitorId: row.monitor_id,
        status: row.status as "up" | "down" | "degraded",
        latencyMs: row.latency_ms,
        statusCode: row.status_code,
        errorMessage: row.error_message ?? undefined,
        checkedAt: row.checked_at.toISOString(),
        monitorName: monitor.name,
      };

      eventHub.broadcastUptime(check);

      const alerts = await alertEngine.evaluateUptime(monitor.id);
      for (const alert of alerts) {
        eventHub.broadcastAlert(alert);
        if (!alert.suppressed) {
          void notifyWebhook(alert).catch((err) => {
            console.error("[webhook] Falha ao notificar:", err);
          });
        }
      }
    }
  } catch (error) {
    console.error("[jobs] Falha nos uptime probes:", error);
  } finally {
    running = false;
  }
}

export function startUptimeProbeJob(): void {
  if (timer) return;

  void runProbes();
  timer = setInterval(() => void runProbes(), TICK_INTERVAL_MS);
  timer.unref();

  console.log("[jobs] Uptime probes a cada 15s (respeita interval_sec por monitor)");
}

export function stopUptimeProbeJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
