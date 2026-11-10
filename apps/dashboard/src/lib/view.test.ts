import { describe, expect, it } from "vitest";
import type { TraceInsight } from "@traceguard/shared";
import { threatLabel } from "./labels";
import {
  alertSource,
  alertTraceId,
  barScale,
  barValueFontSize,
  buildMcpInvestigateSnippet,
  chartYMax,
  activeMonitorsLabel,
  countByLevel,
  insightSourceLabel,
  insightTone,
  levelTone,
  orderLevels,
  parseHttpMessage,
  percentOf,
  pillarLabel,
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

describe("barValueFontSize", () => {
  it("usa o tamanho cheio com poucas barras e números curtos", () =>
    expect(barValueFontSize(2, 30)).toBe(24));
  it("reduz com 3 dígitos em 6 barras para caber em ~47px", () =>
    expect(barValueFontSize(6, 128)).toBeLessThanOrEqual(15));
  it("reduz com 4 dígitos em 4 barras", () =>
    expect(barValueFontSize(4, 1234)).toBeLessThanOrEqual(16));
  it("reduz com 3 dígitos em 4 barras", () =>
    expect(barValueFontSize(4, 128)).toBeLessThanOrEqual(20));
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

describe("chartYMax", () => {
  // O topo é 4 × um passo "redondo" (1, 2, 2,5, 5 ou 10 × 10^n): 5 marcas fáceis de ler.
  it("15 eventos → 0/5/10/15/20", () => expect(chartYMax(15)).toBe(20));
  it("valor exato no topo ganha folga", () => expect(chartYMax(20)).toBe(40));
  it("37ms → 0/20/40/60/80", () => expect(chartYMax(37)).toBe(80));
  it("72ms → 0/25/50/75/100", () => expect(chartYMax(72)).toBe(100));
  it("1234ms → passos de 500", () => expect(chartYMax(1234)).toBe(2000));
  it("valores pequenos mantêm marcas inteiras", () => expect(chartYMax(2)).toBe(4));
  it("sem dados vira 4", () => {
    expect(chartYMax(0)).toBe(4);
    expect(chartYMax(-3)).toBe(4);
  });
});

describe("activeMonitorsLabel", () => {
  it("conta ativos sobre o total", () =>
    expect(
      activeMonitorsLabel([{ enabled: true }, { enabled: false }, { enabled: true }])
    ).toBe("2 de 3 ativos"));
  it("todos pausados", () => expect(activeMonitorsLabel([{ enabled: false }])).toBe("0 de 1 ativos"));
  it("lista vazia", () => expect(activeMonitorsLabel([])).toBe("0 de 0 ativos"));
});

describe("forensic insight & MCP helpers", () => {
  it("alertTraceId extrai o traceId quando presente em metadata", () => {
    expect(alertTraceId({ traceId: "abcd1234" })).toBe("abcd1234");
    expect(alertTraceId({ traceId: "   " })).toBeNull();
    expect(alertTraceId({})).toBeNull();
    expect(alertTraceId(undefined)).toBeNull();
  });

  it("insightTone mapeia severidade para o tom visual do dashboard", () => {
    expect(insightTone("critical")).toBe("error");
    expect(insightTone("warning")).toBe("warn");
    expect(insightTone("info")).toBe("info");
    expect(insightTone("ok")).toBe("ok");
  });

  describe("insightSourceLabel", () => {
    const insight: TraceInsight = {
      traceId: "t1",
      verdict: "normal",
      severity: "ok",
      headline: "h",
      narrative: "n",
      rootCause: { category: "healthy", summary: "s", service: "svc", spanId: null },
      causalChain: [],
      recommendations: [],
      correlatedPillars: [],
      source: "causal-engine",
      generatedAt: "2026-11-09T10:00:00.000Z",
    };

    it("mostra o modelo quando o LLM respondeu", () => {
      expect(insightSourceLabel({ ...insight, source: "llm", model: "qwen2.5" })).toBe(
        "LLM (qwen2.5)"
      );
      expect(insightSourceLabel({ ...insight, source: "llm" })).toBe("LLM (IA)");
    });

    it("mostra só Motor Causal quando não havia LLM configurado", () => {
      expect(insightSourceLabel(insight)).toBe("Motor Causal");
    });

    it("explica o fallback quando o LLM falhou", () => {
      expect(insightSourceLabel({ ...insight, llmFallback: "timeout" })).toBe(
        "Motor Causal · LLM indisponível (timeout)"
      );
      expect(insightSourceLabel({ ...insight, llmFallback: "http_error" })).toBe(
        "Motor Causal · LLM indisponível (erro HTTP)"
      );
      expect(insightSourceLabel({ ...insight, llmFallback: "network_error" })).toBe(
        "Motor Causal · LLM indisponível (falha de rede)"
      );
      expect(insightSourceLabel({ ...insight, llmFallback: "invalid_response" })).toBe(
        "Motor Causal · LLM indisponível (resposta inválida)"
      );
      expect(insightSourceLabel({ ...insight, llmFallback: "rejected_output" })).toBe(
        "Motor Causal · LLM indisponível (resposta rejeitada)"
      );
    });
  });

  it("pillarLabel formata os pilares correlacionados", () => {
    expect(pillarLabel("apm")).toBe("APM");
    expect(pillarLabel("rasp")).toBe("RASP");
    expect(pillarLabel("alert")).toBe("Alerta");
  });

  it("buildMcpInvestigateSnippet monta a chamada JSON-RPC 2.0 para investigate_trace", () => {
    const snippet = JSON.parse(buildMcpInvestigateSnippet("trace-xyz"));
    expect(snippet).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "investigate_trace",
        arguments: { traceId: "trace-xyz" },
      },
    });
  });
});
