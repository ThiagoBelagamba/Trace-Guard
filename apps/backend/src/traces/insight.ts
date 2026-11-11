import {
  DEFAULT_RASP_BLOCK_THRESHOLD,
  RASP_THREAT_WEIGHTS,
  type LlmFallbackReason,
  type RaspEvent,
  type RaspThreatType,
  type TraceDetail,
  type TraceInsight,
} from "@traceguard/shared";
import {
  LLM_SYSTEM_PROMPT,
  buildLlmUserPayload,
  parseLlmRefinement,
} from "./llm-guard.js";

/** Rótulos das heurísticas; o peso vem de `RASP_THREAT_WEIGHTS` (fonte única). */
const HEURISTIC_WEIGHTS: Record<RaspThreatType, { label: string }> = {
  sequential_scan: { label: "varredura sequencial de rotas" },
  bot_user_agent: { label: "assinatura de User-Agent automatizado" },
  rate_limit: { label: "excesso de requisições por minuto" },
  missing_headers: { label: "ausência de cabeçalhos de navegador" },
};

function isKnownThreat(key: string): key is RaspThreatType {
  return Object.prototype.hasOwnProperty.call(RASP_THREAT_WEIGHTS, key);
}

function threatKeys(rasp: RaspEvent): string[] {
  const listedThreats = Array.isArray(rasp.metadata?.threats)
    ? rasp.metadata.threats.filter((t): t is string => typeof t === "string")
    : [];
  // Lista ausente, vazia ou sem strings: o tipo do evento é a única heurística conhecida.
  const rawThreats = listedThreats.length > 0 ? listedThreats : [rasp.threatType];
  return Array.from(new Set(rawThreats));
}

function describeHeuristics(rasp: RaspEvent): string {
  return threatKeys(rasp)
    .map((key) =>
      isKnownThreat(key)
        ? `${HEURISTIC_WEIGHTS[key].label} (+${RASP_THREAT_WEIGHTS[key]})`
        : key
    )
    .join(" + ");
}

function describeAttackKind(rasp: RaspEvent): string {
  const keys = threatKeys(rasp);
  if (keys.includes("sequential_scan")) return "tentativa de scraping";
  if (keys.includes("bot_user_agent")) return "acesso automatizado (bot)";
  if (keys.includes("rate_limit")) return "excesso de requisições";
  return "requisição suspeita";
}

/**
 * Política efetiva do RASP no momento do evento. Eventos antigos não trazem
 * `blockThreshold`/`mode`: usa-se o limiar padrão e o modo fica `unknown`,
 * salvo quando um evento apenas registrado acima do limiar só se explica por modo monitor.
 */
export function resolveRaspPolicy(rasp: RaspEvent): {
  blockThreshold: number;
  mode: "monitor" | "block" | "unknown";
} {
  const recordedThreshold = rasp.metadata?.blockThreshold;
  const blockThreshold =
    typeof recordedThreshold === "number" &&
    Number.isFinite(recordedThreshold) &&
    recordedThreshold >= 1 &&
    recordedThreshold <= 100
      ? recordedThreshold
      : DEFAULT_RASP_BLOCK_THRESHOLD;

  const recordedMode = rasp.metadata?.mode;
  let mode: "monitor" | "block" | "unknown" =
    recordedMode === "monitor" || recordedMode === "block" ? recordedMode : "unknown";
  if (mode === "unknown" && rasp.action === "logged" && rasp.score >= blockThreshold) {
    mode = "monitor";
  }

  return { blockThreshold, mode };
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
    const attackKind = describeAttackKind(primaryRasp);
    const { blockThreshold, mode } = resolveRaspPolicy(primaryRasp);
    const { score, method, path, spanId } = primaryRasp;

    const actionLine = blocked
      ? `Ação em runtime: requisição interceptada com HTTP 403 no span ${spanId} (score ${score} >= limiar ${blockThreshold}).`
      : mode === "monitor"
        ? `Ação em runtime: requisição registrada em modo monitor, sem bloqueio, no span ${spanId} (score ${score}, limiar ${blockThreshold}).`
        : score >= blockThreshold
          ? `Ação em runtime: requisição registrada sem bloqueio no span ${spanId} (score ${score} >= limiar ${blockThreshold}, mas o SDK não bloqueou).`
          : `Ação em runtime: requisição registrada sem bloqueio no span ${spanId} (score ${score} abaixo do limiar ${blockThreshold}).`;

    const causalChain: string[] = [
      `Origem ${primaryRasp.clientIp} enviou ${method} ${path}${primaryRasp.userAgent ? ` (UA: ${primaryRasp.userAgent})` : ""}.`,
      `Middleware RASP em ${primaryRasp.service} somou score ${score}/100: ${heuristicSummary}.`,
      actionLine,
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
    if (blocked) {
      recommendations.push(
        `Manter bloqueio em memória/Redis ativo para o IP ${primaryRasp.clientIp} e auditar reincidência na aba Segurança.`
      );
    } else if (mode === "monitor") {
      recommendations.push(
        `Ativar RASP_MODE=block em produção para interromper requisições com score >= ${blockThreshold} antes do controller.`
      );
    } else if (score >= blockThreshold) {
      recommendations.push(
        `Score ${score} atingiu o limiar ${blockThreshold} sem bloqueio; conferir RASP_MODE e a versão do SDK em ${primaryRasp.service}.`
      );
    } else if (score < blockThreshold) {
      recommendations.push(
        `Score ${score} ficou abaixo do limiar ${blockThreshold}; avaliar se o limiar está adequado para a rota ${path}.`
      );
    }
    recommendations.push(
      `Verificar se a rota ${path} exige paginação autenticada ou limite específico por IP.`
    );

    const apmPart =
      detail.events.length > 0
        ? `com ${detail.events.length} evento(s) de telemetria APM`
        : blocked
          ? "sem telemetria APM (a requisição foi interrompida antes de chegar ao handler)"
          : "sem telemetria APM correlacionada";
    const alertsPart =
      alerts.length > 0
        ? detail.events.length > 0
          ? ` e ${alerts.length} registro(s) de alerta`
          : `, além de ${alerts.length} registro(s) de alerta`
        : "";

    return {
      traceId: detail.traceId,
      verdict: blocked ? "attack_blocked" : "attack_monitored",
      severity: blocked ? "critical" : "warning",
      headline: blocked
        ? `RASP bloqueou ${attackKind} (${method} ${path} · score ${score}/100)`
        : `RASP registrou ${attackKind} sem bloqueio (${method} ${path} · score ${score}/100)`,
      narrative: `O mesmo traceId correlacionou a inspeção RASP do IP ${primaryRasp.clientIp} (${heuristicSummary}, totalizando score ${score}/100) ${apmPart}${alertsPart}.`,
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
  /** Destino do log de fallback do LLM (padrão: `console.warn`). */
  logger?: (message: string) => void;
}

const DEFAULT_AI_TIMEOUT_MS = 10_000;

function isTimeoutError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "TimeoutError"
  );
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
  const timeoutMs =
    options?.timeoutMs ?? (Number(process.env.AI_TIMEOUT_MS) || DEFAULT_AI_TIMEOUT_MS);
  const logger = options?.logger ?? ((message: string) => console.warn(message));

  const fallback = (reason: LlmFallbackReason): TraceInsight => {
    logger(`[insight] LLM fallback (${reason}) trace=${detail.traceId}`);
    return { ...base, llmFallback: reason };
  };

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
          { role: "system", content: LLM_SYSTEM_PROMPT },
          { role: "user", content: buildLlmUserPayload(detail, base) },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) return fallback("http_error");

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    } | null;
    const rawContent = payload?.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string" || !rawContent.trim()) {
      return fallback("invalid_response");
    }

    const refinement = parseLlmRefinement(rawContent, base);
    if (!refinement.ok) return fallback(refinement.reason);

    return {
      ...base,
      headline: refinement.headline,
      narrative: refinement.narrative,
      recommendations: refinement.recommendations,
      source: "llm",
      model,
    };
  } catch (error) {
    if (isTimeoutError(error)) return fallback("timeout");
    // Corpo da resposta HTTP que não é JSON válido.
    if (error instanceof SyntaxError) return fallback("invalid_response");
    return fallback("network_error");
  }
}
