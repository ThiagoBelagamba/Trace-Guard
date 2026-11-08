# Scripts de experimento (TCC)

Scripts que produzem os números do capítulo de resultados da monografia. Cada experimento roda com um comando `pnpm` a partir da raiz do repositório. Os resultados consolidados ficam em [`docs/tcc/resultados-experimentos.md`](../../docs/tcc/resultados-experimentos.md).

## Mapa da pasta

```
scripts/experiments/
├── alert-fatigue.ts      Experimento 1: fadiga de alertas
├── rasp-eval.ts          Experimento 2: precisão e recall do RASP heurístico
├── overhead.ts           Experimento 3: overhead do RASP e latência de ingestão
└── laya-experiments/     Experimento 4: Laya (sidecar semântico em modo sombra)
                          tem README próprio
```

Os testes de carga com k6 ficam à parte, em [`scripts/load-test/`](../load-test/).

## Experimentos

| # | Comando | O que mede | Precisa estar no ar |
|---|---|---|---|
| 1 | `pnpm run experiment:fatigue` | Eventos de erro ingeridos contra alertas disparados e suprimidos pelo cooldown | backend, Postgres, RabbitMQ |
| 2 | `pnpm run experiment:rasp` | Precisão e recall do RASP heurístico num dataset rotulado | demo-api com RASP em modo `block` |
| 3 | `pnpm run experiment:overhead` | p50/p95 de `GET /health` na demo-api e de `POST /api/v1/ingest` no backend | demo-api e backend |
| 4 | `pnpm run experiment:laya` | Acurácia, latência, custo no caminho quente e integração por `traceId` do sidecar Laya | sidecar Laya e backend |

Variáveis comuns: `API_URL` (padrão `http://localhost:3001`), `API_KEY`, `DEMO_API_URL` (padrão `http://localhost:4000`).

## Experimento 4 (Laya)

É o maior dos quatro: tem dataset próprio, registro de configurações pré-registradas, re-pontuação e seleção de limiares. Por isso fica numa pasta separada. Veja [`laya-experiments/README.md`](laya-experiments/README.md) para o mapa dos módulos e os fluxos de trabalho, e [`docs/tcc/experimento-4-registro/README.md`](../../docs/tcc/experimento-4-registro/README.md) para as regras do registro.

## Testes

Os testes (`*.test.ts`) rodam com o resto do monorepo:

```bash
pnpm vitest run scripts/
```
