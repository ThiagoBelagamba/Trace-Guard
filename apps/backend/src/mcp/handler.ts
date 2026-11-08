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

export async function handleMcpRequest(
  request: JsonRpcRequest,
  deps: McpDependencies
): Promise<JsonRpcResponse> {
  const id = request.id ?? null;

  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32600, message: "Invalid JSON-RPC 2.0 request" },
    };
  }

  switch (request.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
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

    case "tools/call": {
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
              content: [
                {
                  type: "text",
                  text: `Trace não encontrado: ${traceId}`,
                },
              ],
            },
          };
        }

        const buildInsight = deps.generateInsight ?? generateTraceInsight;
        const insight = await buildInsight(detail);

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({ trace: detail, insight }, null, 2),
              },
            ],
          },
        };
      }

      if (toolName === "list_security_threats") {
        const rawLimit = typeof args.limit === "number" ? args.limit : 15;
        const limit = Math.min(Math.max(Math.trunc(rawLimit), 1), 50);
        const overview = await deps.getRaspOverview(limit);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(overview, null, 2),
              },
            ],
          },
        };
      }

      if (toolName === "alert_fatigue_status") {
        const rawLimit = typeof args.limit === "number" ? args.limit : 15;
        const limit = Math.min(Math.max(Math.trunc(rawLimit), 1), 50);
        const overview = await deps.getAlertOverview(limit);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(overview, null, 2),
              },
            ],
          },
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Tool desconhecida: ${String(toolName)}`,
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
