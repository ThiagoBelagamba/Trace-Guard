function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

export function isMcpOriginAllowed(
  origin: string | undefined,
  corsOrigin: string | undefined
): boolean {
  if (!origin || !corsOrigin) return true;
  const allowed = corsOrigin.split(",").map((item) => item.trim());
  if (allowed.includes("*")) return true;
  const normalized = normalizeOrigin(origin);
  return allowed.some((item) => normalizeOrigin(item) === normalized);
}
