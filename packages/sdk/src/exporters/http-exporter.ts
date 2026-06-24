import type { LogEvent } from "@traceguard/shared";

export interface ExporterConfig {
  endpoint: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
}

/**
 * Exportador HTTP com buffer em memória e flush periódico.
 * Decisão técnica: batch export reduz overhead de rede e alinha com
 * o amortecimento de picos via RabbitMQ no backend.
 */
export class HttpExporter {
  private buffer: LogEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly endpoint: string;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;

  constructor(config: ExporterConfig) {
    this.endpoint = config.endpoint;
    this.flushIntervalMs = config.flushIntervalMs ?? 5000;
    this.maxBatchSize = config.maxBatchSize ?? 100;
  }

  start(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);

    // Não impede o processo de encerrar por causa do timer
    this.flushTimer.unref();
  }

  enqueue(event: LogEvent): void {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        console.error(
          `[traceguard-sdk] Falha no export: HTTP ${response.status}`
        );
        // Re-enfileira em caso de falha transitória
        this.buffer.unshift(...batch);
      }
    } catch (error) {
      console.error("[traceguard-sdk] Erro ao exportar telemetria:", error);
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
