# C00 — Linha de base (pré-R1), roteamento por idioma

## 1. Identificação

- **Id:** C00
- **Status:** referência
- **Registrada em:** 08/11/2026 (retroativa)
- **Fonte:** Relatório §4–§9 (execução original) e §13.1 (reprodução exata).

## 2. Motivação

É a configuração anterior aos ajustes R1–R5, congelada em `scripts/experiments/laya-experiments/core/laya-baseline.ts`: perguntas antigas, limiar 0,8, roteamento por idioma, escolha do tipo pela maior nota. Serve de comparação para todo o critério.

## 3. Hipótese

Não se aplica: é a referência.

## 4. Configuração

Arquivo: [`configuracoes/C00.json`](../configuracoes/C00.json)

| Parâmetro | Valor |
|---|---|
| Variante | `baseline` |
| Checkpoint | `roteamento` |
| Limiar injeção / credencial | 0,800 / 0,800 |
| `min_confidence` | 0,8 |
| Padrões de credencial (R10) | não |
| Conjunto de ajuste | — |
| Conjunto de teste | validation |
| Referência | — |

## 5. Regra de seleção

Não se aplica: nenhum parâmetro foi escolhido por regra.

## 6. Critério

Não se aplica: é a referência dos demais.

## 7. Pré-registro

Não se aplica.

## 8. Resultado

**Conjunto `dev`** — saída: [`saidas/C01--dev.md`](../saidas/C01--dev.md) · origem: extraido-de-saida

| Métrica | Valor |
|---|---:|
| TP / FP / FN / TN | 13 / 3 / 9 / 15 |
| Precisão | 0,812 |
| Recall | 0,591 |
| F1 | 0,684 |
| Recall `prompt_injection` | 0,667 |
| Recall `secret_leak` | 0,300 |
| FP em legítimos difíceis | 3/10 |
| Latência média / p95 (ms) | 786 / 1711 |

**Conjunto `validation`** — saída: [`saidas/C01--validation.md`](../saidas/C01--validation.md) · origem: extraido-de-saida

| Métrica | Valor |
|---|---:|
| TP / FP / FN / TN | 73 / 8 / 137 / 98 |
| Precisão | 0,901 |
| Recall | 0,348 |
| F1 | 0,502 |
| Recall `prompt_injection` | 0,434 |
| Recall `secret_leak` | 0,144 |
| FP em legítimos difíceis | 8/54 |
| Latência média / p95 (ms) | 633 / 1286 |

**Conjunto `test`** — saída: [`saidas/C00--test.md`](../saidas/C00--test.md) · origem: execucao

| Métrica | Valor |
|---|---:|
| TP / FP / FN / TN | 75 / 18 / 120 / 144 |
| Precisão | 0,806 |
| Recall | 0,385 |
| F1 | 0,521 |
| Recall `prompt_injection` | 0,444 |
| Recall `secret_leak` | 0,125 |
| FP em legítimos difíceis | 18/132 |
| Latência média / p95 (ms) | 704 / 1376 |

## 9. Veredito

- `dev`: referência.
- `validation`: referência.
- `test`: referência.

## 10. Observações

Nos dois conjuntos, a linha de base marca pouco: recall de 0,591 no desenvolvimento e 0,348 na validação. Por isso tem poucos falsos positivos, o que torna a condição 3 exigente.
