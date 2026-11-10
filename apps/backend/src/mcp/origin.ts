export function isMcpOriginAllowed(
  origin: string | undefined,
  corsOrigin: string | undefined
): boolean {
  if (!origin || !corsOrigin) return true;
  return corsOrigin
    .split(",")
    .map((item) => item.trim())
    .includes(origin);
}
