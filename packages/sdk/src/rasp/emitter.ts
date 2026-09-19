import type { RaspEvent } from "@traceguard/shared";

export interface RaspExporterConfig {
  endpoint: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  apiKey?: string;
}

/**
 * Exportador dedicado para eventos RASP (POST /api/v1/ingest/rasp).
 */
export class RaspExporter {
  private buffer: RaspEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly endpoint: string;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly apiKey?: string;

  constructor(config: RaspExporterConfig) {
    this.endpoint = config.endpoint;
    this.flushIntervalMs = config.flushIntervalMs ?? 3000;
    this.maxBatchSize = config.maxBatchSize ?? 50;
    this.apiKey = config.apiKey;
  }

  start(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => void this.flush(), this.flushIntervalMs);
    this.flushTimer.unref();
  }

  enqueue(event: RaspEvent): void {
    this.buffer.push(event);
    if (this.buffer.length >= this.maxBatchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.maxBatchSize);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
        },
        body: JSON.stringify(batch),
      });
      if (!response.ok) {
        console.error(`[traceguard-sdk] Falha no export RASP: HTTP ${response.status}`);
        this.buffer.unshift(...batch);
      }
    } catch (error) {
      console.error("[traceguard-sdk] Erro ao exportar eventos RASP:", error);
      this.buffer.unshift(...batch);
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}
