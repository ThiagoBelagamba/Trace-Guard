import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CooldownRegistry } from "./cooldown.js";

describe("CooldownRegistry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not suppress the first fire for a rule and service", () => {
    const cooldown = new CooldownRegistry();
    expect(cooldown.isInCooldown("rule-1", "api", 15)).toBe(false);
  });

  it("suppresses repeats inside the cooldown window", () => {
    const cooldown = new CooldownRegistry();
    cooldown.markFired("rule-1", "api");
    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(cooldown.isInCooldown("rule-1", "api", 15)).toBe(true);
  });

  it("allows a new fire after the cooldown window elapses", () => {
    const cooldown = new CooldownRegistry();
    cooldown.markFired("rule-1", "api");
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(cooldown.isInCooldown("rule-1", "api", 15)).toBe(false);
  });

  it("keeps cooldown isolated per rule and service", () => {
    const cooldown = new CooldownRegistry();
    cooldown.markFired("rule-1", "api");
    expect(cooldown.isInCooldown("rule-2", "api", 15)).toBe(false);
    expect(cooldown.isInCooldown("rule-1", "billing", 15)).toBe(false);
  });
});
