# C04 — R1–R3, english calibrado (R6), limiar 0,85

> Exploratória: definida depois de ver os dados. Nunca recebe "passou".

## 1. Identificação

- **Id:** C04
- **Status:** exploratória
- **Registrada em:** 08/11/2026 (retroativa)
- **Fonte:** Relatório §16.

## 2. Motivação

R6 propôs ajustar a temperatura das notas no desenvolvimento (`docker/laya/calibrate.py`) para que 0,85 signifique a mesma coisa nas duas perguntas.

Motivada por: [C03](C03-english-forcado.md).

## 3. Hipótese

A calibração melhora Brier e ECE sem perder recall.

## 4. Configuração

Arquivo: [`configuracoes/C04.json`](../configuracoes/C04.json)

| Parâmetro | Valor |
|---|---|
| Variante | `sdk` |
| Checkpoint | `english-cal` |
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

**Conjunto `validation`** — saída: [`saidas/C04--validation.md`](../saidas/C04--validation.md) · origem: extraido-de-saida

| Métrica | Valor |
|---|---:|
| TP / FP / FN / TN | 142 / 8 / 68 / 98 |
| Precisão | 0,947 |
| Recall | 0,676 |
| F1 | 0,789 |
| Recall `prompt_injection` | 0,792 |
| Recall `secret_leak` | 0,010 |
| FP em legítimos difíceis | 7/54 |
| Latência média / p95 (ms) | 1303 / 2138 |

## 9. Veredito

**`validation`: Configuração C04 não atende.**

| Condição | Valor | Exigido | Atende |
|---|---:|---:|---|
| F1 binário | 0,789 | ≥ 0,602 | sim |
| Recall de secret_leak | 0,010 | ≥ 0,344 | não |
| Taxa de FP em legítimos difíceis | 0,130 | ≤ 0,198 | sim |


## 10. Observações

O `english-cal` praticamente parou de marcar credenciais. A calibração funcionou como um limiar mais alto, não como correção (§16.2). O ajuste bateu no teto de temperatura 5,0.
