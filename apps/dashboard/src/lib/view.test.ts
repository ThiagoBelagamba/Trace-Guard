import { describe, expect, it } from "vitest";
import { threatLabel } from "./labels";
import {
  alertSource,
  barScale,
  countByLevel,
  levelTone,
  orderLevels,
  parseHttpMessage,
  percentOf,
  threatTone,
  uptimeTone,
} from "./view";

describe("percentOf", () => {
  it("arredonda para inteiro", () => expect(percentOf(15, 18)).toBe(83));
  it("total zero vira 0", () => expect(percentOf(0, 0)).toBe(0));
});

describe("barScale", () => {
  it("dá folga de 7% sobre o maior valor", () =>
    expect(barScale([15, 3])).toBeCloseTo(16.05));
  it("vazio ou só zeros vira 0", () => {
    expect(barScale([])).toBe(0);
    expect(barScale([0, 0])).toBe(0);
  });
});

describe("parseHttpMessage", () => {
  it("extrai o método HTTP", () =>
    expect(parseHttpMessage("HTTP GET http://localhost/unreachable failed")).toEqual({
      method: "GET",
      rest: "http://localhost/unreachable failed",
    }));
  it("ignora mensagens fora do padrão", () => {
    expect(parseHttpMessage("Pedido criado")).toBeNull();
    expect(parseHttpMessage("HTTP")).toBeNull();
  });
});

describe("alertSource", () => {
  it("uptime quando há monitorId", () =>
    expect(alertSource({ monitorId: "m1", url: "x" })).toBe("uptime"));
  it("rasp quando há raspCount", () => expect(alertSource({ raspCount: 5 })).toBe("rasp"));
  it("genérico sem metadata", () => {
    expect(alertSource(undefined)).toBe("generic");
    expect(alertSource({})).toBe("generic");
  });
});

describe("orderLevels", () => {
  it("ordena os 4 níveis por gravidade", () =>
    expect(orderLevels({ info: 3, debug: 1, error: 15, warn: 2 }).map((l) => l.level)).toEqual([
      "error",
      "warn",
      "info",
      "debug",
    ]));
  it("omite níveis ausentes", () =>
    expect(orderLevels({ info: 3 })).toEqual([{ level: "info", count: 3 }]));
  it("mantém níveis desconhecidos no fim", () =>
    expect(orderLevels({ trace: 2, error: 1 }).map((l) => l.level)).toEqual(["error", "trace"]));
});

describe("tons", () => {
  it("threatTone", () => {
    expect(threatTone("sequential_scan")).toBe("threat");
    expect(threatTone("prompt_injection")).toBe("threat");
    expect(threatTone("bot_user_agent")).toBe("neutral");
  });
  it("uptimeTone", () => {
    expect(uptimeTone("up")).toBe("ok");
    expect(uptimeTone("degraded")).toBe("warn");
    expect(uptimeTone("down")).toBe("error");
    expect(uptimeTone(undefined)).toBe("neutral");
  });
  it("levelTone", () => {
    expect(levelTone("error")).toBe("error");
    expect(levelTone("debug")).toBe("neutral");
  });
});

it("countByLevel conta eventos por nível", () =>
  expect(countByLevel([{ level: "error" }, { level: "error" }, { level: "info" }])).toEqual({
    error: 2,
    info: 1,
  }));

it("threatLabel traduz e cai no próprio tipo", () => {
  expect(threatLabel("sequential_scan")).toBe("Varredura");
  expect(threatLabel("novo_tipo")).toBe("novo_tipo");
});
