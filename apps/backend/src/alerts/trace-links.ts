export const MAX_LINKED_TRACES = 50;

const UNKNOWN_TRACE_ID = "unknown";
const ALL_ZERO_TRACE_ID = /^0+$/;

export function buildTraceLinks(
  traceIds: readonly string[],
  max = MAX_LINKED_TRACES
): { traceId?: string; traceIds?: string[] } {
  if (max < 1) return {};

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const raw of traceIds) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (
      !id ||
      id.toLowerCase() === UNKNOWN_TRACE_ID ||
      ALL_ZERO_TRACE_ID.test(id) ||
      seen.has(id)
    ) {
      continue;
    }
    seen.add(id);
    unique.push(id);
    if (unique.length >= max) break;
  }

  if (unique.length === 0) return {};
  return { traceId: unique[0], traceIds: unique };
}
