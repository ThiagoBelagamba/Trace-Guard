import type { AlertFired } from "@traceguard/shared";

const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

/**
 * Envia alerta acionável para webhook genérico (Slack/Discord compatible).
 */
export async function notifyWebhook(alert: AlertFired): Promise<void> {
  if (!WEBHOOK_URL) return;

  const emoji = alert.severity === "critical" ? ":rotating_light:" : ":warning:";
  const text = `${emoji} *[TraceGuard]* ${alert.severity.toUpperCase()}: ${alert.title}`;

  const body = {
    text,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*${alert.title}*`,
            alert.message,
            `Serviço: \`${alert.service}\``,
            `Regra: ${alert.ruleName}`,
            `Eventos: ${alert.eventCount}`,
            `Disparado: ${alert.firedAt}`,
          ].join("\n"),
        },
      },
    ],
  };

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Webhook HTTP ${response.status}`);
  }
}

export function isWebhookConfigured(): boolean {
  return Boolean(WEBHOOK_URL);
}
