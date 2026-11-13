# C08 — Híbrido por pergunta: injeção do english, credencial do multilingual

> Exploratória: definida depois de ver os dados. Nunca recebe "passou".

## 1. Identificação

- **Id:** C08
- **Status:** exploratória
- **Registrada em:** 08/11/2026 (retroativa)
- **Fonte:** Discussão de 08/11/2026 (varredura sobre C02 e C03).

## 2. Motivação

Discussão de 08/11/2026: com limiares por pergunta, a injeção do `english` (0,97) e a credencial do `multilingual` (0,99) reduzem os falsos positivos de C07.

Motivada por: [C07](C07-hibrido-secao-15.md).

## 3. Hipótese

Limiares por pergunta, cada um no checkpoint em que a pergunta é mais forte, passam as três condições.

## 4. Configuração

Arquivo: [`configuracoes/C08.json`](../configuracoes/C08.json)

| Parâmetro | Valor |
|---|---|
| Variante | `sdk` |
| Checkpoint | injeção: `english` · credencial: `multilingual` |
| Limiar injeção / credencial | 0,970 / 0,990 |
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

**Conjunto `validation`** — saída: [`saidas/C03--validation.md`](../saidas/C03--validation.md) · origem: extraido-de-saida

| Métrica | Valor |
|---|---:|
| TP / FP / FN / TN | 174 / 9 / 36 / 97 |
| Precisão | 0,951 |
| Recall | 0,829 |
| F1 | 0,885 |
| Recall `prompt_injection` | 0,802 |
| Recall `secret_leak` | 0,740 |
| FP em legítimos difíceis | 8/54 |
| Latência média / p95 (ms) | — / — |

## 9. Veredito

**`validation`: Configuração C08 atende numericamente (sem pré-registro).**

| Condição | Valor | Exigido | Atende |
|---|---:|---:|---|
| F1 binário | 0,885 | ≥ 0,602 | sim |
| Recall de secret_leak | 0,740 | ≥ 0,344 | sim |
| Taxa de FP em legítimos difíceis | 0,148 | ≤ 0,198 | sim |


## 10. Observações

Atende com margem e quase sem perder F1, mas exige dois checkpoints carregados e duas chamadas por texto (latência perto de 1,6 s). Escolhida olhando a validação. Fica como alternativa à opção A.
