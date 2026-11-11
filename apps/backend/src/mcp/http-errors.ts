import type { JsonRpcResponse } from "./handler.js";

const PARSE_ERROR_CODES = new Set([
  "FST_ERR_CTP_INVALID_JSON_BODY",
  "FST_ERR_CTP_EMPTY_JSON_BODY",
]);

export function toMcpParseError(error: unknown): JsonRpcResponse | null {
  const code =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown }).code
      : undefined;
  const isParseFailure =
    error instanceof SyntaxError ||
    (typeof code === "string" && PARSE_ERROR_CODES.has(code));

  if (!isParseFailure) return null;
  return {
    jsonrpc: "2.0",
    id: null,
    error: { code: -32700, message: "Parse error" },
  };
}
