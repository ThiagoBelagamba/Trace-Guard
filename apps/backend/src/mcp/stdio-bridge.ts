export type McpPost = (
  body: string
) => Promise<{ status: number; text: string }>;

type JsonRpcId = string | number | null;

function errorLine(id: JsonRpcId, code: number, message: string): string {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function forwardMessage(
  line: string,
  post: McpPost
): Promise<string | null> {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return errorLine(null, -32700, "Parse error");
  }

  // Só mensagens com "id" esperam resposta de erro.
  let id: JsonRpcId = null;
  let hasId = false;
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    const candidate = parsed as { id?: unknown };
    if ("id" in candidate) {
      hasId = true;
      if (
        typeof candidate.id === "string" ||
        typeof candidate.id === "number"
      ) {
        id = candidate.id;
      }
    }
  }

  let result: { status: number; text: string };
  try {
    result = await post(trimmed);
  } catch (err) {
    if (!hasId) return null;
    const message = err instanceof Error ? err.message : String(err);
    return errorLine(id, -32603, `Backend indisponível: ${message}`);
  }

  if (result.status === 202) return null;

  if (result.status < 200 || result.status >= 300) {
    if (!hasId) return null;
    return errorLine(id, -32603, `Backend respondeu HTTP ${result.status}`);
  }

  if (!result.text.trim()) return null;
  return result.text;
}
