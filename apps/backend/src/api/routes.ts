import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { logEventBatchSchema } from "@traceguard/shared";
import {
  getAlertStats,
  listAllRules,
  listRecentAlerts,
  setRuleEnabled,
} from "../db/alerts.js";
import { toDashboardEvent } from "../db/mappers.js";
import { getEventStats, listEventsByTraceId, listRecentEvents } from "../db/pool.js";
import { listRaspEventsByTraceId } from "../db/rasp.js";
import { publishLogEvents } from "../publishers/rabbitmq.js";
import { eventHub } from "../realtime/event-hub.js";
import { getTraceDetail } from "../traces/get-trace.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "traceguard-backend",
      wsClients: eventHub.clientCount,
    };
  });

  app.post("/api/v1/ingest", async (request, reply) => {
    const parsed = logEventBatchSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Payload inválido",
        details: parsed.error.flatten(),
      });
    }

    await publishLogEvents(parsed.data);

    return reply.status(202).send({
      accepted: parsed.data.length,
      message: "Eventos enfileirados para processamento",
    });
  });

  app.get<{ Querystring: { limit?: string } }>(
    "/api/v1/events",
    async (request) => {
      const limit = Math.min(
        Math.max(parseInt(request.query.limit ?? "10", 10) || 10, 1),
        100
      );

      const rows = await listRecentEvents(limit);

      return {
        count: rows.length,
        events: rows.map(toDashboardEvent),
      };
    }
  );

  app.get<{ Params: { traceId: string } }>(
    "/api/v1/traces/:traceId",
    async (request, reply) => {
      const detail = await getTraceDetail(request.params.traceId, {
        listEventsByTraceId: async (traceId) => {
          const rows = await listEventsByTraceId(traceId);
          return rows.map(toDashboardEvent);
        },
        listRaspByTraceId: (traceId) => listRaspEventsByTraceId(traceId),
      });

      if (!detail) {
        return reply.status(404).send({ error: "Trace não encontrado" });
      }

      return detail;
    }
  );

  app.get<{ Querystring: { since?: string; bucket?: string } }>(
    "/api/v1/events/stats",
    async (request) => {
      const since = request.query.since
        ? new Date(request.query.since)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);

      const bucketParam = request.query.bucket ?? "1m";
      const bucketMinutes = bucketParam === "5m" ? 5 : 1;

      return getEventStats(since, bucketMinutes);
    }
  );

  app.get<{ Querystring: { limit?: string } }>(
    "/api/v1/alerts",
    async (request) => {
      const limit = Math.min(
        Math.max(parseInt(request.query.limit ?? "20", 10) || 20, 1),
        100
      );
      const alerts = await listRecentAlerts(limit);
      return { count: alerts.length, alerts };
    }
  );

  app.get("/api/v1/alerts/stats", async () => {
    return getAlertStats();
  });

  app.get("/api/v1/alerts/rules", async () => {
    const rules = await listAllRules();
    return { count: rules.length, rules };
  });

  app.patch<{
    Params: { id: string };
    Body: { enabled?: boolean };
  }>("/api/v1/alerts/rules/:id", async (request, reply) => {
    if (typeof request.body?.enabled !== "boolean") {
      return reply.status(400).send({ error: "Campo enabled é obrigatório" });
    }

    const rule = await setRuleEnabled(request.params.id, request.body.enabled);
    if (!rule) {
      return reply.status(404).send({ error: "Regra não encontrada" });
    }

    return { rule };
  });

  app.get<{ Querystring: { service?: string; level?: string } }>(
    "/api/v1/ws/events",
    { websocket: true },
    (socket, request) => {
      const filters = {
        service: request.query.service,
        level: request.query.level,
      };

      eventHub.subscribe(socket as WebSocket, filters);

      socket.on("close", () => {
        eventHub.unsubscribe(socket as WebSocket);
      });
    }
  );
}
