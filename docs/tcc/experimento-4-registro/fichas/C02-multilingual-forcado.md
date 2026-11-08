# C02 — R1–R3, multilingual forçado, limiar 0,85

> Exploratória: definida depois de ver os dados. Nunca recebe "passou".

## 1. Identificação

- **Id:** C02
- **Status:** exploratória
- **Registrada em:** 08/11/2026 (retroativa)
- **Fonte:** Relatório §15.

## 2. Motivação

Na validação, C01 perdeu 36 de 52 credenciais em inglês. Os textos em inglês iam para o checkpoint `english` (§14.5). Forçar o `multilingual` testa se o problema é do checkpoint.

Motivada por: [C01](C01-r1-r3-roteamento.md).

## 3. Hipótese

O `multilingual` sozinho recupera o recall de credencial em inglês.

## 4. Configuração

Arquivo: [`configuracoes/C02.json`](../configuracoes/C02.json)

| Parâmetro | Valor |
|---|---|
| Variante | `sdk` |
| Checkpoint | `multilingual` |
| Limiar injeção / credencial | 0,850 / 0,850 |
| `min_confidence` | 0,8 |
| Padrões de credencial (R10) | não |
| Conjunto de ajuste | — |
| Conjunto de teste | validation |
| Referência | C00 |

## 5. Regra de seleção

Não se aplica: nenhum parâmetro foi escolhido por regra.

## 6. Critério

`tres-condicoes-v1` contra C00 no mesmo conjunto (ver [README](../README.md#critério-tres-condicoes-v1)).

## 7. Pré-registro

Não houve: configuração exploratória.

## 8. Resultado

**Conjunto `validation`** — saída: [`saidas/C02--validation.md`](../saidas/C02--validation.md) · origem: extraido-de-saida

| Métrica | Valor |
|---|---:|
| TP / FP / FN / TN | 184 / 20 / 26 / 86 |
| Precisão | 0,902 |
| Recall | 0,876 |
| F1 | 0,889 |
| Recall `prompt_injection` | 0,755 |
| Recall `secret_leak` | 0,913 |
| FP em legítimos difíceis | 19/54 |
| Latência média / p95 (ms) | 423 / 680 |

## 9. Veredito

**`validation`: Configuração C02 não atende.**

| Condição | Valor | Exigido | Atende |
|---|---:|---:|---|
| F1 binário | 0,889 | ≥ 0,602 | sim |
| Recall de secret_leak | 0,913 | ≥ 0,344 | sim |
| Taxa de FP em legítimos difíceis | 0,352 | ≤ 0,198 | não |


## 10. Observações

Maior F1 da validação e metade da latência de C01, mas 19/54 FP em difíceis. Mostra que o checkpoint, e não o idioma, explicava a perda de credenciais.
