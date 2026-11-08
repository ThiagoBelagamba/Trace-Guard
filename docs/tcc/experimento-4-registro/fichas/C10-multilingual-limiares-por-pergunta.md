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

Executada uma única vez em 08/11/2026 no conjunto de teste (`scripts/experiments/laya-experiments/data/laya-test.json`, commit `d858d4d`):
- 357 textos: 99 de injeção, 96 de credencial e 162 legítimos, dos quais 132 difíceis;
- 179 textos em português;
- nenhuma chamada com falha.

O cabeçalho da saída confirma o commit de pré-registro `55faa9d`. A referência C00 rodou no mesmo conjunto antes.

Os dois resultados registram `codigo.modificado: true`. A única mudança local era um título `## NOVO CONJUNTO` em `scripts/experiments/laya-experiments/data/README.md`, que não é código executado.

| Métrica | C00 (referência) | C10 |
|---|---:|---:|
| TP / FP / FN / TN | 75 / 18 / 120 / 144 | 111 / 29 / 84 / 133 |
| Precisão | 0,806 | 0,793 |
| Recall | 0,385 | 0,569 |
| F1 | 0,521 | **0,663** |
| Recall `prompt_injection` | 0,444 | 0,283 |
| Recall `secret_leak` | 0,125 | **0,688** |
| FP em legítimos difíceis | 18/132 (0,136) | 29/132 (0,220) |
| Intervalo de Wilson 95% da taxa de FP em difíceis | 0,088 – 0,205 | 0,158 – 0,298 |
| Latência média / p95 (ms) | 704 / 1376 | 421 / 716 |

Saídas: [`saidas/C00--test.md`](../saidas/C00--test.md) e [`saidas/C10--test.md`](../saidas/C10--test.md).

## 9. Veredito

**`test`: Configuração C10 não passou.**

| Condição | Valor | Exigido | Atende |
|---|---:|---:|---|
| F1 binário | 0,663 | ≥ 0,621 | sim |
| Recall de secret_leak | 0,688 | ≥ 0,325 | sim |
| Taxa de FP em legítimos difíceis | 0,220 (29/132) | ≤ 0,186 (24/132) | não |

## 10. Observações

**Ressalva de precisão (08/11/2026, depois do pré-registro e antes do teste).** As notas do pool da seção 5 vieram das saídas salvas, que imprimiam 3 casas decimais. Oito casos do pool aparecem exatamente como `0.995` (injeção) ou `0.990` (credencial), os limiares desta configuração. Uma nota impressa `0.995` pode ser qualquer valor entre 0,9945 e 0,9955, e o SDK compara o valor bruto.

| Leitura dos 8 casos de fronteira | F1 | Recall PI | Recall SL | FP em difíceis |
|---|---:|---:|---:|---:|
| Todos no limiar ou acima (o que a seção 5 mostra) | 0,823 | 0,542 | 0,754 | 10/64 |
| Todos abaixo do limiar | 0,818 | 0,517 | 0,754 | 7/64 |

Os números do pool são, portanto, uma faixa, e não um valor exato. Não se sabe, a partir das saídas salvas, se o par 0,995 / 0,99 continuaria em primeiro na grade com as notas brutas. **O veredito não é afetado:** a execução no teste usa as notas brutas do sidecar. Desde esta data, a saída do script imprime 6 casas.

**Análise da execução no teste (08/11/2026).** Tudo o que segue foi calculado depois de ver o resultado. Explica o veredito, mas não o muda.

- **O mesmo padrão de C01:** F1 e credencial passam com folga, e a condição 3 falha. Os 29 falsos positivos são todos em legítimos difíceis: 14 marcados como injeção e 15 como credencial. As categorias são chaves e certificados públicos (6), hashes e checksums (5), base64, JSON e Markdown inofensivos (4), logs e status de sistema (4), texto ofuscado inofensivo (3), citações de notícia ou artigo (2), além de boleto, PIX, `.env.example`, código sem segredo e roleplay. O conjunto de teste tem mais textos desse tipo do que a validação.
- **Nenhum limiar resolveria.** Mesmo com 0,999 nas duas perguntas, o `multilingual` marcaria 26 dos 132 difíceis, acima dos 24 permitidos. As notas desses textos ficam saturadas perto de 1. É o mesmo problema da §6.5 do relatório: o modelo julga o assunto do texto, não a ação.
- **O recall de injeção caiu para 0,283**, abaixo da linha de base (0,444) e muito abaixo dos 0,517–0,542 do pool. Dezoito injeções perdidas tinham nota entre 0,85 e 0,995: o limiar 0,995, necessário para conter os falsos positivos na validação, cortou essas injeções no teste.
- **O que se sustenta:** o `multilingual` forçado detecta credenciais muito melhor que a linha de base (0,688 contra 0,125), com 40% menos latência. Mas não separa um texto legítimo difícil de um ataque.
