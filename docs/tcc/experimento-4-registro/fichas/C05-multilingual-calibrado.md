# C05 — R1–R3, multilingual calibrado (R6), limiar 0,85

> Exploratória: definida depois de ver os dados. Nunca recebe "passou".

## 1. Identificação

- **Id:** C05
- **Status:** exploratória
- **Registrada em:** 08/11/2026 (retroativa)
- **Fonte:** Relatório §16.

## 2. Motivação

O mesmo de C04, no `multilingual`, que em C02 teve o melhor F1.

Motivada por: [C02](C02-multilingual-forcado.md).

## 3. Hipótese

A calibração reduz falsos positivos do `multilingual` sem perder recall.

## 4. Configuração

Arquivo: [`configuracoes/C05.json`](../configuracoes/C05.json)

| Parâmetro | Valor |
|---|---|
| Variante | `sdk` |
| Checkpoint | `multilingual-cal` |
| Limiar injeção / credencial | 0,850 / 0,850 |
| `min_confidence` | 0,8 |
| Padrões de credencial (R10) | não |
| Conjunto de ajuste | dev |
| Conjunto de teste | validation |
| Referência | C00 |

## 5. Regra de seleção

Temperaturas ajustadas por NLL no conjunto de desenvolvimento (`calibrate.py`, relatório §16.1).

## 6. Critério

`tres-condicoes-v1` contra C00 no mesmo conjunto (ver [README](../README.md#critério-tres-condicoes-v1)).

## 7. Pré-registro

Não houve: configuração exploratória.

## 8. Resultado

**Conjunto `validation`** — saída: [`saidas/C05--validation.md`](../saidas/C05--validation.md) · origem: extraido-de-saida

| Métrica | Valor |
|---|---:|
| TP / FP / FN / TN | 125 / 6 / 85 / 100 |
| Precisão | 0,954 |
| Recall | 0,595 |
| F1 | 0,733 |
| Recall `prompt_injection` | 0,340 |
| Recall `secret_leak` | 0,615 |
| FP em legítimos difíceis | 5/54 |
| Latência média / p95 (ms) | 421 / 640 |

## 9. Veredito

**`validation`: Configuração C05 atende numericamente (sem pré-registro).**

| Condição | Valor | Exigido | Atende |
|---|---:|---:|---|
| F1 binário | 0,733 | ≥ 0,602 | sim |
| Recall de secret_leak | 0,615 | ≥ 0,344 | sim |
| Taxa de FP em legítimos difíceis | 0,093 | ≤ 0,198 | sim |


## 10. Observações

Atende numericamente, mas o recall de injeção cai para 0,340, abaixo da linha de base (0,434). Avaliada depois de a calibração ser decidida no desenvolvimento, mas sem critério pré-registrado próprio, então não vale como resultado.
