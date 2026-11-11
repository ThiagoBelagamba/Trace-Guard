# ADR 009 — Copiloto Forense de Trace e Servidor Model Context Protocol (MCP)

## Status

Aceito

## Contexto

Colocar um classificador probabilístico de linguagem no caminho de detecção RASP introduz falsos positivos e falsos negativos na decisão de bloqueio, além de depender de checkpoints pesados. Por outro lado, operadores de PMEs e agentes de IA em IDEs modernas (via Model Context Protocol — MCP) precisam investigar rapidamente **por que** um `traceId` sofreu bloqueio RASP, gerou erro em cascata ou acionou/suprimiu alertas.

A tese central do TraceGuard é que o mesmo `traceId` W3C liga APM, RASP e alertas. Uma camada de IA/diagnóstico posicionada na **investigação do `traceId`** aproveita essa correlação sem comprometer o determinismo nem o orçamento de `< 2 ms` do middleware RASP.

## Decisão

1. **Tri-correlação no `TraceDetail`:** `GET /api/v1/traces/:traceId` reúne cronologicamente `events` (APM), `raspEvents` (segurança em runtime) e `alerts` (notificações acionáveis e suprimidas por cooldown que referenciam o `traceId`).
2. **Motor de Diagnóstico Forense Híbrido (`GET /api/v1/traces/:traceId/insight`):**
   - `synthesizeTraceInsight` constrói de forma determinística (`< 1 ms`, sem dependência externa) o veredito, os pilares correlacionados (`apm`, `rasp`, `alert`), a decomposição dos pesos heurísticos do RASP (`50 + 20 = 70 >= 70`), a cadeia causal e as recomendações de mitigação.
   - Quando `AI_API_URL` está configurado (compatível com OpenAI `/v1/chat/completions` ou Ollama local), `generateTraceInsight` refina o texto executivo sobre o grafo causal já validado, com fallback automático para o motor determinístico em caso de falha ou timeout (padrão 10 s, configurável por `AI_TIMEOUT_MS`).
3. **Servidor MCP nativo (`POST /api/v1/mcp`):** expõe o protocolo JSON-RPC 2.0 do Model Context Protocol com as ferramentas `investigate_trace`, `list_security_threats` e `alert_fatigue_status`, permitindo que agentes de IA consultem incidentes reais diretamente pelo `traceId`.

## Consequências

- **Positivas:** zero latência adicionada no caminho quente das aplicações monitoradas; zero risco de falha em demonstração offline; demonstra diretamente o valor científico da correlação por `traceId` e integra o padrão emergente MCP.
- **Negativas:** a análise atua no pós-evento (investigação e resposta a incidentes), mantendo o bloqueio preventivo sob responsabilidade exclusiva das heurísticas determinísticas do RASP.
