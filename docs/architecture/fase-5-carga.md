# Fase 5 — Testes de carga (k6)

## Pré-requisitos

- [k6](https://k6.io/docs/get-started/installation/) instalado
- Backend rodando em `http://localhost:3001`
- (Opcional) demo-api em `http://localhost:4000` para teste RASP

## Scripts

### Ingestão de telemetria

```bash
pnpm load:test
# ou
k6 run scripts/load-test/k6-ingest.js
```

Configuração: 100 VUs, 30s, threshold p95 < 500ms.

### RASP (demo-api)

```bash
k6 run scripts/load-test/k6-rasp.js
```

## Resultados esperados (PoC local)

| Cenário | Métrica alvo |
|---|---|
| POST /ingest | p95 < 500ms, erro < 1% |
| demo-api + RASP | mix 200/403 conforme heurísticas |

Documentar resultados reais da sua máquina na monografia (varia com hardware e Docker).

## Comparativo Fase 4 vs 5

| Cenário | Fase 4 | Fase 5 |
|---|---|---|
| API cai | Sem detecção | Probe + alerta + webhook |
| 2 backends | WS local apenas | Redis sincroniza |
| 2 demo-api | Rate limit isolado | Redis unifica por IP |
