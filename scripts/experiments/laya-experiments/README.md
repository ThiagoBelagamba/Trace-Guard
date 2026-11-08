# Experimento 4 — Laya

Código do Experimento 4: avalia o sidecar semântico Laya ([ADR 009](../../../docs/adr/009-laya-semantic-rasp-sidecar.md)) rodando em modo sombra ao lado do RASP do SDK, e mantém o registro de configurações pré-registradas.

Onde está cada coisa:

| O quê | Onde |
|---|---|
| Código (esta pasta) | `scripts/experiments/laya-experiments/` |
| Registro de configurações, regras e veredito | [`docs/tcc/experimento-4-registro/`](../../../docs/tcc/experimento-4-registro/README.md) |
| Índice comparativo das configurações (gerado) | [`docs/tcc/experimento-4-registro/indice.md`](../../../docs/tcc/experimento-4-registro/indice.md) |
| Relatório completo do experimento | [`docs/tcc/relatorio-experimento-4-laya.md`](../../../docs/tcc/relatorio-experimento-4-laya.md) |
| Resumo para a monografia | [`docs/tcc/resultados-experimentos.md`](../../../docs/tcc/resultados-experimentos.md), seção "Experimento 4" |
| Padrões de credencial em sombra | [ADR 010](../../../docs/adr/010-secret-patterns-in-shadow.md) |

## Mapa dos módulos

```
laya-experiments/
├── laya-eval.ts            ponto de entrada (pnpm run experiment:laya)
├── paths.ts                caminhos usados por todos os scripts (dados e registro)
├── core/                   o que mede
│   ├── laya-dataset.ts         dataset "dev": 40 textos rotulados, PT-BR e EN
│   ├── laya-dataset-loader.ts  lê e valida os conjuntos JSON (validation, test)
│   ├── laya-stats.ts           métricas: matriz de confusão, F1, Youden, latência, veredito
│   └── laya-baseline.ts        perguntas e limiar congelados da linha de base (C00)
├── registry/               o registro de configurações
│   ├── laya-registry.ts        tipos e leitura de configuracoes/ e resultados/, critério, Wilson, índice
│   ├── laya-run-config.ts      transforma um Cnn.json num plano de execução e aplica as travas
│   ├── laya-rescore.ts         re-pontua saídas salvas a partir das notas por caso
│   ├── laya-index.ts           gera indice.md          (experiment:laya:index)
│   ├── laya-registry-backfill.ts  resultados retroativos C00–C09 (experiment:laya:backfill)
│   └── laya-select-thresholds.ts  regra de seleção de limiares da C10 (experiment:laya:select)
├── calibration/
│   └── laya-calibration-export.ts  exporta o dataset dev rotulado para o ajuste de temperatura
│                                   (docker/laya/calibrate.py)  (experiment:laya:export-calibration)
└── data/                   conjuntos independentes (ver data/README.md)
    ├── laya-validation.json    316 textos
    └── laya-test.json          357 textos, usado só para veredito
```

Regra de dependência: `core/` não importa nada de `registry/` (só os módulos do SDK e do `shared` que ele mede). `registry/` usa `core/`. `laya-eval.ts` usa os dois. Caminhos de arquivo vêm sempre de `paths.ts`; os scripts assumem que rodam a partir da raiz do repositório (é o que `pnpm run` faz).

## Conjuntos de dados

| Nome (`LAYA_DATASET`) | Arquivo | Uso |
|---|---|---|
| `dev` (padrão sem `LAYA_CONFIG`) | `core/laya-dataset.ts` | Desenvolvimento. Já foi visto muitas vezes. |
| `validation` | `data/laya-validation.json` | Ajuste de configurações. Também já foi visto. |
| `test` | `data/laya-test.json` | Só veredito de configuração pré-registrada. Nunca usar para ajustar nada. |

Formato e regras de escrita dos JSON: [`data/README.md`](data/README.md).

## Fluxos de trabalho

Todos os comandos rodam da raiz do repositório.

**Subir o ambiente**

```bash
pnpm build                                     # a demo-api usa o dist do SDK
docker compose --profile laya up -d --build laya
pnpm dev:backend
```

**Registrar e testar uma configuração nova** (resumo; as regras completas estão no [README do registro](../../../docs/tcc/experimento-4-registro/README.md))

1. Criar `docs/tcc/experimento-4-registro/configuracoes/Cnn.json` e a ficha `fichas/Cnn-<slug>.md` (seções 1 a 7).
2. Commitar os dois juntos: `prereg(laya): Cnn <título>`.
3. Executar: `LAYA_CONFIG=Cnn pnpm run experiment:laya`.
4. Preencher as seções 8 a 10 da ficha, rodar `pnpm run experiment:laya:index` e commitar com `result(laya): Cnn passou` ou `result(laya): Cnn não passou`.

**Outros comandos**

| Comando | O que faz |
|---|---|
| `pnpm run experiment:laya` | Execução avulsa (sem registro), no dataset `dev`. Serve para explorar, não para veredito. |
| `LAYA_CONFIG=Cnn pnpm run experiment:laya` | Executa uma configuração registrada. Grava `saidas/` e `resultados/`. |
| `LAYA_CONFIG=C00 LAYA_DATASET=test pnpm run experiment:laya` | Roda a referência em outro conjunto. |
| `pnpm run experiment:laya:index` | Regenera `indice.md`. |
| `pnpm run experiment:laya:backfill` | Regrava os resultados retroativos C00–C09 a partir das saídas salvas. |
| `pnpm run experiment:laya:select -- --write Cnn` | Aplica a regra de seleção de limiares e grava no JSON ainda não commitado. |
| `pnpm run experiment:laya:export-calibration` | Exporta o dataset `dev` rotulado para `.cache/laya/calibration/dev.jsonl`, usado no ajuste de temperatura dos checkpoints `-cal`. |

**Variáveis de ambiente**

| Variável | Padrão | Observação |
|---|---|---|
| `LAYA_CONFIG` | — | Id de configuração registrada. Com ela, todo parâmetro vem do JSON. |
| `LAYA_DATASET` | `dev`, ou o `conjunto_teste` do JSON | `dev`, `validation` ou `test`. |
| `LAYA_SIDECAR_URL` | `http://localhost:8000` | Endereço do sidecar. |
| `LAYA_API_KEY` | `traceguard-secret` | Chave do sidecar. |
| `LAYA_MODEL` | — | Checkpoint forçado. Recusada com `LAYA_CONFIG`. |
| `LAYA_VARIANTS` | — | Variantes (`sdk`, `baseline`). Recusada com `LAYA_CONFIG`. |
| `LAYA_STAGES` | `all` | Etapas 4.1 a 4.4. Com `LAYA_CONFIG`, só `accuracy`. |
| `LAYA_REPS` | `1` | Repetições na acurácia. Recusada com `LAYA_CONFIG`. |
| `API_URL`, `API_KEY` | `http://localhost:3001` | Backend, para a etapa de integração. |
| `EXPERIMENT_DEMO_PORT` | `4100` | Porta da demo-api que o script sobe na etapa 4.3. |

## Travas de integridade

O código impede alguns erros que invalidariam o registro:

- Com `LAYA_CONFIG`, variáveis avulsas que mudariam parâmetros são recusadas.
- No conjunto `test`, o script se recusa a rodar se o JSON da configuração não estiver commitado ou tiver mudança local, e imprime o hash do commit de pré-registro no cabeçalho da saída.
- O script não sobrescreve um resultado já gravado no conjunto `test`.
- Cada resultado grava `codigo.commit` e `codigo.modificado`, para saber com qual revisão do código ele foi produzido.
- A linha de base (C00) tem perguntas e limiar congelados em `core/laya-baseline.ts`, com teste que falha se mudarem.

## Testes

```bash
pnpm vitest run scripts/experiments/laya-experiments
```

`registry/laya-registry-backfill.test.ts` confere que a re-pontuação reproduz exatamente os números já publicados no relatório.

## Histórico

Até 08/11/2026 estes arquivos ficavam soltos em `scripts/experiments/` (e os dados em `scripts/experiments/data/`). Fichas e commits anteriores a essa data citam os caminhos antigos; o conteúdo é o mesmo.
