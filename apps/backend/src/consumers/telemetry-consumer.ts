import { alertEngine } from "../alerts/engine.js";
import { LOGS_QUEUE, logEventBatchSchema } from "@traceguard/shared";
import { toDashboardEvent } from "../db/mappers.js";
import { insertTelemetryEvents } from "../db/pool.js";
import { connectRabbitMQ } from "../publishers/rabbitmq.js";
import { eventHub } from "../realtime/event-hub.js";
import { notifyWebhook } from "../notifications/webhook.js";

/**
 * Worker que consome mensagens da fila traceguard.logs e persiste em PostgreSQL.
 * Após persistência, faz broadcast via WebSocket para clientes do dashboard.
 */
export async function startTelemetryConsumer(): Promise<void> {
  const channel = await connectRabbitMQ();

  await channel.prefetch(10);

  await channel.consume(
    LOGS_QUEUE,
    async (msg) => {
      if (!msg) return;

      try {
        const raw = JSON.parse(msg.content.toString());
        const events = logEventBatchSchema.parse(raw);

        const inserted = await insertTelemetryEvents(events);

        for (const row of inserted) {
          eventHub.broadcast(toDashboardEvent(row));
        }

        const alerts = await alertEngine.evaluate(inserted);
        for (const alert of alerts) {
          eventHub.broadcastAlert(alert);
          if (!alert.suppressed) {
            void notifyWebhook(alert).catch((err) => {
              console.error("[webhook] Falha ao notificar:", err);
            });
          }
        }

        channel.ack(msg);
      } catch (error) {
        console.error("[consumer] Falha ao processar mensagem:", error);
        channel.nack(msg, false, false);
      }
    },
    { noAck: false }
  );

  console.log(`[consumer] Escutando fila "${LOGS_QUEUE}"`);
}
