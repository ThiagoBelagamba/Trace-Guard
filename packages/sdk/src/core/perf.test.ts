import { afterEach, describe, expect, it } from "vitest";
import {
  getLastEventLoopDelayMs,
  startEventLoopMonitoring,
  stopEventLoopMonitoring,
} from "./perf.js";

describe("event loop monitoring", () => {
  afterEach(() => {
    stopEventLoopMonitoring();
  });

  it("records delay after the event loop is blocked", async () => {
    startEventLoopMonitoring();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const busyUntil = Date.now() + 100;
    while (Date.now() < busyUntil) {
      // bloqueio síncrono proposital para saturar o event loop
    }

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(getLastEventLoopDelayMs()).toBeGreaterThan(40);
  });
});
