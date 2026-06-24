"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AlertFired, DashboardEvent, RaspEvent, UptimeCheckWithMonitor, WsMessage } from "@traceguard/shared";
import { getWsUrl } from "../lib/api";

const MAX_EVENTS = 100;
const MAX_ALERTS = 50;
const MAX_RASP = 50;
const MAX_UPTIME = 50;
const MAX_BACKOFF_MS = 30_000;

export interface TelemetryFilters {
  service?: string;
  level?: string;
}

export function useTelemetrySocket(
  initialEvents: DashboardEvent[],
  initialAlertsOrFilters: AlertFired[] | TelemetryFilters = [],
  maybeRasp?: RaspEvent[],
  maybeUptimeOrFilters?: UptimeCheckWithMonitor[] | TelemetryFilters,
  maybeFilters?: TelemetryFilters
) {
  let initialAlerts: AlertFired[];
  let initialRasp: RaspEvent[];
  let initialUptime: UptimeCheckWithMonitor[];
  let filters: TelemetryFilters;

  if (maybeFilters !== undefined) {
    initialAlerts = initialAlertsOrFilters as AlertFired[];
    initialRasp = maybeRasp ?? [];
    initialUptime = (maybeUptimeOrFilters as UptimeCheckWithMonitor[]) ?? [];
    filters = maybeFilters;
  } else if (
    maybeUptimeOrFilters !== undefined &&
    !Array.isArray(maybeUptimeOrFilters)
  ) {
    initialAlerts = initialAlertsOrFilters as AlertFired[];
    initialRasp = maybeRasp ?? [];
    initialUptime = [];
    filters = maybeUptimeOrFilters;
  } else if (Array.isArray(maybeUptimeOrFilters)) {
    initialAlerts = initialAlertsOrFilters as AlertFired[];
    initialRasp = maybeRasp ?? [];
    initialUptime = maybeUptimeOrFilters;
    filters = {};
  } else if (Array.isArray(initialAlertsOrFilters)) {
    initialAlerts = initialAlertsOrFilters;
    initialRasp = maybeRasp ?? [];
    initialUptime = [];
    filters = {};
  } else {
    initialAlerts = [];
    initialRasp = maybeRasp ?? [];
    initialUptime = [];
    filters = initialAlertsOrFilters;
  }

  const serviceFilter = filters.service;
  const levelFilter = filters.level;
  const [events, setEvents] = useState<DashboardEvent[]>(initialEvents);
  const [alerts, setAlerts] = useState<AlertFired[]>(initialAlerts);
  const [raspEvents, setRaspEvents] = useState<RaspEvent[]>(initialRasp);
  const [uptimeChecks, setUptimeChecks] =
    useState<UptimeCheckWithMonitor[]>(initialUptime);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prependEvent = useCallback((event: DashboardEvent) => {
    setEvents((prev) => {
      if (prev.some((e) => e.id === event.id)) return prev;
      return [event, ...prev].slice(0, MAX_EVENTS);
    });
  }, []);

  const prependAlert = useCallback((alert: AlertFired) => {
    setAlerts((prev) => {
      if (prev.some((a) => a.id === alert.id)) return prev;
      return [alert, ...prev].slice(0, MAX_ALERTS);
    });
  }, []);

  const prependRasp = useCallback((event: RaspEvent) => {
    setRaspEvents((prev) => {
      const key = `${event.traceId}-${event.timestamp}-${event.path}`;
      if (prev.some((e) => `${e.traceId}-${e.timestamp}-${e.path}` === key)) return prev;
      return [event, ...prev].slice(0, MAX_RASP);
    });
  }, []);

  const prependUptime = useCallback((check: UptimeCheckWithMonitor) => {
    setUptimeChecks((prev) => {
      if (prev.some((c) => c.id === check.id)) return prev;
      return [check, ...prev].slice(0, MAX_UPTIME);
    });
  }, []);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  useEffect(() => {
    setAlerts(initialAlerts);
  }, [initialAlerts]);

  useEffect(() => {
    setRaspEvents(initialRasp);
  }, [initialRasp]);

  useEffect(() => {
    setUptimeChecks(initialUptime);
  }, [initialUptime]);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;

      const ws = new WebSocket(getWsUrl({ service: serviceFilter, level: levelFilter }));
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        backoffRef.current = 1000;
      };

      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data as string) as WsMessage;
          if (parsed.type === "event") {
            prependEvent(parsed.data);
          } else if (parsed.type === "alert") {
            prependAlert(parsed.data);
          } else if (parsed.type === "rasp") {
            prependRasp(parsed.data);
          } else if (parsed.type === "uptime") {
            prependUptime(parsed.data);
          }
        } catch {
          // ignora mensagens malformadas
        }
      };

      ws.onerror = () => {
        setError("Erro na conexão WebSocket");
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (cancelled) return;

        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [serviceFilter, levelFilter, prependEvent, prependAlert, prependRasp, prependUptime]);

  return { events, alerts, raspEvents, uptimeChecks, connected, error };
}
