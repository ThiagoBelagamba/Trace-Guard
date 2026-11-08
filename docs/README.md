# Documentação

Índice da pasta `docs/`. Para instalar e rodar o projeto, comece pelo [README da raiz](../README.md).

| Pasta / arquivo | Conteúdo |
|---|---|
| [`api-v1.md`](api-v1.md) | Referência da API REST `/api/v1` do backend. |
| [`adr/`](adr/) | Decisões de arquitetura (ADRs), numeradas. Uma decisão por arquivo: contexto, decisão, consequências. |
| [`architecture/`](architecture/) | Descrição da arquitetura por fase do projeto (dashboard, alertas, RASP, heurísticas, uptime, carga). |
| [`tcc/`](tcc/) | Material da monografia: texto, resultados dos experimentos, relatórios e o registro do Experimento 4. |
| [`superpowers/`](superpowers/) | Specs de design (`specs/`) e planos de implementação (`plans/`) usados no desenvolvimento, por data. |

## ADRs

| ADR | Assunto |
|---|---|
| [002](adr/002-realtime-websocket.md) | Tempo real via WebSocket |
| [003](adr/003-dashboard-stack.md) | Stack do dashboard |
| [004](adr/004-alert-fatigue.md) | Fadiga de alertas |
| [005](adr/005-rasp-runtime-protection.md) | RASP: proteção em tempo de execução |
| [006](adr/006-uptime-monitoring.md) | Monitoramento de uptime |
| [007](adr/007-redis-horizontal-scale.md) | Redis para escala horizontal |
| [008](adr/008-webhook-notifications.md) | Notificações por webhook |
| [009](adr/009-laya-semantic-rasp-sidecar.md) | Sidecar semântico Laya |
| [010](adr/010-secret-patterns-in-shadow.md) | Padrões de credencial em modo sombra |

## TCC

| Arquivo | Conteúdo |
|---|---|
| [`tcc/monografia.md`](tcc/monografia.md) | Texto da monografia. A versão para impressão fica em `tcc/latex/`. |
| [`tcc/resultados-experimentos.md`](tcc/resultados-experimentos.md) | Protocolo e resultados dos Experimentos 1 a 4. |
| [`tcc/relatorio-experimento-4-laya.md`](tcc/relatorio-experimento-4-laya.md) | Relatório completo do Experimento 4 (Laya). |
| [`tcc/experimento-4-registro/`](tcc/experimento-4-registro/README.md) | Registro das configurações pré-registradas do Laya: regras, fichas, resultados e índice. |
| [`tcc/roteiro-defesa.md`](tcc/roteiro-defesa.md) | Roteiro da apresentação. |

O código dos experimentos está em [`scripts/experiments/`](../scripts/experiments/README.md).
