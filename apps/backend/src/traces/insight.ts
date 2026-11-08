import type { RaspEvent, TraceDetail, TraceInsight } from "@traceguard/shared";

const HEURISTIC_WEIGHTS: Record<string, { label: string; weight: number }> = {
  sequential_scan: { label: "varredura sequencial de rotas", weight: 60 },
  bot_user_agent: { label: "assinatura de User-Agent automatizado", weight: 50 },
  rate_limit: { label: "excesso de requisições por minuto", weight: 40 },
  missing_headers: { label: "ausência de cabeçalhos de navegador", weight: 20 },
};

function describeHeuristics(rasp: RaspEvent): string {
  const rawThreats = Array.isArray(rasp.metadata?.threats)
    ? rasp.metadata.threats.filter((t): t is string => typeof t === "string")
    : [rasp.threatType];
  const unique = Array.from(new Set(rawThreats));
  return unique
    .map((key) => {
      const info = HEURISTIC_WEIGHTS[key];
      return info ? `${info.label} (+${info.weight})` : key;
    })
    .join(" + ");
}

function buildPillars(detail: TraceDetail): Array<"apm" | "rasp" | "alert"> {
  const pillars: Array<"apm" | "rasp" | "alert"> = [];
  if (detail.events.length > 0) pillars.push("apm");
  if (detail.raspEvents.length > 0) pillars.push("rasp");
  if ((detail.alerts?.length ?? 0) > 0) pillars.push("alert");
  return pillars;
}

/**
 * Motor determinístico de diagnóstico forense por traceId.
 * Sintetiza a cadeia causal cruzando spans APM, eventos RASP e alertas correlacionados.
 */
export function synthesizeTraceInsight(
  detail: TraceDetail,
  now: () => string = () => new Date().toISOString()
): TraceInsight {
  const alerts = detail.alerts ?? [];
  const correlatedPillars = buildPillars(detail);
  const errorEvents = detail.events.filter((e) => e.level === "error");
  const warnEvents = detail.events.filter((e) => e.level === "warn");
  const activeAlerts = alerts.filter((a) => !a.suppressed);
  const suppressedAlerts = alerts.filter((a) => a.suppressed);

  const slowestEvent = [...detail.events].sort(
    (a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0)
  )[0];

  if (detail.raspEvents.length > 0) {
    const primaryRasp = [...detail.raspEvents].sort((a, b) => b.score - a.score)[0]!;
    const blocked = detail.raspEvents.some((e) => e.action === "blocked");
    const heuristicSummary = describeHeuristics(primaryRasp);

    const causalChain: string[] = [
      `Origem ${primaryRasp.clientIp} enviou ${primaryRasp.method} ${primaryRasp.path}${primaryRasp.userAgent ? ` (UA: ${primaryRasp.userAgent})` : ""}.`,
      `Middleware RASP em ${primaryRasp.service} somou score ${primaryRasp.score}/100: ${heuristicSummary}.`,
      blocked
        ? `Ação em runtime: requisição interceptada com HTTP 403 no span ${primaryRasp.spanId} (score ${primaryRasp.score} >= limiar 70).`
        : `Ação em runtime: requisição apenas registrada em modo monitor no span ${primaryRasp.spanId} (score ${primaryRasp.score}).`,
    ];

    if (detail.events.length > 0) {
      causalChain.push(
        `Telemetria APM correlacionada: ${detail.events.length} evento(s) no mesmo traceId (${detail.durationMs != null ? `${detail.durationMs} ms` : "span único"}).`
      );
    }
    if (alerts.length > 0) {
      causalChain.push(
        `Motor de alertas: ${activeAlerts.length} acionável(is) e ${suppressedAlerts.length} suprimido(s) por cooldown.`
      );
    }

    const recommendations: string[] = [];
    if (!blocked) {
      recommendations.push(
        "Ativar RASP_MODE=block em produção para interromper requisições com score >= 70 antes do controller."
      );
    } else {
      recommendations.push(
        `Manter bloqueio em memória/Redis ativo para o IP ${primaryRasp.clientIp} e auditar reincidência na aba Segurança.`
      );
    }
    recommendations.push(
      `Verificar se a rota ${primaryRasp.path} exige paginação autenticada ou limite específico por IP.`
    );

    return {
      traceId: detail.traceId,
      verdict: blocked ? "attack_blocked" : "attack_monitored",
      severity: blocked ? "critical" : "warning",
      headline: blocked
        ? `Tentativa de scraping bloqueada pelo RASP (${primaryRasp.method} ${primaryRasp.path} · score ${primaryRasp.score}/100)`
        : `Ameaça RASP registrada em modo monitor (${primaryRasp.method} ${primaryRasp.path} · score ${primaryRasp.score}/100)`,
      narrative: `O mesmo traceId correlacionou a inspeção RASP do IP ${primaryRasp.clientIp} (${heuristicSummary}, totalizando score ${primaryRasp.score}/100) com ${detail.events.length} evento(s) de telemetria APM${alerts.length > 0 ? ` e ${alerts.length} registro(s) de alerta` : ""}.`,
      rootCause: {
        category: "rasp",
        summary: `${heuristicSummary} a partir de ${primaryRasp.clientIp}`,
        service: primaryRasp.service,
        spanId: primaryRasp.spanId,
      },
      causalChain,
      recommendations,
      correlatedPillars,
      source: "causal-engine",
      generatedAt: now(),
    };
  }

  if (errorEvents.length > 0 || alerts.length > 0) {
    const firstError = errorEvents[0] ?? detail.events[0];
    const service = firstError?.service ?? alerts[0]?.service ?? "unknown";
    const originSpan = firstError?.spanId ?? null;
    const isCritical =
      errorEvents.length >= 2 ||
      alerts.some((a) => a.severity === "critical");

    const causalChain: string[] = [];
    if (firstError) {
      causalChain.push(
        `Span inicial ${firstError.spanId ?? "raiz"} em ${firstError.service} falhou: "${firstError.message}".`
      );
    }
    if (errorEvents.length > 1) {
      causalChain.push(
        `Propagação no trace: ${errorEvents.length} eventos de erro encadeados em ${detail.spanCount} span(s)${detail.durationMs != null ? ` ao longo de ${detail.durationMs} ms` : ""}.`
      );
    }
    if (slowestEvent?.durationMs != null) {
      causalChain.push(
        `Maior latência observada no span ${slowestEvent.spanId ?? "raiz"} (${slowestEvent.durationMs} ms).`
      );
    }
    if (alerts.length > 0) {
      causalChain.push(
        `Fadiga de alertas mitigada: ${activeAlerts.length} alerta(s) acionável(is) disparado(s) e ${suppressedAlerts.length} repetição(ões) suprimida(s) por cooldown.`
      );
    }

    const cooldownNote =
      suppressedAlerts.length > 0
        ? ` O motor de alertas disparou ${activeAlerts.length} notificação acionável e manteve ${suppressedAlerts.length} disparo(s) subsequente(s) suprimido(s) por cooldown.`
        : alerts.length > 0
          ? ` O incidente acionou ${activeAlerts.length} alerta(s) na fila operacional.`
          : "";

    return {
      traceId: detail.traceId,
      verdict: "incident",
      severity: isCritical ? "critical" : "warning",
      headline: firstError
        ? `Incidente em ${service}: ${errorEvents.length} erro(s) correlacionados no trace`
        : `Alerta operacional correlacionado em ${service}`,
      narrative: `A falha iniciou em ${service}${originSpan ? ` (span ${originSpan})` : ""} com "${firstError?.message ?? alerts[0]?.message ?? "erro de execução"}".${cooldownNote}`,
      rootCause: {
        category: "application_error",
        summary: firstError?.message ?? alerts[0]?.title ?? "Falha de aplicação",
        service,
        spanId: originSpan,
      },
      causalChain,
      recommendations: [
        `Inspecionar a dependência chamada no span ${originSpan ?? "inicial"} do serviço ${service}.`,
        "Aplicar timeout curto e circuit breaker para evitar rajadas repetidas no mesmo traceId.",
      ],
      correlatedPillars,
      source: "causal-engine",
      generatedAt: now(),
    };
  }

  if (warnEvents.length > 0 || (slowestEvent?.durationMs ?? 0) >= 500) {
    const target = slowestEvent ?? warnEvents[0]!;
    return {
      traceId: detail.traceId,
      verdict: "degraded",
      severity: "warning",
      headline: `Degradação em ${target.service} (${target.durationMs ?? 0} ms)`,
      narrative: `O trace completou sem erros fatais ou bloqueios RASP, mas apresentou aviso ou latência elevada no span ${target.spanId ?? "raiz"}: "${target.message}".`,
      rootCause: {
        category: "latency",
        summary: target.message,
        service: target.service,
        spanId: target.spanId,
      },
      causalChain: [
        `Span ${target.spanId ?? "raiz"} em ${target.service} registrou "${target.message}" (${target.durationMs ?? 0} ms).`,
      ],
      recommendations: [
        `Analisar o tempo de resposta do span ${target.spanId ?? "raiz"} em ${target.service}.`,
      ],
      correlatedPillars,
      source: "causal-engine",
      generatedAt: now(),
    };
  }

  const first = detail.events[0];
  return {
    traceId: detail.traceId,
    verdict: "normal",
    severity: "ok",
    headline: `Fluxo saudável em ${first?.service ?? "traceguard"} (${detail.spanCount} span${detail.spanCount === 1 ? "" : "s"})`,
    narrative: `Nenhuma anomalia RASP, erro de aplicação ou alerta foi disparado neste traceId${detail.durationMs != null ? ` (duração total ${detail.durationMs} ms)` : ""}.`,
    rootCause: {
      category: "healthy",
      summary: first?.message ?? "Execução dentro dos parâmetros normais",
      service: first?.service ?? "traceguard",
      spanId: first?.spanId ?? null,
    },
    causalChain: [
      `Execução concluída em ${detail.spanCount} span(s) sem violar heurísticas RASP nem regras de alerta.`,
    ],
    recommendations: [
      "Nenhuma intervenção necessária; manter monitoramento contínuo.",
    ],
    correlatedPillars,
    source: "causal-engine",
    generatedAt: now(),
  };
}

export interface GenerateInsightOptions {
  apiUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Gera diagnóstico forense determinístico e, se um endpoint compatível com OpenAI/Ollama
 * estiver configurado (`AI_API_URL`), refina a síntese mantendo fallback determinístico.
 */
export async function generateTraceInsight(
  detail: TraceDetail,
  options?: GenerateInsightOptions
): Promise<TraceInsight> {
  const base = synthesizeTraceInsight(detail);
  const apiUrl = (options?.apiUrl ?? process.env.AI_API_URL ?? "").trim().replace(/\/$/, "");
  if (!apiUrl) {
    return base;
  }

  const model = (options?.model ?? process.env.AI_MODEL ?? "gpt-4o-mini").trim();
  const apiKey = (options?.apiKey ?? process.env.AI_API_KEY ?? "").trim();
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 3_500;

  try {
    const response = await fetchImpl(`${apiUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Você é o Copiloto Forense do TraceGuard (APM + RASP + Alertas). Responda apenas JSON com as chaves headline (string), narrative (string em português técnico conciso) e recommendations (array de strings).",
          },
          {
            role: "user",
            content: JSON.stringify({
              traceId: detail.traceId,
              baseDiagnosis: base,
              events: detail.events.slice(0, 15),
              raspEvents: detail.raspEvents.slice(0, 10),
              alerts: (detail.alerts ?? []).slice(0, 10),
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) return base;

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawContent = payload.choices?.[0]?.message?.content;
    if (!rawContent) return base;

    const parsed = JSON.parse(rawContent) as {
      headline?: unknown;
      narrative?: unknown;
      recommendations?: unknown;
    };

    return {
      ...base,
      headline:
        typeof parsed.headline === "string" && parsed.headline.trim()
          ? parsed.headline.trim()
          : base.headline,
      narrative:
        typeof parsed.narrative === "string" && parsed.narrative.trim()
          ? parsed.narrative.trim()
          : base.narrative,
      recommendations:
        Array.isArray(parsed.recommendations) &&
        parsed.recommendations.every((item) => typeof item === "string") &&
        parsed.recommendations.length > 0
          ? (parsed.recommendations as string[])
          : base.recommendations,
      source: "llm",
      model,
    };
  } catch {
    return base;
  }
}
