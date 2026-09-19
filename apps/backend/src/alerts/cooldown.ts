/**
 * Cooldown in-memory por chave ruleId:service.
 * Evita disparar o mesmo alerta repetidamente (fadiga de alertas).
 * Decisão técnica: estado em memória é suficiente para PoC single-node;
 * reinício do backend zera o cooldown (documentado no ADR 004).
 */
export class CooldownRegistry {
  private lastFired = new Map<string, number>();

  private key(ruleId: string, service: string): string {
    return `${ruleId}:${service}`;
  }

  isInCooldown(
    ruleId: string,
    service: string,
    cooldownMin: number
  ): boolean {
    const last = this.lastFired.get(this.key(ruleId, service));
    if (!last) return false;
    return Date.now() - last < cooldownMin * 60 * 1000;
  }

  markFired(ruleId: string, service: string): void {
    this.lastFired.set(this.key(ruleId, service), Date.now());
  }
}

export const cooldownRegistry = new CooldownRegistry();
