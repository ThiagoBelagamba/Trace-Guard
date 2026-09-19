export type AuthDecision = "ok" | "unauthorized";

export interface AuthorizeInput {
  path: string;
  apiKey?: string;
  providedKey?: string;
  wsToken?: string;
}

function normalizeKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim();
  }
  return trimmed;
}

export function authorizeApiRequest(input: AuthorizeInput): AuthDecision {
  const path = input.path.split("?")[0] ?? input.path;
  if (path === "/health" || path.startsWith("/health")) {
    return "ok";
  }

  if (!input.apiKey) {
    return "ok";
  }

  const provided = normalizeKey(input.providedKey) ?? normalizeKey(input.wsToken);
  return provided === input.apiKey ? "ok" : "unauthorized";
}

export function extractProvidedKey(
  headers: Record<string, string | string[] | undefined>
): string | undefined {
  const raw =
    headers["x-api-key"] ??
    headers["X-API-Key"] ??
    headers.authorization ??
    headers.Authorization;
  if (Array.isArray(raw)) return raw[0];
  return raw;
}
