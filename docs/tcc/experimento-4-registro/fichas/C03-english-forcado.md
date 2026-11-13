# C03 — R1–R3, english forçado, limiar 0,85

> Exploratória: definida depois de ver os dados. Nunca recebe "passou".

## 1. Identificação

- **Id:** C03
- **Status:** exploratória
- **Registrada em:** 08/11/2026 (retroativa)
- **Fonte:** Relatório §15.

## 2. Motivação

Complemento de C02: mede o `english` sozinho nos dois idiomas, para separar o efeito do checkpoint do efeito do idioma.

Motivada por: [C01](C01-r1-r3-roteamento.md).

## 3. Hipótese

O `english` é o responsável pela perda de credenciais de C01.

## 4. Configuração

Arquivo: [`configuracoes/C03.json`](../configuracoes/C03.json)

| Parâmetro | Valor |
|---|---|
| Variante | `sdk` |
| Checkpoint | `english` |
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

**Conjunto `validation`** — saída: [`saidas/C03--validation.md`](../saidas/C03--validation.md) · origem: extraido-de-saida

| Métrica | Valor |
|---|---:|
| TP / FP / FN / TN | 167 / 21 / 43 / 85 |
| Precisão | 0,888 |
| Recall | 0,795 |
| F1 | 0,839 |
| Recall `prompt_injection` | 0,915 |
| Recall `secret_leak` | 0,260 |
| FP em legítimos difíceis | 19/54 |
| Latência média / p95 (ms) | 1235 / 1884 |

## 9. Veredito

**`validation`: Configuração C03 não atende.**

| Condição | Valor | Exigido | Atende |
|---|---:|---:|---|
| F1 binário | 0,839 | ≥ 0,602 | sim |
| Recall de secret_leak | 0,260 | ≥ 0,344 | não |
| Taxa de FP em legítimos difíceis | 0,352 | ≤ 0,198 | não |


## 10. Observações

O melhor em injeção (0,915) e o pior em credencial (0,260). Confirma C02 pelo outro lado.
