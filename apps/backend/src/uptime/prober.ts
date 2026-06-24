import type { UptimeMonitor, UptimeStatus } from "@traceguard/shared";

export interface ProbeResult {
  status: UptimeStatus;
  latencyMs: number | null;
  statusCode: number | null;
  errorMessage?: string;
}

/**
 * Executa probe HTTP com timeout configurável.
 */
export async function probeMonitor(
  monitor: UptimeMonitor
): Promise<ProbeResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), monitor.timeoutMs);

  try {
    const response = await fetch(monitor.url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "TraceGuard-Uptime/1.0" },
    });

    const latencyMs = Date.now() - start;
    clearTimeout(timer);

    if (response.status === monitor.expectedStatus) {
      return {
        status: "up",
        latencyMs,
        statusCode: response.status,
      };
    }

    return {
      status: "degraded",
      latencyMs,
      statusCode: response.status,
      errorMessage: `Status inesperado: ${response.status} (esperado ${monitor.expectedStatus})`,
    };
  } catch (error) {
    clearTimeout(timer);
    const message =
      error instanceof Error ? error.message : "Erro desconhecido no probe";

    return {
      status: "down",
      latencyMs: null,
      statusCode: null,
      errorMessage: message,
    };
  }
}
