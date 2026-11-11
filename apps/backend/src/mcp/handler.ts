import type {
  AlertFired,
  AlertStats,
  RaspEvent,
  RaspStats,
  TraceDetail,
  TraceInsight,
} from "@traceguard/shared";
import { generateTraceInsight } from "../traces/insight.js";

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export interface McpDependencies {
  getTrace: (traceId: string) => Promise<TraceDetail | null>;
  generateInsight?: (detail: TraceDetail) => Promise<TraceInsight>;
  getRaspOverview: (limit: number) => Promise<{
    stats: RaspStats;
    events: RaspEvent[];
  }>;
  getAlertOverview: (limit: number) => Promise<{
    stats: AlertStats;
    alerts: AlertFired[];
  }>;
}

export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;

const MCP_TOOLS = [
  {
    name: "investigate_trace",
    description:
      "Correlaciona eventos APM, detecções RASP e alertas pelo mesmo traceId e retorna o diagnóstico forense causal.",
    inputSchema: {
      type: "object",
      properties: {
        traceId: {
          type: "string",
          description: "Identificador W3C Trace Context (32 caracteres hex).",
        },
      },
      required: ["traceId"],
    },
  },
  {
    name: "list_security_threats",
    description:
      "Lista detecções e bloqueios recentes do módulo RASP junto com estatísticas de ameaças nas últimas 24h.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Quantidade máxima de eventos RASP (1 a 50).",
        },
      },
    },
  },
  {
    name: "alert_fatigue_status",
    description:
      "Retorna a taxa de supressão de alertas por cooldown (fadiga mitigada) e os alertas recentes.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Quantidade máxima de alertas recentes (1 a 50).",
        },
      },
    },
  },
] as const;

function negotiateProtocolVersion(requested: unknown): string {
  if (
    typeof requested === "string" &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
  ) {
    return requested;
  }
  return SUPPORTED_PROTOCOL_VERSIONS[0];
}

function textResult(id: JsonRpcResponse["id"], value: unknown): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    },
  };
}

function clampLimit(raw: unknown): number {
  const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 15;
  return Math.min(Math.max(Math.trunc(value), 1), 50);
}

async function callTool(
  id: JsonRpcResponse["id"],
  request: JsonRpcRequest,
  deps: McpDependencies
): Promise<JsonRpcResponse> {
  const toolName = request.params?.name;
  const args =
    (request.params?.arguments as Record<string, unknown> | undefined) ?? {};

  if (toolName === "investigate_trace") {
    const traceId = typeof args.traceId === "string" ? args.traceId.trim() : "";
    if (!traceId) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "Parâmetro traceId é obrigatório" },
      };
    }

    const detail = await deps.getTrace(traceId);
    if (!detail) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: `Trace não encontrado: ${traceId}` }],
        },
      };
    }

    const buildInsight = deps.generateInsight ?? generateTraceInsight;
    const insight = await buildInsight(detail);
    return textResult(id, { trace: detail, insight });
  }

  if (toolName === "list_security_threats") {
    return textResult(id, await deps.getRaspOverview(clampLimit(args.limit)));
  }

  if (toolName === "alert_fatigue_status") {
    return textResult(id, await deps.getAlertOverview(clampLimit(args.limit)));
  }

  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32602,
      message: `Tool desconhecida: ${String(toolName)}`,
    },
  };
}

export async function handleMcpRequest(
  request: JsonRpcRequest,
  deps: McpDependencies
): Promise<JsonRpcResponse | null> {
  // Lotes JSON-RPC (array) e corpos não-objeto não são suportados.
  if (
    typeof request !== "object" ||
    request === null ||
    Array.isArray(request)
  ) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid JSON-RPC 2.0 request" },
    };
  }

  if ("id" in request) {
    const rawId: unknown = request.id;
    const validId =
      rawId === null ||
      typeof rawId === "string" ||
      (typeof rawId === "number" && Number.isFinite(rawId));
    if (!validId) {
      return {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid JSON-RPC 2.0 request" },
      };
    }
  }

  const id = request.id ?? null;

  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32600, message: "Invalid JSON-RPC 2.0 request" },
    };
  }

  // Sem a propriedade "id" é notificação (id: 0 continua sendo requisição).
  if (!("id" in request)) {
    return null;
  }

  switch (request.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: negotiateProtocolVersion(
            request.params?.protocolVersion
          ),
          capabilities: { tools: {} },
          serverInfo: {
            name: "traceguard-mcp",
            version: "0.1.0",
          },
        },
      };

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: MCP_TOOLS },
      };

    case "tools/call":
      try {
        return await callTool(id, request, deps);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const toolName = String(request.params?.name);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            content: [
              {
                type: "text",
                text: `Falha ao executar ${toolName}: ${message}`,
              },
            ],
          },
        };
      }

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Método MCP não suportado: ${request.method}`,
        },
      };
  }
}
