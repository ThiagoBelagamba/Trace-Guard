import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertRule } from "@traceguard/shared";
import type { RaspEventRow } from "../db/rasp.js";

vi.mock("../db/alerts.js", () => ({
  countEventsInWindow: vi.fn(),
  findErrorBursts: vi.fn(),
  insertAlertFired: vi.fn(),
  listEnabledRules: vi.fn(),
  listErrorTraceIdsInWindow: vi.fn(),
  toAlertFired: vi.fn((row: Record<string, unknown>) => ({
    id: row.id,
    ruleId: row.rule_id,
    ruleName: row.rule_name ?? "Regra",
    service: row.service,
    severity: row.severity,
    title: row.title,
    message: row.message,
    eventCount: row.event_count,
    suppressed: row.suppressed,
    firedAt: (row.fired_at as Date).toISOString(),
    metadata: row.metadata ?? {},
  })),
}));
vi.mock("../db/rasp.js", () => ({
  countRaspThreatsInWindow: vi.fn(),
  listRaspTraceIdsInWindow: vi.fn(),
}));
vi.mock("../db/uptime.js", () => ({
  countConsecutiveDown: vi.fn(),
  getMonitorById: vi.fn(),
}));

import * as alertsDb from "../db/alerts.js";
import * as raspDb from "../db/rasp.js";
import { AlertEngine } from "./engine.js";

function makeRule(overrides: Partial<AlertRule>): AlertRule {
  return {
    id: "rule",
    name: "Regra",
    ruleType: "error_count",
    service: null,
    threshold: 1,
    windowMin: 5,
    cooldownMin: 10,
    enabled: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(alertsDb.insertAlertFired).mockImplementation(async (input) => ({
    id: "alert-1",
    rule_id: input.ruleId,
    service: input.service,
    severity: input.severity,
    title: input.title,
    message: input.message,
    event_count: input.eventCount,
    suppressed: input.suppressed,
    metadata: input.metadata ?? {},
    fired_at: new Date(),
  }));
});

describe("AlertEngine trace links", () => {
  it("links error_count alerts to the most recent error traces", async () => {
    vi.mocked(alertsDb.listEnabledRules).mockResolvedValue([
      makeRule({ id: "rule-error-count", ruleType: "error_count" }),
    ]);
    vi.mocked(alertsDb.countEventsInWindow).mockResolvedValue({
      total: 5,
      errors: 5,
    });
    vi.mocked(alertsDb.listErrorTraceIdsInWindow).mockResolvedValue([
      "t2",
      "t1",
    ]);

    await new AlertEngine().evaluate([]);

    const call = vi.mocked(alertsDb.insertAlertFired).mock.calls[0]![0];
    expect(call.metadata).toMatchObject({
      traceId: "t2",
      traceIds: ["t2", "t1"],
    });
  });

  it("links RASP alerts to every attacking trace in the window, not the first of the batch", async () => {
    vi.mocked(alertsDb.listEnabledRules).mockResolvedValue([
      makeRule({ id: "rule-rasp", ruleType: "rasp_threat_count", threshold: 5 }),
    ]);
    vi.mocked(raspDb.countRaspThreatsInWindow).mockResolvedValue(10);
    vi.mocked(raspDb.listRaspTraceIdsInWindow).mockResolvedValue([
      "r3",
      "r2",
      "r1",
    ]);

    await new AlertEngine().evaluateRasp([
      { trace_id: "batch-first" } as RaspEventRow,
    ]);

    const call = vi.mocked(alertsDb.insertAlertFired).mock.calls[0]![0];
    expect(call.metadata?.traceIds).toEqual(["r3", "r2", "r1"]);
    expect(JSON.stringify(call.metadata)).not.toContain("batch-first");
  });
});
