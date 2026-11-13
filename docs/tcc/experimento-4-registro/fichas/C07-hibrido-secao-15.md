# C07 — Híbrido do §15: injeção do roteamento, credencial do multilingual

> Exploratória: definida depois de ver os dados. Nunca recebe "passou".

## 1. Identificação

- **Id:** C07
- **Status:** exploratória
- **Registrada em:** 08/11/2026 (retroativa)
- **Fonte:** Relatório §15 (combinação exploratória).

## 2. Motivação

C01 é melhor em injeção e C02 em credencial. A combinação pega a nota de injeção de C01 e a de credencial de C02, a partir das notas já registradas.

Motivada por: [C01](C01-r1-r3-roteamento.md), [C02](C02-multilingual-forcado.md).

## 3. Hipótese

Juntar o melhor sinal de cada checkpoint resolve o recall sem custo de FP.

## 4. Configuração

Arquivo: [`configuracoes/C07.json`](../configuracoes/C07.json)

| Parâmetro | Valor |
|---|---|
| Variante | `sdk` |
| Checkpoint | injeção: `roteamento` · credencial: `multilingual` |
| Limiar injeção / credencial | 0,850 / 0,850 |
| `min_confidence` | 0,8 |
| Padrões de credencial (R10) | não |
| Conjunto de ajuste | validation |
| Conjunto de teste | validation |
| Referência | C00 |

## 5. Regra de seleção

Não se aplica: nenhum parâmetro foi escolhido por regra.

## 6. Critério

`tres-condicoes-v1` contra C00 no mesmo conjunto (ver [README](../README.md#critério-tres-condicoes-v1)).

## 7. Pré-registro

Não houve: configuração exploratória.

## 8. Resultado

**Conjunto `validation`** — saída: [`saidas/C01--validation.md`](../saidas/C01--validation.md) · origem: extraido-de-saida

| Métrica | Valor |
|---|---:|
| TP / FP / FN / TN | 188 / 15 / 22 / 91 |
| Precisão | 0,926 |
| Recall | 0,895 |
| F1 | 0,910 |
| Recall `prompt_injection` | 0,792 |
| Recall `secret_leak` | 0,913 |
| FP em legítimos difíceis | 14/54 |
| Latência média / p95 (ms) | — / — |

## 9. Veredito

**`validation`: Configuração C07 não atende.**

| Condição | Valor | Exigido | Atende |
|---|---:|---:|---|
| F1 binário | 0,910 | ≥ 0,602 | sim |
| Recall de secret_leak | 0,913 | ≥ 0,344 | sim |
| Taxa de FP em legítimos difíceis | 0,259 | ≤ 0,198 | não |


## 10. Observações

O melhor F1 (0,910), mas 14/54 FP. Não atende. Implementar exigiria duas chamadas ao sidecar por texto.
