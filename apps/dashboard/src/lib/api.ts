import type {
  AlertFired,
  AlertStats,
  CreateUptimeMonitorInput,
  DashboardEvent,
  EventStats,
  RaspEvent,
  RaspStats,
  UptimeCheckWithMonitor,
  UptimeMonitor,
  UptimeStats,
} from "@traceguard/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function fetchRecentEvents(
  limit = 50
): Promise<DashboardEvent[]> {
  const res = await fetch(`${API_URL}/api/v1/events?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Falha ao buscar eventos: ${res.status}`);
  const data = (await res.json()) as { events: DashboardEvent[] };
  return data.events;
}

export async function fetchEventStats(
  bucket: "1m" | "5m" = "1m"
): Promise<EventStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${API_URL}/api/v1/events/stats?since=${encodeURIComponent(since)}&bucket=${bucket}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Falha ao buscar stats: ${res.status}`);
  return res.json() as Promise<EventStats>;
}

export function getWsUrl(filters?: {
  service?: string;
  level?: string;
}): string {
  const base =
    process.env.NEXT_PUBLIC_WS_URL ??
    "ws://localhost:3001/api/v1/ws/events";

  const url = new URL(base);
  if (filters?.service) url.searchParams.set("service", filters.service);
  if (filters?.level) url.searchParams.set("level", filters.level);
  return url.toString();
}

export async function fetchAlerts(limit = 20): Promise<AlertFired[]> {
  const res = await fetch(`${API_URL}/api/v1/alerts?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Falha ao buscar alertas: ${res.status}`);
  const data = (await res.json()) as { alerts: AlertFired[] };
  return data.alerts;
}

export async function fetchAlertStats(): Promise<AlertStats> {
  const res = await fetch(`${API_URL}/api/v1/alerts/stats`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Falha ao buscar stats de alertas: ${res.status}`);
  return res.json() as Promise<AlertStats>;
}

export async function fetchRaspEvents(limit = 20): Promise<RaspEvent[]> {
  const res = await fetch(`${API_URL}/api/v1/rasp/events?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Falha ao buscar eventos RASP: ${res.status}`);
  const data = (await res.json()) as { events: RaspEvent[] };
  return data.events;
}

export async function fetchRaspStats(): Promise<RaspStats> {
  const res = await fetch(`${API_URL}/api/v1/rasp/stats`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Falha ao buscar stats RASP: ${res.status}`);
  return res.json() as Promise<RaspStats>;
}

export async function fetchUptimeMonitors(): Promise<UptimeMonitor[]> {
  const res = await fetch(`${API_URL}/api/v1/uptime/monitors`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Falha ao buscar monitors: ${res.status}`);
  const data = (await res.json()) as { monitors: UptimeMonitor[] };
  return data.monitors;
}

export async function fetchUptimeStats(): Promise<UptimeStats> {
  const res = await fetch(`${API_URL}/api/v1/uptime/stats`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Falha ao buscar stats uptime: ${res.status}`);
  return res.json() as Promise<UptimeStats>;
}

export async function fetchUptimeChecks(
  limit = 50,
  monitorId?: string
): Promise<UptimeCheckWithMonitor[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (monitorId) params.set("monitorId", monitorId);
  const res = await fetch(`${API_URL}/api/v1/uptime/checks?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Falha ao buscar checks: ${res.status}`);
  const data = (await res.json()) as { checks: UptimeCheckWithMonitor[] };
  return data.checks;
}

export async function createUptimeMonitor(
  input: CreateUptimeMonitorInput
): Promise<UptimeMonitor> {
  const res = await fetch(`${API_URL}/api/v1/uptime/monitors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Falha ao criar monitor: ${res.status}`);
  const data = (await res.json()) as { monitor: UptimeMonitor };
  return data.monitor;
}

export async function updateUptimeMonitor(
  id: string,
  patch: { enabled?: boolean }
): Promise<UptimeMonitor> {
  const res = await fetch(`${API_URL}/api/v1/uptime/monitors/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Falha ao atualizar monitor: ${res.status}`);
  const data = (await res.json()) as { monitor: UptimeMonitor };
  return data.monitor;
}

export async function deleteUptimeMonitor(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/uptime/monitors/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Falha ao remover monitor: ${res.status}`);
}
