import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { registerRoutes } from "./api/routes.js";
import { registerRaspRoutes } from "./api/rasp-routes.js";
import { registerUptimeRoutes } from "./api/uptime-routes.js";
import { startTelemetryConsumer } from "./consumers/telemetry-consumer.js";
import { ensureDefaultRules } from "./db/alerts.js";
import { checkDatabaseHealth, closePool } from "./db/pool.js";
import { startStatsRefreshJob, stopStatsRefreshJob } from "./jobs/refresh-stats.js";
import { startUptimeProbeJob, stopUptimeProbeJob } from "./jobs/uptime-probes.js";
import {
  checkRabbitMQHealth,
  closeRabbitMQ,
} from "./publishers/rabbitmq.js";
import { eventHub } from "./realtime/event-hub.js";
import { authorizeApiRequest, extractProvidedKey } from "./auth/authorize.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

async function waitForDependencies(
  maxAttempts = 30,
  delayMs = 2000
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const [dbOk, mqOk] = await Promise.all([
      checkDatabaseHealth(),
      checkRabbitMQHealth(),
    ]);

    if (dbOk && mqOk) {
      console.log("[backend] Dependências prontas (PostgreSQL + RabbitMQ)");
      return;
    }

    console.log(
      `[backend] Aguardando dependências... tentativa ${attempt}/${maxAttempts} (db=${dbOk}, mq=${mqOk})`
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Timeout aguardando PostgreSQL ou RabbitMQ");
}

async function main(): Promise<void> {
  await waitForDependencies();

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  });

  await app.register(websocket);

  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS") return;

    const query = request.query as { token?: string };
    const decision = authorizeApiRequest({
      path: request.url,
      apiKey: process.env.API_KEY,
      providedKey: extractProvidedKey(
        request.headers as Record<string, string | string[] | undefined>
      ),
      wsToken: query.token,
    });

    if (decision === "unauthorized") {
      return reply.status(401).send({ error: "Não autorizado" });
    }
  });

  await registerRoutes(app);
  await registerRaspRoutes(app);
  await registerUptimeRoutes(app);
  await eventHub.init();
  await ensureDefaultRules();
  await startTelemetryConsumer();
  startStatsRefreshJob();
  startUptimeProbeJob();

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`[backend] Servidor rodando em http://localhost:${PORT}`);
}

async function shutdown(): Promise<void> {
  stopStatsRefreshJob();
  stopUptimeProbeJob();
  eventHub.closeAll();
  await closeRabbitMQ();
  await closePool();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((error) => {
  console.error("[backend] Erro fatal:", error);
  process.exit(1);
});
