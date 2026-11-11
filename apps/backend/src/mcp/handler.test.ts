import { describe, expect, it } from "vitest";
import type { TraceDetail } from "@traceguard/shared";
import {
  handleMcpRequest,
  type JsonRpcRequest,
  type McpDependencies,
} from "./handler.js";

const mockDetail: TraceDetail = {
  traceId: "abcd1234abcd1234abcd1234abcd1234",
  spanCount: 1,
  durationMs: 3,
  events: [
    {
      id: "ev-1",
      traceId: "abcd1234abcd1234abcd1234abcd1234",
      spanId: "1111222233334444",
      service: "demo-api",
      level: "warn",
      message: "GET /api/products/1 403",
      metadata: {},
      durationMs: 3,
      createdAt: "2026-11-07T04:10:00.000Z",
    },
  ],
  raspEvents: [
    {
      traceId: "abcd1234abcd1234abcd1234abcd1234",
      spanId: "1111222233334444",
      service: "demo-api",
      threatType: "bot_user_agent",
      action: "blocked",
      clientIp: "192.0.2.99",
      userAgent: "Scrapy/2.11",
      path: "/api/products/1",
      method: "GET",
      score: 70,
      metadata: { threats: ["bot_user_agent", "missing_headers"] },
      timestamp: "2026-11-07T04:10:00.001Z",
    },
  ],
  alerts: [],
};

const deps: McpDependencies = {
  getTrace: async (traceId) =>
    traceId === mockDetail.traceId ? mockDetail : null,
  getRaspOverview: async () => ({
    stats: { byThreatType: { bot_user_agent: 4 }, blocked: 4, logged: 0 },
    events: mockDetail.raspEvents,
  }),
  getAlertOverview: async () => ({
    stats: { fired: 3, suppressed: 3, suppressionRate: 50 },
    alerts: [],
  }),
};

describe("handleMcpRequest (Model Context Protocol JSON-RPC 2.0)", () => {
  it("responds to initialize with server capabilities and metadata", async () => {
    const response = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
      },
      deps
    );

    expect(response).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: {
          name: "traceguard-mcp",
          version: "0.1.0",
        },
      },
    });
  });

  it("lists the three observability and security tools on tools/list", async () => {
    const response = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      },
      deps
    );

    const tools = (response!.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.map((t) => t.name)).toEqual([
      "investigate_trace",
      "list_security_threats",
      "alert_fatigue_status",
    ]);
  });

  it("executes investigate_trace and returns correlated trace + forensic insight", async () => {
    const response = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "investigate_trace",
          arguments: { traceId: mockDetail.traceId },
        },
      },
      deps
    );

    const result = response!.result as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text) as {
      trace: TraceDetail;
      insight: { verdict: string; correlatedPillars: string[] };
    };
    expect(parsed.trace.traceId).toBe(mockDetail.traceId);
    expect(parsed.insight.verdict).toBe("attack_blocked");
    expect(parsed.insight.correlatedPillars).toEqual(["apm", "rasp"]);
  });

  it("returns an MCP tool error when investigate_trace does not find the traceId", async () => {
    const response = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "investigate_trace",
          arguments: { traceId: "non-existent" },
        },
      },
      deps
    );

    const result = response!.result as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Trace não encontrado");
  });

  it("returns null for notifications/initialized", async () => {
    const response = await handleMcpRequest(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      deps
    );
    expect(response).toBeNull();
  });

  it("treats id 0 as a request, not a notification", async () => {
    const response = await handleMcpRequest(
      { jsonrpc: "2.0", id: 0, method: "ping" },
      deps
    );
    expect(response).toEqual({ jsonrpc: "2.0", id: 0, result: {} });
  });

  it("negotiates the protocol version requested by the client", async () => {
    const supported = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26" },
      },
      deps
    );
    expect(
      (supported!.result as { protocolVersion: string }).protocolVersion
    ).toBe("2025-03-26");

    const unsupported = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "initialize",
        params: { protocolVersion: "1999-01-01" },
      },
      deps
    );
    expect(
      (unsupported!.result as { protocolVersion: string }).protocolVersion
    ).toBe("2025-06-18");
  });

  it("rejects unknown tools with -32602", async () => {
    const response = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "does_not_exist" },
      },
      deps
    );
    expect(response!.error?.code).toBe(-32602);
  });

  it("reports tool execution failures as isError results", async () => {
    const response = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "investigate_trace",
          arguments: { traceId: mockDetail.traceId },
        },
      },
      {
        ...deps,
        getTrace: async () => {
          throw new Error("db down");
        },
      }
    );
    const result = response!.result as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("db down");
  });

  it("rejects JSON-RPC batches", async () => {
    const response = await handleMcpRequest(
      [] as unknown as JsonRpcRequest,
      deps
    );
    expect(response!.error?.code).toBe(-32600);
  });

  it("answers an invalid message without id with -32600 instead of treating it as a notification", async () => {
    const response = await handleMcpRequest({} as JsonRpcRequest, deps);
    expect(response?.error?.code).toBe(-32600);
  });

  it.each([{}, [], true, 1.5e400])(
    "rejects an id of invalid type with -32600 and id null: %j",
    async (badId) => {
      const response = await handleMcpRequest(
        { jsonrpc: "2.0", id: badId as never, method: "ping" },
        deps
      );
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid JSON-RPC 2.0 request" },
      });
    }
  );
});
