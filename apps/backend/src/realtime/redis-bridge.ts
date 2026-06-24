import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import type { WsMessage } from "@traceguard/shared";

const CHANNEL = "traceguard:realtime";
const REDIS_URL = process.env.REDIS_URL;

export const instanceId = randomUUID();

let publisher: Redis | null = null;
let subscriber: Redis | null = null;

export interface RedisRealtimeMessage {
  originInstanceId: string;
  message: WsMessage;
}

type LocalHandler = (message: WsMessage, fromRemote: boolean) => void;

let onMessage: LocalHandler | null = null;

export async function initRedisBridge(
  handler: LocalHandler
): Promise<boolean> {
  if (!REDIS_URL) return false;

  onMessage = handler;
  publisher = new Redis(REDIS_URL);
  subscriber = new Redis(REDIS_URL);

  await subscriber.subscribe(CHANNEL);

  subscriber.on("message", (_channel, payload) => {
    try {
      const parsed = JSON.parse(payload) as RedisRealtimeMessage;
      if (parsed.originInstanceId === instanceId) return;
      onMessage?.(parsed.message, true);
    } catch (error) {
      console.error("[redis] Mensagem inválida:", error);
    }
  });

  console.log(`[redis] Bridge ativo (instance=${instanceId.slice(0, 8)})`);
  return true;
}

export function publishRealtime(message: WsMessage): void {
  if (!publisher) return;

  const payload: RedisRealtimeMessage = {
    originInstanceId: instanceId,
    message,
  };

  void publisher.publish(CHANNEL, JSON.stringify(payload)).catch((err) => {
    console.error("[redis] Falha ao publicar:", err);
  });
}

export async function closeRedisBridge(): Promise<void> {
  if (subscriber) {
    await subscriber.unsubscribe(CHANNEL);
    subscriber.disconnect();
    subscriber = null;
  }
  if (publisher) {
    publisher.disconnect();
    publisher = null;
  }
}

export function isRedisEnabled(): boolean {
  return Boolean(REDIS_URL);
}
