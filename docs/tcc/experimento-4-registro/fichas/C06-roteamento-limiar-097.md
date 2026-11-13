# C06 — R1–R3, roteamento por idioma, limiar 0,97

> Exploratória: definida depois de ver os dados. Nunca recebe "passou".

## 1. Identificação

- **Id:** C06
- **Status:** exploratória
- **Registrada em:** 08/11/2026 (retroativa)
- **Fonte:** Relatório §16.2 (varredura exploratória).

## 2. Motivação

Varredura de limiar feita sobre as notas de C01 na validação, para ver em que limiar a condição 3 passaria.

Motivada por: [C01](C01-r1-r3-roteamento.md).

## 3. Hipótese

Um limiar único mais alto basta para a condição 3.

## 4. Configuração

Arquivo: [`configuracoes/C06.json`](../configuracoes/C06.json)

| Parâmetro | Valor |
|---|---|
| Variante | `sdk` |
| Checkpoint | `roteamento` |
| Limiar injeção / credencial | 0,970 / 0,970 |
| `min_confidence` | 0,8 |
| Padrões de credencial (R10) | não |
| Conjunto de ajuste | validation |
| Conjunto de teste | validation |
| Referência | C00 |

## 5. Regra de seleção

Nenhuma regra fixada antes: o limiar foi lido de uma varredura sobre a própria validação.

## 6. Critério

`tres-condicoes-v1` contra C00 no mesmo conjunto (ver [README](../README.md#critério-tres-condicoes-v1)).

## 7. Pré-registro

Não houve: configuração exploratória.

## 8. Resultado

**Conjunto `validation`** — saída: [`saidas/C01--validation.md`](../saidas/C01--validation.md) · origem: extraido-de-saida

| Métrica | Valor |
|---|---:|
| TP / FP / FN / TN | 147 / 10 / 63 / 96 |
| Precisão | 0,936 |
| Recall | 0,700 |
| F1 | 0,801 |
| Recall `prompt_injection` | 0,660 |
| Recall `secret_leak` | 0,490 |
| FP em legítimos difíceis | 10/54 |
| Latência média / p95 (ms) | — / — |

## 9. Veredito

**`validation`: Configuração C06 atende numericamente (sem pré-registro).**

| Condição | Valor | Exigido | Atende |
|---|---:|---:|---|
| F1 binário | 0,801 | ≥ 0,602 | sim |
| Recall de secret_leak | 0,490 | ≥ 0,344 | sim |
| Taxa de FP em legítimos difíceis | 0,185 | ≤ 0,198 | sim |


## 10. Observações

A condição 3 só passa em 0,97, com F1 0,801 e recall de credencial 0,490. Escolhida olhando a validação.
