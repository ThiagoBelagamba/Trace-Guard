import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import type {
  AlertFired,
  DashboardEvent,
  RaspEvent,
  UptimeCheckWithMonitor,
  WsClientFilters,
  WsMessage,
} from "@traceguard/shared";
import {
  initRedisBridge,
  publishRealtime,
  closeRedisBridge,
} from "./redis-bridge.js";

interface WsClient {
  id: string;
  socket: WebSocket;
  filters: WsClientFilters;
}

/**
 * Hub in-memory para fan-out de eventos em tempo real via WebSocket.
 * Com REDIS_URL, replica mensagens entre instâncias via pub/sub.
 */
class EventHub {
  private clients = new Map<WebSocket, WsClient>();
  private redisReady = false;

  async init(): Promise<void> {
    this.redisReady = await initRedisBridge((message, fromRemote) => {
      if (fromRemote) {
        this.deliverLocal(message);
      }
    });
  }

  subscribe(socket: WebSocket, filters: WsClientFilters = {}): string {
    const clientId = randomUUID();
    this.clients.set(socket, { id: clientId, socket, filters });

    const message: WsMessage = { type: "connected", clientId };
    socket.send(JSON.stringify(message));

    return clientId;
  }

  unsubscribe(socket: WebSocket): void {
    this.clients.delete(socket);
  }

  closeAll(): void {
    for (const { socket } of this.clients.values()) {
      socket.close();
    }
    this.clients.clear();
    void closeRedisBridge();
  }

  get clientCount(): number {
    return this.clients.size;
  }

  private deliverLocal(message: WsMessage): void {
    const payload = JSON.stringify(message);

    for (const [socket, client] of this.clients) {
      if (socket.readyState !== WebSocket.OPEN) {
        this.clients.delete(socket);
        continue;
      }

      if (!this.matchesFilters(message, client.filters)) continue;
      socket.send(payload);
    }
  }

  private matchesFilters(
    message: WsMessage,
    filters: WsClientFilters
  ): boolean {
    if (message.type === "event") {
      if (filters.service && message.data.service !== filters.service) {
        return false;
      }
      if (filters.level && message.data.level !== filters.level) {
        return false;
      }
    }
    if (message.type === "alert") {
      if (filters.service && message.data.service !== filters.service) {
        return false;
      }
    }
    if (message.type === "rasp") {
      if (filters.service && message.data.service !== filters.service) {
        return false;
      }
    }
    return true;
  }

  private emit(message: WsMessage): void {
    this.deliverLocal(message);
    if (this.redisReady) {
      publishRealtime(message);
    }
  }

  broadcast(event: DashboardEvent): void {
    this.emit({ type: "event", data: event });
  }

  broadcastAlert(alert: AlertFired): void {
    this.emit({ type: "alert", data: alert });
  }

  broadcastRasp(event: RaspEvent): void {
    this.emit({ type: "rasp", data: event });
  }

  broadcastUptime(check: UptimeCheckWithMonitor): void {
    this.emit({ type: "uptime", data: check });
  }
}

export const eventHub = new EventHub();
