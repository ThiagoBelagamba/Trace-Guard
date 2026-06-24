import amqplib from "amqplib";
import {
  LOGS_QUEUE,
  LOGS_ROUTING_KEY,
  TELEMETRY_EXCHANGE,
  type LogEvent,
} from "@traceguard/shared";

type AmqpConnection = Awaited<ReturnType<typeof amqplib.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection["createChannel"]>>;

let connection: AmqpConnection | null = null;
let channel: AmqpChannel | null = null;

export function getRabbitMqUrl(): string {
  return (
    process.env.RABBITMQ_URL ??
    "amqp://traceguard:traceguard_dev@localhost:5672"
  );
}

/**
 * Inicializa conexão RabbitMQ e declara exchange/fila duráveis.
 * Exchange topic permite roteamento futuro por tipo (logs, metrics, traces).
 */
export async function connectRabbitMQ(): Promise<AmqpChannel> {
  if (channel) return channel;

  connection = await amqplib.connect(getRabbitMqUrl());
  channel = await connection.createChannel();

  await channel.assertExchange(TELEMETRY_EXCHANGE, "topic", { durable: true });
  await channel.assertQueue(LOGS_QUEUE, { durable: true });
  await channel.bindQueue(LOGS_QUEUE, TELEMETRY_EXCHANGE, LOGS_ROUTING_KEY);

  return channel;
}

export async function publishLogEvents(events: LogEvent[]): Promise<void> {
  const ch = await connectRabbitMQ();
  const payload = Buffer.from(JSON.stringify(events));

  ch.publish(TELEMETRY_EXCHANGE, LOGS_ROUTING_KEY, payload, {
    persistent: true,
    contentType: "application/json",
  });
}

export async function checkRabbitMQHealth(): Promise<boolean> {
  try {
    await connectRabbitMQ();
    return true;
  } catch {
    return false;
  }
}

export async function closeRabbitMQ(): Promise<void> {
  if (channel) {
    await channel.close();
    channel = null;
  }
  if (connection) {
    await connection.close();
    connection = null;
  }
}

export function getChannel(): AmqpChannel | null {
  return channel;
}
