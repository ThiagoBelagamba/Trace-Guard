import type { FastifyInstance } from "fastify";
import { raspEventBatchSchema } from "@traceguard/shared";
import {
  getRaspStats,
  insertRaspEvents,
  listRecentRaspEvents,
} from "../db/rasp.js";
import { eventHub } from "../realtime/event-hub.js";
import { alertEngine } from "../alerts/engine.js";
import { notifyWebhook } from "../notifications/webhook.js";

export async function registerRaspRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/ingest/rasp", async (request, reply) => {
    const parsed = raspEventBatchSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Payload inválido",
        details: parsed.error.flatten(),
      });
    }

    const inserted = await insertRaspEvents(parsed.data);

    for (const row of inserted) {
      const event = {
        traceId: row.trace_id,
        spanId: row.span_id ?? "",
        service: row.service,
        threatType: row.threat_type as (typeof parsed.data)[0]["threatType"],
        action: row.action as (typeof parsed.data)[0]["action"],
        clientIp: row.client_ip,
        userAgent: row.user_agent ?? undefined,
        path: row.path,
        method: row.method,
        score: row.score,
        metadata: row.metadata ?? {},
        timestamp: row.created_at.toISOString(),
      };
      eventHub.broadcastRasp(event);
    }

    const alerts = await alertEngine.evaluateRasp(inserted);
    for (const alert of alerts) {
      eventHub.broadcastAlert(alert);
      if (!alert.suppressed) {
        void notifyWebhook(alert).catch((err) => {
          console.error("[webhook] Falha ao notificar:", err);
        });
      }
    }

    return reply.status(202).send({
      accepted: parsed.data.length,
      message: "Eventos RASP persistidos",
    });
  });

  app.get<{ Querystring: { limit?: string } }>(
    "/api/v1/rasp/events",
    async (request) => {
      const limit = Math.min(
        Math.max(parseInt(request.query.limit ?? "20", 10) || 20, 1),
        100
      );
      const events = await listRecentRaspEvents(limit);
      return { count: events.length, events };
    }
  );

  app.get("/api/v1/rasp/stats", async () => {
    return getRaspStats();
  });
}
