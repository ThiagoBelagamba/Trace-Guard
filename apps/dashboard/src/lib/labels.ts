export const THREAT_LABELS: Record<string, string> = {
  rate_limit: "Rate limit",
  bot_user_agent: "Bot UA",
  sequential_scan: "Varredura",
  missing_headers: "Headers ausentes",
  prompt_injection: "Injeção de prompt",
  secret_leak: "Segredo no payload",
};

export function threatLabel(type: string): string {
  return THREAT_LABELS[type] ?? type;
}
