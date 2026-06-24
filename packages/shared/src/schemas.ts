import { z } from "zod";

export const traceContextSchema = z.object({
  traceId: z.string().min(1).max(32),
  spanId: z.string().min(1).max(16),
  parentSpanId: z.string().max(16).optional(),
});

export const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export const logEventSchema = z.object({
  traceId: z.string().min(1).max(32),
  spanId: z.string().min(1).max(16),
  service: z.string().min(1).max(128),
  level: logLevelSchema,
  message: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  durationMs: z.number().nonnegative().optional(),
  timestamp: z.string().datetime(),
});

export const logEventBatchSchema = z.array(logEventSchema).min(1).max(1000);

export const raspThreatTypeSchema = z.enum([
  "rate_limit",
  "bot_user_agent",
  "sequential_scan",
  "missing_headers",
]);

export const raspActionSchema = z.enum(["logged", "blocked"]);

export const raspEventSchema = z.object({
  traceId: z.string().min(1).max(32),
  spanId: z.string().min(1).max(16),
  service: z.string().min(1).max(128),
  threatType: raspThreatTypeSchema,
  action: raspActionSchema,
  clientIp: z.string().min(1).max(45),
  userAgent: z.string().optional(),
  path: z.string().min(1),
  method: z.string().min(1).max(16),
  score: z.number().int().min(0).max(100),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
});

export const raspEventBatchSchema = z.array(raspEventSchema).min(1).max(1000);

export const uptimeStatusSchema = z.enum(["up", "down", "degraded"]);

export const uptimeMonitorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(128),
  url: z.string().url(),
  intervalSec: z.number().int().min(10).max(3600),
  timeoutMs: z.number().int().min(1000).max(60000),
  expectedStatus: z.number().int().min(100).max(599),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
});

export const createUptimeMonitorSchema = z.object({
  name: z.string().min(1).max(128),
  url: z.string().url(),
  intervalSec: z.number().int().min(10).max(3600).optional(),
  timeoutMs: z.number().int().min(1000).max(60000).optional(),
  expectedStatus: z.number().int().min(100).max(599).optional(),
  enabled: z.boolean().optional(),
});

export const updateUptimeMonitorSchema = createUptimeMonitorSchema.partial();

export const uptimeCheckSchema = z.object({
  id: z.string().uuid(),
  monitorId: z.string().uuid(),
  status: uptimeStatusSchema,
  latencyMs: z.number().int().nonnegative().nullable(),
  statusCode: z.number().int().nullable(),
  errorMessage: z.string().optional(),
  checkedAt: z.string().datetime(),
});

export type LogEventInput = z.infer<typeof logEventSchema>;
export type RaspEventInput = z.infer<typeof raspEventSchema>;
export type CreateUptimeMonitorInput = z.infer<typeof createUptimeMonitorSchema>;
export type UpdateUptimeMonitorInput = z.infer<typeof updateUptimeMonitorSchema>;
