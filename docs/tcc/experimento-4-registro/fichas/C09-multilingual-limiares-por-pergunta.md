# C09 — multilingual forçado, limiares por pergunta (ponto exploratório)

> Exploratória: definida depois de ver os dados. Nunca recebe "passou".

## 1. Identificação

- **Id:** C09
- **Status:** exploratória
- **Registrada em:** 08/11/2026 (retroativa)
- **Fonte:** Discussão de 08/11/2026 (varredura sobre C02).

## 2. Motivação

Discussão de 08/11/2026: em C02, os falsos positivos de credencial caem muito com limiar 0,99, mas os de injeção só caem perto de 0,995, porque as notas dos textos difíceis ficam saturadas perto de 1. É o ponto que motivou a opção A (C10).

Motivada por: [C02](C02-multilingual-forcado.md).

## 3. Hipótese

Só com o `multilingual`, limiares separados por pergunta passam as três condições, ao custo do recall de injeção.

## 4. Configuração

Arquivo: [`configuracoes/C09.json`](../configuracoes/C09.json)

| Parâmetro | Valor |
|---|---|
| Variante | `sdk` |
| Checkpoint | `multilingual` |
| Limiar injeção / credencial | 0,995 / 0,990 |
| `min_confidence` | 0,8 |
| Padrões de credencial (R10) | não |
| Conjunto de ajuste | validation |
| Conjunto de teste | validation |
| Referência | C00 |

## 5. Regra de seleção

Nenhuma regra fixada antes: os limiares foram lidos de uma varredura sobre a própria validação.

## 6. Critério

`tres-condicoes-v1` contra C00 no mesmo conjunto (ver [README](../README.md#critério-tres-condicoes-v1)).

## 7. Pré-registro

Não houve: configuração exploratória.

## 8. Resultado

**Conjunto `validation`** — saída: [`saidas/C02--validation.md`](../saidas/C02--validation.md) · origem: extraido-de-saida

| Métrica | Valor |
|---|---:|
| TP / FP / FN / TN | 151 / 10 / 59 / 96 |
| Precisão | 0,938 |
| Recall | 0,719 |
| F1 | 0,814 |
| Recall `prompt_injection` | 0,519 |
| Recall `secret_leak` | 0,740 |
| FP em legítimos difíceis | 9/54 |
| Latência média / p95 (ms) | — / — |

## 9. Veredito

**`validation`: Configuração C09 atende numericamente (sem pré-registro).**

| Condição | Valor | Exigido | Atende |
|---|---:|---:|---|
| F1 binário | 0,814 | ≥ 0,602 | sim |
| Recall de secret_leak | 0,740 | ≥ 0,344 | sim |
| Taxa de FP em legítimos difíceis | 0,167 | ≤ 0,198 | sim |


## 10. Observações

Atende numericamente, com recall de injeção 0,519 (acima da linha de base, 0,434). Os limiares foram escolhidos olhando a validação, então este ponto só justifica a C10, cujos limiares saem de uma regra fixada antes.
