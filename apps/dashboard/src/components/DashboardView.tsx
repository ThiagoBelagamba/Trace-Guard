"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { EventCharts } from "./EventCharts";
import { EventTable } from "./EventTable";
import { FiltersBar, type FilterValues } from "./FiltersBar";
import { RaspPanel } from "./RaspPanel";
import { RaspStatsCharts } from "./RaspStatsCharts";
import { TraceDrawer } from "./TraceDrawer";
import { UptimeMonitorForm } from "./UptimeMonitorForm";
import { UptimePanel } from "./UptimePanel";
import { UptimeTimeline } from "./UptimeTimeline";
import { PageHeader } from "./PageHeader";
import { Sidebar, TAB_META, type Tab } from "./Sidebar";
import { Button, Chip } from "./ui/Controls";
import { countByLevel, orderLevels } from "../lib/view";

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

const LEVEL_SUMMARY_LABELS: Record<string, string> = {
  error: "erros",
  warn: "warn",
  info: "info",
  debug: "debug",
};

function EventsSummary({
  total,
  byLevel,
}: {
  total: number;
  byLevel: Record<string, number>;
}) {
  return (
    <>
      <strong>{total}</strong> eventos na sessão
      {orderLevels(byLevel).map(({ level, count }) => (
        <span key={level}>
          {" · "}
          <strong>{count}</strong> {LEVEL_SUMMARY_LABELS[level] ?? level}
        </span>
      ))}
    </>
  );
}

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
  const [monitorFormOpen, setMonitorFormOpen] = useState(false);
  const newMonitorButtonRef = useRef<HTMLButtonElement>(null);

  function closeMonitorForm() {
    setMonitorFormOpen(false);
    requestAnimationFrame(() => newMonitorButtonRef.current?.focus());
  }
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

  const eventLevelCounts = useMemo(
    () => countByLevel(filteredEvents),
    [filteredEvents]
  );

  const actionableAlerts = useMemo(
    () => alerts.filter((a) => !a.suppressed).length,
    [alerts]
  );

  const raspTotal = useMemo(
    () => Object.values(raspStats.byThreatType).reduce((acc, n) => acc + n, 0),
    [raspStats.byThreatType]
  );

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
      <div className="flex min-h-screen items-center justify-center bg-tg-bg text-sm text-tg-text-2">
        Carregando dashboard…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-wrap bg-tg-bg text-tg-text">
      <Sidebar
        tab={tab}
        onTabChange={setTab}
        actionableAlerts={actionableAlerts}
        connected={connected}
        error={error}
        eventCount={filteredEvents.length}
      />

      <main className="box-border flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-4 pb-12 pt-5 sm:px-10">
        {tab === "events" && (
          <>
            <PageHeader
              section="Eventos"
              icon={TAB_META.events.icon}
              title="Eventos"
              summary={<EventsSummary total={filteredEvents.length} byLevel={eventLevelCounts} />}
              actions={
                <FiltersBar
                  filters={filters}
                  onChange={setFilters}
                  services={services}
                />
              }
            />
            <EventCharts stats={stats} />
            <EventTable
              events={filteredEvents}
              onSelectTrace={setSelectedTraceId}
              live={connected}
            />
          </>
        )}

        {tab === "alerts" && (
          <>
            <PageHeader
              section="Alertas"
              icon={TAB_META.alerts.icon}
              title="Alertas"
              summary={
                <>
                  <strong>{alertStats.fired}</strong> acionáveis ·{" "}
                  <strong>{alertStats.suppressed}</strong> suprimidos por cooldown nas últimas 24h
                </>
              }
            />
            <AlertStatsBanner stats={alertStats} />
            <AlertsPanel alerts={alerts} />
          </>
        )}

        {tab === "security" && (
          <>
            <PageHeader
              section="Segurança"
              crumb="RASP"
              icon={TAB_META.security.icon}
              title="Segurança"
              summary={
                <>
                  <strong>{raspTotal}</strong> ameaças nas últimas 24h ·{" "}
                  <strong>{raspStats.blocked}</strong> bloqueadas
                </>
              }
              actions={<Chip icon="clock">Últimas 24h</Chip>}
            />
            <RaspStatsCharts stats={raspStats} />
            <RaspPanel
              events={raspEvents}
              onSelectTrace={setSelectedTraceId}
              live={connected}
            />
          </>
        )}

        {tab === "uptime" && (
          <>
            <PageHeader
              section="Uptime"
              icon={TAB_META.uptime.icon}
              title="Uptime"
              summary={
                <>
                  <strong>{uptimeStats.monitors}</strong>{" "}
                  {uptimeStats.monitors === 1 ? "monitor" : "monitores"} ·{" "}
                  <strong>{uptimeStats.down}</strong> fora do ar
                </>
              }
              actions={
                <Button
                  variant="primary"
                  icon="plus"
                  ref={newMonitorButtonRef}
                  aria-expanded={monitorFormOpen}
                  aria-controls="uptime-monitor-form"
                  onClick={() => setMonitorFormOpen(true)}
                >
                  Novo monitor
                </Button>
              }
            />
            {monitorFormOpen && (
              <UptimeMonitorForm
                onSubmit={async (data) => {
                  const monitor = await createUptimeMonitor(data);
                  setMonitors((prev) => [...prev, monitor]);
                }}
                onClose={closeMonitorForm}
              />
            )}
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
