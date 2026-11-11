# Relatório de correções do Copiloto Forense

**Branch:** `fix/forensic-copilot-review`, a partir de `main` (commit de origem `05dd970`, que trocou o modelo Laya pelo Copiloto Forense e pelo servidor MCP).
**Período:** 09/11/2026 a 11/11/2026.
**Planos:** [`plans/2026-11-09-forensic-copilot-fixes.md`](../plans/2026-11-09-forensic-copilot-fixes.md) (leva 1) e [`plans/2026-11-11-forensic-copilot-hardening.md`](../plans/2026-11-11-forensic-copilot-hardening.md) (leva 2).

## Resumo

| Leva | Origem dos problemas | Pontos | Commits |
|---|---|---|---|
| 1 | Revisão do código do Copiloto | 8 | `812ce06` alertas, `0569c07` MCP, `bd949da` diagnóstico/LLM |
| 2 | Rajada de testes sobre a leva 1 (suíte embaralhada, fuzz, sondas HTTP/MCP, LLM falso, carga no banco) | 10 | `59e6f57` endurecimento |

Resultado final: 189 testes passando (eram 133 depois da leva 1), build de todos os pacotes, fuzz com 72 verificações e 0 achados (eram 24) e testes ponta a ponta com backend real e LLM falso.

---

## Leva 1: revisão do Copiloto

### 1. Alertas de erro não apareciam no trace
- **Problema:** alertas `error_rate` e `error_count` eram gravados sem `traceId`, então o drawer do trace e o diagnóstico nunca os mostravam.
- **Por quê:** o motor de alertas só contava eventos na janela e não guardava quais traces causaram o disparo.
- **Solução:** o motor busca os traces com erro na janela (`listErrorTraceIdsInWindow`) e grava `metadata.traceId` e `metadata.traceIds` (até 50) via `buildTraceLinks`.

### 2. Alerta RASP ligado ao trace errado
- **Problema:** o alerta RASP apontava para o primeiro evento do lote recebido, um trace qualquer.
- **Por quê:** usava `inserted[0].trace_id` em vez dos ataques que de fato somaram para o limite.
- **Solução:** `listRaspTraceIdsInWindow` lista os traces atacantes da janela, filtrados por serviço e tipo de ameaça, e todos são vinculados ao alerta.

### 3. Limiar "70" fixo no texto
- **Problema:** o diagnóstico sempre citava o limiar 70, mesmo com `blockThreshold` configurado com outro valor no SDK.
- **Por quê:** o valor estava escrito no backend e o SDK não registrava a política usada na decisão.
- **Solução:** pesos e limiar padrão passaram a ter uma fonte única (`RASP_THREAT_WEIGHTS` e `DEFAULT_RASP_BLOCK_THRESHOLD` em `@traceguard/shared`). O SDK grava `blockThreshold` e `mode` no `metadata` de cada evento e o diagnóstico usa esses valores (`resolveRaspPolicy`), com 70 como fallback para eventos antigos.

### 4. Textos imprecisos no diagnóstico
- **Problema:** todo bloqueio virava "scraping", e o texto chegava a dizer "com 0 evento(s) de telemetria APM".
- **Por quê:** o texto era fixo e não olhava a heurística dominante nem a ausência de telemetria.
- **Solução:** o tipo de ataque vem da heurística dominante (scraping, bot, excesso de requisições). A ausência de APM em requisição bloqueada passou a ser explicada ("interrompida antes de chegar ao handler").

### 5. Prompt injection no LLM
- **Problema:** User-Agent e path, controlados pelo atacante, iam crus para o LLM, e a resposta era aceita sem validação.
- **Por quê:** o prompt misturava dados externos com instruções e não havia checagem da saída.
- **Solução:** novo módulo `llm-guard.ts`:
  - os dados externos são sanitizados e isolados em `untrustedData`;
  - o system prompt manda tratá-los como dado;
  - `parseLlmRefinement` valida o formato e o tamanho da resposta e rejeita saídas que contradizem um ataque ou incidente.
  - O LLM só pode alterar headline, narrative e recommendations.

### 6. Timeout curto e fallback silencioso
- **Problema:** o timeout de 3,5 s derrubava LLMs locais, e a queda para o motor determinístico não deixava rastro.
- **Por quê:** o timeout era fixo e não havia log nem campo indicando a falha.
- **Solução:**
  - O timeout passou para 10 s, configurável por `AI_TIMEOUT_MS`.
  - O motivo da queda vai em `TraceInsight.llmFallback` (`timeout`, `http_error`, `network_error`, `invalid_response`, `rejected_output`) e em uma linha de log.
  - O dashboard mostra "Motor Causal · LLM indisponível (motivo)".

### 7. MCP fora da especificação
- **Problema:** `notifications/initialized` recebia erro em vez de 202, não havia negociação de versão e clientes de desktop (stdio) não conseguiam conectar.
- **Por quê:** o handler tratava toda mensagem como requisição e só existia o transporte HTTP.
- **Solução:**
  - Notificações recebem HTTP 202 e há negociação de versão (`2025-06-18`, `2025-03-26`, `2024-11-05`).
  - Ferramenta desconhecida → `-32602`; falha de ferramenta → `isError`; lote → `-32600`.
  - Checagem de `Origin` e `GET` → 405.
  - Nova ponte stdio (`pnpm --filter @traceguard/backend mcp:stdio`).

### 8. Busca de alertas por trace sem índice
- **Problema:** buscar alertas pelo `traceId` dentro do `metadata` fazia varredura completa da tabela.
- **Por quê:** não havia índice sobre os campos JSON.
- **Solução:** migração `005_alert_trace_index.sql` com índice btree em `metadata->>'traceId'` e GIN em `metadata->'traceIds'`. O plano de execução passou de Seq Scan para BitmapOr. Ela foi incluída em `pnpm db:migrate` e também roda sozinha com `pnpm db:migrate:alert-index`.

---

## Leva 2: endurecimento após a rajada de testes

### 1. Texto do atacante na parte "confiável" do prompt
- **Problema:** o diagnóstico base, apresentado ao LLM como validado e incontestável, continha UA, path, IP e mensagens vindas da requisição.
- **Por quê:** os textos do motor causal interpolam esses dados, e o diagnóstico base ia inteiro fora de `untrustedData`.
- **Solução:** `baseDiagnosis` leva só campos estruturados (veredito, severidade, categoria da causa raiz e pilares). O rascunho em texto foi para `untrustedData.draft`, e o system prompt foi ajustado.

### 2. LLM absolvendo ataque com sinônimos e devolvendo links
- **Problema:** "tráfego legítimo", "não é um ataque" e variações sem acento passavam pela validação, e recomendações podiam trazer URL ou HTML.
- **Por quê:** a lista de expressões tinha 5 termos com acento exato, e não havia checagem de links.
- **Solução:** a comparação é feita sobre o texto sem acentos, com uma lista ampliada de absolvições (inclui negações). Respostas com URL, link markdown ou HTML são rejeitadas e caem no texto determinístico.

### 3. Lacunas na sanitização
- **Problema:** caracteres bidi, zero-width e de controle C1 passavam. Um valor não-texto no metadata lançava erro, que aparecia como `network_error`.
- **Por quê:** a regex cobria só controles ASCII, e a função assumia `string`.
- **Solução:**
  - `sanitizeForPrompt` aceita qualquer tipo: número e booleano viram texto, o resto vira vazio.
  - Remove os caracteres invisíveis.
  - Também sanitiza `level`, `threatType`, `action` e `severity`.
  - As classes de caracteres são montadas por code point, para não gravar caracteres invisíveis no código-fonte.

### 4. `/insight` sem cache nem limite de custo
- **Problema:** 20 aberturas do mesmo trace geravam 20 chamadas pagas ao LLM, e sem `API_KEY` a rota ficava aberta.
- **Por quê:** cada requisição chamava o LLM diretamente.
- **Solução:** novo `insight-service.ts`, usado pela rota e pelo MCP:
  - cache por versão do trace (60 s), com chamadas simultâneas compartilhando uma única resposta;
  - limite de chamadas por minuto (30); acima dele responde o motor determinístico com `llmFallback: "rate_limited"`;
  - aviso ao iniciar quando `AI_API_URL` está ativo sem `API_KEY`.

  No teste ponta a ponta, 11 aberturas resultaram em 1 chamada ao LLM.

### 5. MCP com respostas fora do JSON-RPC
- **Problema:** `id` de tipo inválido (objeto) recebia sucesso, e JSON quebrado devolvia o erro HTML/JSON padrão do Fastify.
- **Por quê:** o tipo do `id` não era validado, e a falha de parse acontecia antes do handler.
- **Solução:** `id` inválido recebe `-32600`. Um `errorHandler` na rota converte erro de parse em HTTP 400 com `-32700` (`toMcpParseError`); os demais erros, como 413, seguem iguais.

### 6. Ponte stdio repassando respostas cruas
- **Problema:** HTML de proxy ou JSON com quebras de linha iam direto para o stdout e quebravam o protocolo, e o 401 não explicava a causa.
- **Por quê:** a ponte repassava o corpo sem validar.
- **Solução:** toda resposta é revalidada e reescrita em uma linha; corpo que não é JSON vira erro JSON-RPC. O 401 orienta a definir `TRACEGUARD_API_KEY`.

### 7. Checagem de Origin incoerente com o CORS
- **Problema:** `CORS_ORIGIN='*'` liberava o dashboard, mas bloqueava todas as origens no MCP. Barra final e maiúsculas também causavam bloqueio indevido.
- **Por quê:** a comparação era por igualdade exata.
- **Solução:** `*` libera qualquer origem, e origem e lista são normalizadas (sem barra final, em minúsculas).

### 8. Bordas do diagnóstico RASP
- **Problema:**
  - lista de ameaças vazia gerava "(, totalizando…)" e uma causa raiz vazia;
  - limiar 0 ou negativo era aceito;
  - modo `block` com score acima do limiar e sem bloqueio dizia "abaixo do limiar".
- **Por quê:** faltavam fallback e validação nesses casos.
- **Solução:**
  - lista vazia usa o `threatType` do evento;
  - o limiar só vale entre 1 e 100;
  - o caso inconsistente ganhou texto próprio ("score X >= limiar Y, mas o SDK não bloqueou") e uma recomendação de conferir `RASP_MODE` e a versão do SDK.

### 9. Documentação desatualizada
- **Problema:** o ADR 009 citava timeout de 3,5 s, e `llmFallback` e as variáveis novas não estavam documentados.
- **Por quê:** os docs não acompanharam a leva 1.
- **Solução:** ADR 009, `docs/api-v1.md`, `README.md`, `packages/sdk/README.md` e `.env.example` foram atualizados com o timeout, os motivos de fallback, as variáveis do Copiloto, a ponte stdio, os erros JSON-RPC e o índice de alertas.

### 10. Vínculos alerta → trace com ids sujos
- **Problema:** ids em branco, com espaços, `UNKNOWN` em maiúsculas e o trace-id W3C todo-zero eram gravados como vínculo; `max = 0` era ignorado.
- **Por quê:** o filtro só descartava vazio e `unknown` minúsculo.
- **Solução:** `buildTraceLinks` aplica `trim`, descarta esses casos e respeita `max < 1`.
- **Mantido de propósito:** a consulta de traces também roda para alertas suprimidos por cooldown. Ela alimenta a contagem de suprimidos que o Copiloto mostra, e custa menos de 1 ms nos volumes atuais (78 ms com 200 mil eventos na janela).

---

## Fora do escopo

- O CORS do dashboard (`index.ts`) recebe `CORS_ORIGIN` como uma string única, então uma lista separada por vírgula não funciona lá.
- A monografia (`docs/tcc/`) não foi alterada. O texto dela sobre o Copiloto continua válido, mas não menciona cache, limite de chamadas nem ponte stdio.
