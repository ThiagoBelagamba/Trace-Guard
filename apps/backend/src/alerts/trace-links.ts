export const MAX_LINKED_TRACES = 50;

const UNKNOWN_TRACE_ID = "unknown";

export function buildTraceLinks(
  traceIds: readonly string[],
  max = MAX_LINKED_TRACES
): { traceId?: string; traceIds?: string[] } {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const id of traceIds) {
    if (!id || id === UNKNOWN_TRACE_ID || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
    if (unique.length >= max) break;
  }

  if (unique.length === 0) return {};
  return { traceId: unique[0], traceIds: unique };
}
