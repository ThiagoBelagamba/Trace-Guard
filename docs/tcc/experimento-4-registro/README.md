# Registro de configurações — Experimento 4 (Laya)

> **Nota (12/11/2026).** A LAYA foi removida da `main` em `05dd970` e substituída pelo Copiloto Forense (ADR 011). O código que executou este registro está na *tag* [`exp4-laya-final`](https://github.com/ThiagoBelagamba/Trace-Guard/tree/exp4-laya-final/scripts/experiments/laya-experiments). Os *links* relativos para `scripts/` funcionam naquela *tag*, não na `main`.

Toda configuração do Laya testada no Experimento 4 fica registrada aqui, no mesmo formato, para que as tentativas possam ser comparadas e cada uma justifique a seguinte. As que não passaram também ficam: elas são a justificativa das próximas.

O índice comparativo está em [`indice.md`](indice.md). Ele é gerado, não editado à mão.

## Estrutura

```
configuracoes/Cnn.json        o que roda: a fonte única dos parâmetros
fichas/Cnn-<slug>.md          por que roda: motivação, hipótese, resultado, veredito
resultados/Cnn--<conj>.json   métricas resumidas de uma execução (gerado)
saidas/Cnn--<conj>.md         saída bruta do script (gerado)
indice.md                     tabela comparativa (gerado)
```

`<conj>` é `dev` (40 textos do desenvolvimento), `validation` (316 textos independentes) ou `test` (o terceiro conjunto, `scripts/experiments/laya-experiments/data/laya-test.json`).

## Ciclo de vida

1. **Rascunho.** Escrever `configuracoes/Cnn.json` e as seções 1 a 7 da ficha.
2. **Pré-registro.** Commitar a ficha e o JSON juntos, com a mensagem `prereg(laya): Cnn <título>`. O hash desse commit é a prova de que nada foi escolhido depois de ver o resultado.
3. **Execução.** `LAYA_CONFIG=Cnn pnpm run experiment:laya`. O conjunto padrão é o `conjunto_teste` do JSON; `LAYA_DATASET` escolhe outro. No conjunto `test`, o script se recusa a rodar se o JSON tiver mudança não commitada ou nunca tiver sido commitado, e imprime o hash no cabeçalho da saída. A execução grava `saidas/` e `resultados/`.
4. **Registro.** Preencher as seções 8 a 10 da ficha, rodar `pnpm run experiment:laya:index` e commitar com `result(laya): Cnn passou` ou `result(laya): Cnn não passou`.

**Congelamento:** depois do passo 2, as seções 1 a 7 da ficha e o JSON não mudam mais. Qualquer ajuste vira uma configuração nova (Cnn+1), que cita a anterior em `motivada_por`.

Com `LAYA_CONFIG`, o script recusa `LAYA_MODEL`, `LAYA_VARIANTS` e `LAYA_STAGES` diferente de `accuracy`: todo parâmetro vem do JSON.

## Campos do JSON

| Campo | Valores | Significado |
|---|---|---|
| `id` | `C00`, `C01`… | Identificador, igual ao nome do arquivo. |
| `titulo` | texto | Nome curto da configuração. |
| `status` | `referencia`, `pre-registrada`, `exploratoria` | Ver "Palavras do veredito". |
| `motivada_por` | ids | Resultados anteriores que levaram a esta configuração. |
| `variante` | `sdk`, `baseline` | Perguntas do preset (R1) ou as anteriores aos ajustes. A `baseline` é congelada com limiar 0,8. |
| `checkpoint` | `roteamento`, `multilingual`, `english`, `multilingual-cal`, `english-cal`, ou um objeto `{prompt_injection, secret_leak}` | Checkpoint do sidecar. A forma de objeto (híbrido) só existe em exploratórias e não é executável: é registrada por re-pontuação. |
| `limiares` | `{prompt_injection, secret_leak}`, 0 a 1 | Limiar noul de cada pergunta. |
| `min_confidence` | 0 a 1 | Enviado ao sidecar; abaixo disso, o sidecar se abstém. |
| `padroes_credencial` | `true`, `false` | Liga a camada de padrões de credencial (R10, ADR 010). |
| `conjunto_ajuste` | ids de conjunto | Onde os parâmetros foram escolhidos. |
| `conjunto_teste` | `dev`, `validation`, `test` | Onde o veredito formal é dado. |
| `criterio` | `tres-condicoes-v1` | Critério de sucesso (abaixo). |
| `referencia` | id ou `null` | Configuração de comparação (C00). `null` só na própria referência. |

## Critério `tres-condicoes-v1`

Texto pré-registrado em 08/11/2026 (relatório §14.1, commit `d7dd160`). No mesmo conjunto, a configuração funciona se as três condições valerem em relação à referência:

1. F1 binário ≥ F1 da referência + 0,10;
2. recall de `secret_leak` ≥ recall da referência + 0,20;
3. taxa de FP em legítimos difíceis ≤ taxa da referência + 0,05.

O critério só compara resultados do mesmo conjunto. A referência (C00) roda em todo conjunto usado para veredito.

## Palavras do veredito

| Situação | Atende às 3 condições | Não atende |
|---|---|---|
| `pre-registrada`, executada no seu `conjunto_teste` | **passou** | **não passou** |
| qualquer outro caso (exploratória, ou pré-registrada fora do seu conjunto de teste) | atende numericamente (sem pré-registro) | não atende |

Configurações exploratórias foram definidas depois de ver os dados. Elas mostram onde procurar, mas **nunca recebem "passou"**.

## Comandos

| Comando | O que faz |
|---|---|
| `LAYA_CONFIG=Cnn pnpm run experiment:laya` | Executa uma configuração registrada (exige o sidecar). |
| `pnpm run experiment:laya:index` | Regenera `indice.md`. |
| `pnpm run experiment:laya:backfill` | Regrava os resultados retroativos C00–C09 a partir das saídas salvas. |
| `pnpm run experiment:laya:select -- --write Cnn` | Aplica a regra de seleção de limiares (C10) e grava no JSON ainda não commitado. |

## Onde está o código

O código que lê este registro, executa as configurações e gera o índice está em [`scripts/experiments/laya-experiments/`](../../../scripts/experiments/laya-experiments/README.md), principalmente em `registry/`. Os conjuntos `validation` e `test` estão em `scripts/experiments/laya-experiments/data/`.

**Mudança de caminho (08/11/2026).** Depois do resultado de C10, os scripts foram movidos de `scripts/experiments/` para `scripts/experiments/laya-experiments/`, e os dados de `scripts/experiments/data/` para `scripts/experiments/laya-experiments/data/`. Só os caminhos mudaram. As seções congeladas das fichas (1 a 7) e os commits anteriores citam os caminhos antigos e não foram editados.

## Registros retroativos

C00 a C09 foram executadas antes deste registro existir. Seus resultados foram extraídos das saídas brutas já salvas, por re-pontuação das notas por caso (`origem: "extraido-de-saida"`), e reproduzem exatamente os números do relatório (teste `laya-registry-backfill.test.ts`). Só C01 teve pré-registro de verdade: o critério foi commitado em `d7dd160` antes da execução na validação.
