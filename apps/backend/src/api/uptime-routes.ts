import type { FastifyInstance } from "fastify";
import {
  createUptimeMonitorSchema,
  updateUptimeMonitorSchema,
} from "@traceguard/shared";
import {
  createMonitor,
  deleteMonitor,
  getUptimeStats,
  listMonitors,
  listRecentChecks,
  updateMonitor,
} from "../db/uptime.js";

export async function registerUptimeRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get("/api/v1/uptime/monitors", async () => {
    const monitors = await listMonitors();
    return { count: monitors.length, monitors };
  });

  app.post("/api/v1/uptime/monitors", async (request, reply) => {
    const parsed = createUptimeMonitorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Payload inválido",
        details: parsed.error.flatten(),
      });
    }
    const monitor = await createMonitor(parsed.data);
    return reply.status(201).send({ monitor });
  });

  app.patch<{ Params: { id: string } }>(
    "/api/v1/uptime/monitors/:id",
    async (request, reply) => {
      const parsed = updateUptimeMonitorSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Payload inválido",
          details: parsed.error.flatten(),
        });
      }
      const monitor = await updateMonitor(request.params.id, parsed.data);
      if (!monitor) {
        return reply.status(404).send({ error: "Monitor não encontrado" });
      }
      return { monitor };
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/uptime/monitors/:id",
    async (request, reply) => {
      const deleted = await deleteMonitor(request.params.id);
      if (!deleted) {
        return reply.status(404).send({ error: "Monitor não encontrado" });
      }
      return reply.status(204).send();
    }
  );

  app.get<{ Querystring: { monitorId?: string; limit?: string } }>(
    "/api/v1/uptime/checks",
    async (request) => {
      const limit = Math.min(
        Math.max(parseInt(request.query.limit ?? "50", 10) || 50, 1),
        200
      );
      const checks = await listRecentChecks(
        request.query.monitorId ?? null,
        limit
      );
      return { count: checks.length, checks };
    }
  );

  app.get("/api/v1/uptime/stats", async () => {
    return getUptimeStats();
  });
}
