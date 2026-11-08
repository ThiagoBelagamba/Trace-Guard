# C10 — Opção A: multilingual forçado, limiares por pergunta (regra pré-registrada)

## 1. Identificação

- **Id:** C10
- **Status:** pré-registrada
- **Registrada em:** 08/11/2026, antes de existir o conjunto de teste
- **Aprovada por:** Gabriel, em 08/11/2026 (opção A, aceitando recall de injeção em torno de 0,52)

## 2. Motivação

- [C01](C01-r1-r3-roteamento.md) não passou: os falsos positivos em legítimos difíceis subiram de 8/54 para 15/54.
- [C02](C02-multilingual-forcado.md) mostrou que o `multilingual` forçado tem o melhor F1 (0,889), o melhor recall de credencial (0,913) e metade da latência. O custo foram 19/54 FP em difíceis.
- [C09](C09-multilingual-limiares-por-pergunta.md) mostrou, olhando a validação, que limiares separados por pergunta atendem às três condições. A credencial precisa de 0,99; a injeção, de perto de 0,995, porque as notas dos difíceis ficam saturadas perto de 1.

C09 escolheu os limiares olhando a validação, então não vale como resultado. C10 testa a mesma ideia com limiares escolhidos por uma regra fixada antes, num conjunto que ninguém viu.

## 3. Hipótese

Com o `multilingual` forçado e um limiar para cada pergunta, escolhidos pela regra da seção 5, o SDK atende às três condições do critério contra a linha de base (C00) num conjunto de teste independente, com pelo menos 100 legítimos difíceis.

## 4. Configuração

Arquivo: [`configuracoes/C10.json`](../configuracoes/C10.json)

| Parâmetro | Valor |
|---|---|
| Variante | `sdk` (perguntas R1, prioridade de credencial R2) |
| Checkpoint | `multilingual` |
| Limiar injeção / credencial | 0,995 / 0,990 |
| `min_confidence` | 0,8 |
| Padrões de credencial (R10) | não (o efeito medido é só do modelo; ligar os padrões seria outra configuração) |
| Conjunto de ajuste | dev + validation (40 + 316 textos, 64 legítimos difíceis) |
| Conjunto de teste | test (`scripts/experiments/data/laya-test.json`) |
| Referência | C00 |

## 5. Regra de seleção

Os limiares foram escolhidos por `pnpm run experiment:laya:select -- --write C10` (`scripts/experiments/laya-select-thresholds.ts`). A regra:

1. **Grade por pergunta:** 0,85, 0,90, 0,93, 0,95, 0,97, 0,98, 0,99, 0,995, 0,999 (81 pares).
2. **Pool de ajuste:** notas por caso de C02 no dev (`saidas/C02--dev.md`) e na validação (`saidas/C02--validation.md`), com as contagens somadas antes de calcular as taxas.
3. **Restrição:** taxa de FP em legítimos difíceis no pool ≤ **0,17**.
4. **Objetivo:** maior F1 binário no pool.
5. **Desempate:** maior recall de injeção, depois maior recall de credencial, depois menor soma de limiares.

**Revisão do teto, antes do pré-registro.** O spec previa um teto de 0,15. Com ele, a regra escolhia injeção 0,999 / credencial 0,97, com recall de injeção 0,381 no pool: abaixo da linha de base (0,434 na validação) e abaixo do que foi aprovado. O motivo é que, no dev, o `multilingual` marcou 3 dos 10 legítimos difíceis. Com 0,17, a regra escolhe o par abaixo.

O Gabriel decidiu a revisão em 08/11/2026, antes deste commit e sem nenhum texto do conjunto de teste existir. O custo é menos margem na condição 3: 10/64 = 0,156 no pool.

Os 5 melhores pares que respeitam a restrição (10 de 81 respeitam):

| # | Limiar PI | Limiar SL | F1 | Recall PI | Recall SL | FP difíceis |
|---:|---:|---:|---:|---:|---:|---:|
| **1** | **0,995** | **0,99** | **0,823** | **0,542** | **0,754** | **10/64** |
| 2 | 0,995 | 0,995 | 0,823 | 0,542 | 0,711 | 10/64 |
| 3 | 0,995 | 0,999 | 0,820 | 0,542 | 0,667 | 10/64 |
| 4 | 0,999 | 0,93 | 0,785 | 0,381 | 0,886 | 10/64 |
| 5 | 0,999 | 0,95 | 0,776 | 0,381 | 0,860 | 10/64 |

O par escolhido coincide com o ponto exploratório C09. A diferença é de origem: aqui ele sai de uma regra aplicada ao pool, e o veredito vem de um conjunto novo.

## 6. Critério

`tres-condicoes-v1` (ver [README](../README.md#critério-tres-condicoes-v1)), contra C00 executada **no mesmo conjunto de teste**:

1. F1 binário ≥ F1 de C00 + 0,10;
2. recall de `secret_leak` ≥ recall de C00 + 0,20;
3. taxa de FP em legítimos difíceis ≤ taxa de C00 + 0,05.

O resultado traz também o intervalo de Wilson a 95% da taxa de FP em difíceis de C10 e de C00.

**Execução prevista** (uma vez, depois que `laya-test.json` existir e passar na conferência de integridade):

```bash
LAYA_CONFIG=C00 LAYA_DATASET=test pnpm run experiment:laya
LAYA_CONFIG=C10 pnpm run experiment:laya
pnpm run experiment:laya:index
```

## 7. Pré-registro

Esta ficha e `configuracoes/C10.json` foram commitados juntos com a mensagem `prereg(laya): C10 multilingual with per-question thresholds`. O hash desse commit aparece no cabeçalho da saída da execução no conjunto de teste, e o script se recusa a rodar se o JSON mudar depois dele.

## 8. Resultado

Pendente — aguardando `laya-test.json`.

## 9. Veredito

Pendente — aguardando `laya-test.json`.

## 10. Observações

Pendente.
