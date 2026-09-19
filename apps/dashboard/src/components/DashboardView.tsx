"use client";

import { useEffect, useMemo, useState } from "react";
import type { AlertFired, AlertStats, DashboardEvent, EventStats, RaspEvent, RaspStats, UptimeCheckWithMonitor, UptimeMonitor, UptimeStats } from "@traceguard/shared";
import {
  createUptimeMonitor,
  deleteUptimeMonitor,
  fetchAlertStats,
  fetchAlerts,
  fetchEventStats,
  fetchRaspEvents,
  fetchRaspStats,
  fetchRecentEvents,
  fetchUptimeChecks,
  fetchUptimeMonitors,
  fetchUptimeStats,
  updateUptimeMonitor,
} from "../lib/api";
import { useTelemetrySocket } from "../hooks/useTelemetrySocket";
import { AlertStatsBanner } from "./AlertStatsBanner";
import { AlertsPanel } from "./AlertsPanel";
import { ConnectionStatus } from "./ConnectionStatus";
import { EventCharts } from "./EventCharts";
import { EventTable } from "./EventTable";
import { FiltersBar, type FilterValues } from "./FiltersBar";
import { RaspPanel } from "./RaspPanel";
import { RaspStatsCharts } from "./RaspStatsCharts";
import { TraceDrawer } from "./TraceDrawer";
import { UptimeMonitorForm } from "./UptimeMonitorForm";
import { UptimePanel } from "./UptimePanel";
import { UptimeTimeline } from "./UptimeTimeline";

const EMPTY_STATS: EventStats = {
  timeline: [],
  byLevel: {},
  byService: {},
};

const EMPTY_ALERT_STATS: AlertStats = {
  fired: 0,
  suppressed: 0,
  suppressionRate: 0,
};

const EMPTY_RASP_STATS: RaspStats = {
  byThreatType: {},
  blocked: 0,
  logged: 0,
};

const EMPTY_UPTIME_STATS: UptimeStats = {
  monitors: 0,
  up: 0,
  down: 0,
  avgLatencyMs: 0,
  uptimePercent24h: {},
};

type Tab = "events" | "alerts" | "security" | "uptime";

export function DashboardView() {
  const [initialEvents, setInitialEvents] = useState<DashboardEvent[]>([]);
  const [initialAlerts, setInitialAlerts] = useState<AlertFired[]>([]);
  const [initialRasp, setInitialRasp] = useState<RaspEvent[]>([]);
  const [stats, setStats] = useState<EventStats>(EMPTY_STATS);
  const [alertStats, setAlertStats] = useState<AlertStats>(EMPTY_ALERT_STATS);
  const [raspStats, setRaspStats] = useState<RaspStats>(EMPTY_RASP_STATS);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [initialUptime, setInitialUptime] = useState<UptimeCheckWithMonitor[]>([]);
  const [uptimeStats, setUptimeStats] = useState<UptimeStats>(EMPTY_UPTIME_STATS);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("events");
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterValues>({
    service: "",
    level: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const [events, eventStats, alerts, aStats, raspEvents, rStats, uptimeMons, uptimeCh, uStats] =
          await Promise.all([
          fetchRecentEvents(50),
          fetchEventStats("1m"),
          fetchAlerts(20),
          fetchAlertStats(),
          fetchRaspEvents(20),
          fetchRaspStats(),
          fetchUptimeMonitors(),
          fetchUptimeChecks(50),
          fetchUptimeStats(),
        ]);
        setInitialEvents(events);
        setStats(eventStats);
        setInitialAlerts(alerts);
        setAlertStats(aStats);
        setInitialRasp(raspEvents);
        setRaspStats(rStats);
        setMonitors(uptimeMons);
        setInitialUptime(uptimeCh);
        setUptimeStats(uStats);
      } catch (err) {
        console.error("[dashboard] Falha ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const wsFilters = useMemo(
    () => ({
      service: filters.service || undefined,
      level: filters.level || undefined,
    }),
    [filters.service, filters.level]
  );

  const { events, alerts, raspEvents, uptimeChecks, connected, error } =
    useTelemetrySocket(
      initialEvents,
      initialAlerts,
      initialRasp,
      initialUptime,
      wsFilters
    );

  const latestUptimeMap = useMemo(() => {
    const map = new Map<string, UptimeCheckWithMonitor>();
    for (const check of uptimeChecks) {
      if (!map.has(check.monitorId)) {
        map.set(check.monitorId, check);
      }
    }
    return map;
  }, [uptimeChecks]);

  const services = useMemo(() => {
    const set = new Set(events.map((e) => e.service));
    return Array.from(set).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filters.service && e.service !== filters.service) return false;
      if (filters.level && e.level !== filters.level) return false;
      return true;
    });
  }, [events, filters.service, filters.level]);

  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => {
      void fetchEventStats("1m").then(setStats).catch(console.error);
      void fetchAlertStats().then(setAlertStats).catch(console.error);
      void fetchRaspStats().then(setRaspStats).catch(console.error);
      void fetchUptimeStats().then(setUptimeStats).catch(console.error);
    }, 30_000);
    return () => clearInterval(timer);
  }, [connected]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Carregando dashboard…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-border bg-surface-card px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">TraceGuard</h1>
            <p className="text-sm text-gray-500">
              Observabilidade em tempo real
            </p>
          </div>
          <ConnectionStatus
            connected={connected}
            error={error}
            eventCount={filteredEvents.length}
          />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <div className="flex gap-2 border-b border-surface-border pb-2">
          <button
            type="button"
            onClick={() => setTab("events")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "events"
                ? "border-b-2 border-emerald-400 text-emerald-300"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Eventos
          </button>
          <button
            type="button"
            onClick={() => setTab("alerts")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "alerts"
                ? "border-b-2 border-amber-400 text-amber-300"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Alertas
          </button>
          <button
            type="button"
            onClick={() => setTab("security")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "security"
                ? "border-b-2 border-purple-400 text-purple-300"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Segurança
          </button>
          <button
            type="button"
            onClick={() => setTab("uptime")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "uptime"
                ? "border-b-2 border-blue-400 text-blue-300"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Uptime
          </button>
        </div>

        {tab === "events" && (
          <>
            <FiltersBar
              filters={filters}
              onChange={setFilters}
              services={services}
            />
            <EventCharts stats={stats} />
            <EventTable events={filteredEvents} onSelectTrace={setSelectedTraceId} />
          </>
        )}

        {tab === "alerts" && (
          <>
            <AlertStatsBanner stats={alertStats} />
            <AlertsPanel alerts={alerts} />
          </>
        )}

        {tab === "security" && (
          <>
            <RaspStatsCharts stats={raspStats} />
            <RaspPanel events={raspEvents} onSelectTrace={setSelectedTraceId} />
          </>
        )}

        {tab === "uptime" && (
          <>
            <UptimeMonitorForm
              onSubmit={async (data) => {
                const monitor = await createUptimeMonitor(data);
                setMonitors((prev) => [...prev, monitor]);
              }}
            />
            <UptimePanel
              monitors={monitors}
              stats={uptimeStats}
              latestChecks={latestUptimeMap}
              onToggle={async (id, enabled) => {
                const updated = await updateUptimeMonitor(id, { enabled });
                setMonitors((prev) =>
                  prev.map((m) => (m.id === id ? updated : m))
                );
              }}
              onDelete={async (id) => {
                await deleteUptimeMonitor(id);
                setMonitors((prev) => prev.filter((m) => m.id !== id));
              }}
            />
            <UptimeTimeline checks={uptimeChecks} />
          </>
        )}
      </main>
      <TraceDrawer
        traceId={selectedTraceId}
        onClose={() => setSelectedTraceId(null)}
      />
    </div>
  );
}
