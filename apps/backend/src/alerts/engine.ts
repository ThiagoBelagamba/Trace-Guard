import type { AlertFired, AlertRule, AlertSeverity } from "@traceguard/shared";
import type { TelemetryRow } from "../db/pool.js";
import type { RaspEventRow } from "../db/rasp.js";
import {
  countEventsInWindow,
  findErrorBursts,
  insertAlertFired,
  listEnabledRules,
  toAlertFired,
} from "../db/alerts.js";
import { countRaspThreatsInWindow } from "../db/rasp.js";
import { countConsecutiveDown, getMonitorById } from "../db/uptime.js";
import { cooldownRegistry } from "./cooldown.js";

const ALL_SERVICES = "all";

export class AlertEngine {
  async evaluate(_inserted: TelemetryRow[]): Promise<AlertFired[]> {
    const rules = await listEnabledRules();
    const results: AlertFired[] = [];

    for (const rule of rules) {
      if (
        rule.ruleType === "rasp_threat_count" ||
        rule.ruleType === "uptime_down"
      ) {
        continue;
      }
      const services = rule.service !== null ? [rule.service] : [ALL_SERVICES];

      for (const service of services) {
        const alert = await this.evaluateRule(rule, service);
        if (alert) results.push(alert);
      }
    }

    return results;
  }

  async evaluateRasp(inserted: RaspEventRow[]): Promise<AlertFired[]> {
    if (inserted.length === 0) return [];

    const rules = (await listEnabledRules()).filter(
      (r) => r.ruleType === "rasp_threat_count"
    );
    const results: AlertFired[] = [];

    for (const rule of rules) {
      const alert = await this.evaluateRaspRule(rule);
      if (alert) results.push(alert);
    }

    return results;
  }

  async evaluateUptime(monitorId: string): Promise<AlertFired[]> {
    const rules = (await listEnabledRules()).filter(
      (r) => r.ruleType === "uptime_down"
    );
    const results: AlertFired[] = [];

    for (const rule of rules) {
      const alert = await this.evaluateUptimeRule(rule, monitorId);
      if (alert) results.push(alert);
    }

    return results;
  }

  private async evaluateUptimeRule(
    rule: AlertRule,
    monitorId: string
  ): Promise<AlertFired | null> {
    const monitor = await getMonitorById(monitorId);
    if (!monitor) return null;

    const consecutive = await countConsecutiveDown(monitorId);
    if (consecutive < rule.threshold) return null;

    const cooldownKey = monitorId;
    const inCooldown = cooldownRegistry.isInCooldown(
      rule.id,
      cooldownKey,
      rule.cooldownMin
    );

    const title = `Uptime: ${monitor.name} indisponível`;
    const message = `${consecutive} falhas consecutivas em ${monitor.url}`;

    const row = await insertAlertFired({
      ruleId: rule.id,
      service: monitor.name,
      severity: "critical",
      title,
      message,
      eventCount: consecutive,
      suppressed: inCooldown,
      metadata: { monitorId, url: monitor.url, consecutive },
    });

    if (!inCooldown) {
      cooldownRegistry.markFired(rule.id, cooldownKey);
    }

    return toAlertFired({ ...row, rule_name: rule.name });
  }

  private async evaluateRaspRule(
    rule: AlertRule
  ): Promise<AlertFired | null> {
    const cooldownKey = rule.service ?? ALL_SERVICES;
    const inCooldown = cooldownRegistry.isInCooldown(
      rule.id,
      cooldownKey,
      rule.cooldownMin
    );

    const threatFilter =
      rule.name.toLowerCase().includes("bot") ? "bot_user_agent" : undefined;

    const count = await countRaspThreatsInWindow(
      rule.windowMin,
      rule.service,
      threatFilter
    );

    if (count < rule.threshold) return null;

    const severity: AlertSeverity =
      count >= rule.threshold * 2 ? "critical" : "warning";
    const title = threatFilter
      ? `RASP: ${count} bots detectados`
      : `RASP: ${count} ameaças na janela`;
    const message = `${count} eventos RASP nos últimos ${rule.windowMin} min (limite: ${rule.threshold})`;

    const row = await insertAlertFired({
      ruleId: rule.id,
      service: rule.service ?? ALL_SERVICES,
      severity,
      title,
      message,
      eventCount: count,
      suppressed: inCooldown,
      metadata: { threatFilter, raspCount: count },
    });

    if (!inCooldown) {
      cooldownRegistry.markFired(rule.id, cooldownKey);
    }

    return toAlertFired({ ...row, rule_name: rule.name });
  }

  private async evaluateRule(
    rule: AlertRule,
    serviceLabel: string
  ): Promise<AlertFired | null> {
    const serviceFilter = rule.service;
    const cooldownKey = rule.service ?? ALL_SERVICES;

    const inCooldown = cooldownRegistry.isInCooldown(
      rule.id,
      cooldownKey,
      rule.cooldownMin
    );

    let triggered = false;
    let eventCount = 0;
    let title = "";
    let message = "";
    let severity: AlertSeverity = "warning";
    let metadata: Record<string, unknown> = {};

    switch (rule.ruleType) {
      case "error_rate": {
        const { total, errors } = await countEventsInWindow(
          serviceFilter,
          rule.windowMin
        );
        if (total === 0) return null;
        const rate = (errors / total) * 100;
        if (rate >= rule.threshold) {
          triggered = true;
          eventCount = errors;
          severity = rate >= rule.threshold * 1.5 ? "critical" : "warning";
          title = `Taxa de erro ${rate.toFixed(1)}% (${serviceLabel})`;
          message = `${errors} erros de ${total} eventos nos últimos ${rule.windowMin} min`;
          metadata = { errorRate: rate, total, errors };
        }
        break;
      }
      case "error_count": {
        const { errors } = await countEventsInWindow(
          serviceFilter,
          rule.windowMin,
          "error"
        );
        if (errors >= rule.threshold) {
          triggered = true;
          eventCount = errors;
          severity = errors >= rule.threshold * 2 ? "critical" : "warning";
          title = `Pico de ${errors} erros (${serviceLabel})`;
          message = `${errors} eventos de erro nos últimos ${rule.windowMin} min (limite: ${rule.threshold})`;
          metadata = { errors };
        }
        break;
      }
      case "error_burst": {
        const bursts = await findErrorBursts(
          rule.windowMin,
          rule.threshold,
          serviceFilter
        );
        const burst = bursts[0];
        if (burst) {
          triggered = true;
          eventCount = burst.errorCount;
          severity = "critical";
          title = `Rajada de erros no trace ${burst.traceId.slice(0, 8)}…`;
          message = `${burst.errorCount} erros no trace ${burst.traceId} em ${rule.windowMin} min (${burst.service})`;
          metadata = {
            traceId: burst.traceId,
            errorCount: burst.errorCount,
            service: burst.service,
          };
        }
        break;
      }
      case "rasp_threat_count":
        // Avaliado via evaluateRasp() após ingest RASP
        break;
      case "uptime_down":
        // Avaliado via evaluateUptime() após probe
        break;
    }

    if (!triggered) return null;

    const suppressed = inCooldown;
    const displayService =
      rule.ruleType === "error_burst" && metadata.service
        ? String(metadata.service)
        : serviceFilter ?? ALL_SERVICES;

    const row = await insertAlertFired({
      ruleId: rule.id,
      service: displayService,
      severity,
      title,
      message,
      eventCount,
      suppressed,
      metadata: { ...metadata, ruleName: rule.name },
    });

    if (!suppressed) {
      cooldownRegistry.markFired(rule.id, cooldownKey);
    }

    return toAlertFired({ ...row, rule_name: rule.name });
  }
}

export const alertEngine = new AlertEngine();
