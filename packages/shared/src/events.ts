/**
 * Contexto de rastreamento distribuído propagado entre operações assíncronas.
 * traceId identifica toda a cadeia de requisições; spanId identifica uma operação individual.
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Evento de log estruturado enviado pelo SDK para o backend de ingestão.
 * Campos obrigatórios garantem correlação e filtragem no dashboard.
 */
export interface LogEvent {
  traceId: string;
  spanId: string;
  service: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  durationMs?: number;
  timestamp: string;
}

/**
 * Evento de métrica (fase futura — contrato definido antecipadamente).
 */
export interface MetricEvent {
  traceId: string;
  spanId: string;
  service: string;
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp: string;
}

/** Constantes de mensageria RabbitMQ */
export const TELEMETRY_EXCHANGE = "traceguard.telemetry";
export const LOGS_QUEUE = "traceguard.logs";
export const LOGS_ROUTING_KEY = "logs";
