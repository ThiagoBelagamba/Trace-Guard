# ADR 008 — Notificações via Webhook

## Status

Aceito — Fase 5

## Contexto

Alertas acionáveis (não suprimidos por cooldown) precisam chegar a operadores fora do dashboard.

## Decisão

Implementar `notifyWebhook()` com `ALERT_WEBHOOK_URL` opcional.

Payload **Slack-compatible** (`text` + `blocks` mrkdwn) — compatível com Discord webhooks com adaptação mínima.

Integração fire-and-forget após:
- Consumer de telemetria
- Ingest RASP
- Probe de uptime

Falha de webhook não bloqueia pipeline (log de erro apenas).

## Alternativas rejeitadas

- SMTP/e-mail — requer configuração extra na PoC
- PagerDuty — fora do escopo acadêmico
