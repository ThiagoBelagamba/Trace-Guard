# ADR 004 — Mitigação de Fadiga de Alertas

**Status:** Aceito  
**Data:** 2026-06-24  
**Fase:** 3 — Alertas Inteligentes

## Contexto

Sistemas de observabilidade que notificam a cada evento individual geram **fadiga de alertas**: operadores ignoram notificações por excesso de ruído. O problema central do TCC TraceGuard é mitigar isso em PMEs self-hosted.

Sem agregação, 100 erros em 5 minutos = 100 notificações. Com regras + cooldown, o mesmo cenário gera **1 alerta acionável** e registra os demais como **suprimidos**.

## Decisão

Implementar um **motor de regras** (`AlertEngine`) com três tipos:

| Tipo | Condição | Uso |
|---|---|---|
| `error_rate` | Taxa de erros >= threshold % na janela | Detectar degradação geral |
| `error_count` | Contagem absoluta de erros >= threshold | Detectar picos |
| `error_burst` | Mesmo `trace_id` com N+ erros na janela | Detectar falhas encadeadas |

**Cooldown in-memory** por `ruleId:service`: após disparo, repetições na janela de cooldown são persistidas com `suppressed: true` mas **não re-notificam** via WebSocket de forma prioritária (ainda registradas para métricas).

**View materializada** `telemetry_hourly_stats`: agregação horária para relatórios; avaliação de regras usa janela deslizante em `telemetry_events` para baixa latência.

Regras armazenadas em PostgreSQL (`alert_rules`) com seed de 3 regras padrão.

## Consequências

**Positivas:**
- Métrica `suppressionRate` demonstra valor da solução na monografia
- Regras configuráveis sem redeploy (habilitar/desabilitar via API)
- Alinhado ao tema acadêmico do TCC

**Negativas:**
- Cooldown perdido ao reiniciar backend (aceitável para PoC)
- Regras globais avaliam agregado `all`, não por tenant
- Sem notificação externa (e-mail/Slack) nesta fase

## Alternativas rejeitadas

- **Alertar cada log `level=error`:** perpetua fadiga de alertas
- **Cooldown só no frontend:** não persiste métrica de supressão
- **Regras em YAML:** menos flexível para evolução futura; DB escolhido para TCC

## Comparativo (monografia)

| Cenário | Sem TraceGuard | Com TraceGuard Fase 3 |
|---|---|---|
| 100 erros em 5 min | 100 notificações | 1 alerta + 99 suprimidos |
| Mesmo erro repetido | N alertas idênticos | 1 alerta a cada 15 min (cooldown) |
