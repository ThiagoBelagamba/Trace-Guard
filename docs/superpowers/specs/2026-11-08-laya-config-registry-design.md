# Experimento 4 — Registro de configurações do Laya (design)

**Data:** 08/11/2026
**Status:** aguardando aprovação

## Intenção

A validação (relatório §14) mostrou que R1–R3 não passaram no critério pré-registrado. Também mostrou que várias configurações foram testadas sem pré-registro: checkpoint forçado, calibração, varredura de limiar e híbrido. A partir de agora, toda configuração do Laya segue o mesmo caminho:

1. é pré-registrada antes de rodar;
2. é provada por commit;
3. roda uma vez;
4. recebe o veredito "Configuração X passou" ou "Configuração X não passou".

O objetivo é que a monografia mostre uma sequência legível de tentativas. Cada uma justifica a seguinte, e as que falharam também ficam registradas.

A próxima configuração é a **opção A**, aprovada em 08/11/2026: `multilingual` forçado, com um limiar para injeção e outro para credencial. O recall de injeção em torno de 0,52 foi aceito como custo.

## Objetivos

- **Um formato único por configuração.** Cada configuração tem uma ficha legível (`Cnn.md`) e um arquivo de máquina (`Cnn.json`) que o script de experimento lê diretamente.
- **O que roda é o que foi registrado.** `LAYA_CONFIG=Cnn pnpm experiment:laya` aplica exatamente o JSON. Nenhum parâmetro do experimento vem de outro lugar.
- **O pré-registro é provado pelo git.** O script se recusa a rodar no conjunto de teste se o JSON da configuração tiver mudanças não commitadas. O cabeçalho da saída imprime o hash do commit do JSON.
- **Um índice comparativo gerado.** `indice.md` sai dos JSON de configuração e de resultado, sem cópia à mão.
- **Registros retroativos.** As configurações já testadas entram no registro com o status correto: pré-registrada ou exploratória.

## Não objetivos

- Mudar o critério de três condições. Ele continua o da §14.1, sempre comparado à linha de base (C00) medida no mesmo conjunto.
- Mudar as perguntas do preset (o piso de ~6/54 FP em textos saturados). Isso fica para trabalho futuro.
- Ativar a calibração ou o híbrido no SDK.
- Mudar o comportamento padrão do SDK. Sem configuração, os dois limiares continuam 0,85.

## Antiobjetivos

Seria um fracasso, mesmo funcionando tecnicamente, se:

- um JSON de configuração já executado fosse editado em vez de virar uma configuração nova;
- um resultado exploratório aparecesse no índice com a mesma cara de um pré-registrado;
- os limiares da opção A fossem escolhidos olhando o conjunto de teste.

## Abordagens consideradas

1. **Só documentação.** Fichas em Markdown, e o script continua configurado por variáveis de ambiente. É barato, mas nada garante que a execução usou o que a ficha diz, e o índice é copiado à mão. Descartada.
2. **Ficha + JSON lido pelo script.** Escolhida pelo Gabriel. O JSON é a fonte da verdade da execução e a ficha explica o porquê.
3. **Só JSON, ficha gerada.** Perde o texto de motivação e hipótese, que é o que a banca lê. Descartada.

## Estrutura

```
docs/tcc/experimento-4-registro/
  README.md                ← protocolo, ciclo de vida, formato
  indice.md                ← gerado
  configuracoes/C00.json … Cnn.json
  fichas/C00-linha-de-base.md … 
  resultados/Cnn--<conjunto>.json   ← métricas resumidas, gerado pelo script
  saidas/Cnn--<conjunto>.md         ← saída bruta do script
```

O diretório `docs/tcc/experimento-4-validacao/` atual passa para `saidas/`, com os nomes ajustados para o novo padrão.

### `Cnn.json` (configuração)

```json
{
  "id": "C08",
  "titulo": "multilingual forçado, limiares por pergunta",
  "status": "pre-registrada",
  "motivada_por": ["C02", "C07"],
  "variante": "sdk",
  "checkpoint": "multilingual",
  "limiares": { "prompt_injection": 0.995, "secret_leak": 0.99 },
  "min_confidence": 0.8,
  "padroes_credencial": false,
  "conjunto_ajuste": ["dev", "validation"],
  "conjunto_teste": "test",
  "criterio": "tres-condicoes-v1",
  "referencia": "C00"
}
```

**Campos:**

- **`status`:**
  - `referencia` (linha de base);
  - `pre-registrada`;
  - `exploratoria` (definida depois de ver os dados; nunca recebe "passou").
- **`variante`:** `sdk` (perguntas R1) ou `baseline` (perguntas pré-R1).
- **`checkpoint`:** `roteamento`, `multilingual`, `english`, `multilingual-cal` ou `english-cal`.
- **`limiares`:** obrigatório, um valor por pergunta.
- **`criterio`:** o nome de um critério definido no README. Hoje só existe `tres-condicoes-v1`.

### `Cnn--<conjunto>.json` (resultado)

Gerado pelo script ao fim da etapa de acurácia. Contém:

- o id da configuração, o conjunto e a data;
- o hash do commit do JSON da configuração;
- TP/FP/FN/TN, precisão, recall e F1;
- recall de injeção e de credencial;
- FP em difíceis (contagem e n);
- latência média e p95;
- o veredito por condição, quando o conjunto é o de teste e existe resultado da referência no mesmo conjunto.

Para os registros retroativos, esses arquivos são extraídos das saídas brutas já salvas, sem rodar de novo, e marcados com `"origem": "extraido-de-saida"`.

### Ficha `Cnn-<slug>.md`

As seções, nesta ordem:

1. Identificação (id, data, status)
2. Motivação (quais resultados anteriores levaram a esta configuração, com links)
3. Hipótese
4. Configuração (tabela renderizada do JSON)
5. Regra de seleção, se algum parâmetro foi escolhido por regra
6. Critério
7. Pré-registro (hash do commit)
8. Resultado
9. Veredito
10. Observações

As seções 1 a 7 ficam congeladas depois do commit de pré-registro. Só as seções 8 a 10 são preenchidas depois da execução.

### Ciclo de vida (README)

1. **Rascunho.** Ficha e JSON escritos.
2. **Pré-registro.** Commit com ficha e JSON, mensagem `prereg(laya): Cnn …`. Esse hash é a prova.
3. **Execução.** `LAYA_CONFIG=Cnn LAYA_DATASET=test pnpm experiment:laya`. O script confere que o JSON está igual ao commitado, roda, e grava o resultado e a saída bruta.
4. **Registro.** Ficha preenchida (resultado e veredito), índice regenerado, commit `result(laya): Cnn passou|não passou`.

Qualquer mudança depois do passo 2 vira uma configuração nova (Cnn+1) que cita a anterior em `motivada_por`.

### Índice (`indice.md`)

A tabela tem as colunas: id, status, checkpoint, limiares PI/SL, conjunto, F1, recall SL, recall PI, FP difíceis, latência e veredito. Uma seção separada lista as exploratórias, que nunca têm veredito "passou". O comando é `pnpm run experiment:laya:index`.

## Registros iniciais (retroativos)

| Id | Configuração | Status | Conjunto | Veredito |
|---|---|---|---|---|
| C00 | Linha de base pré-R1, roteamento, 0,85 | referência | dev, validation | — |
| C01 | R1–R3, roteamento, 0,85 | pré-registrada (critério em `d7dd160`) | validation | não passou (FP 15/54) |
| C02 | R1–R3, `multilingual` forçado, 0,85 | exploratória | validation | não passou (FP 19/54) |
| C03 | R1–R3, `english` forçado, 0,85 | exploratória | validation | não passou |
| C04 | R1–R3, `english-cal`, 0,85 | exploratória | validation | não passou (recall SL 0,010) |
| C05 | R1–R3, `multilingual-cal`, 0,85 | exploratória | validation | atende numericamente, sem pré-registro |
| C06 | R1–R3, roteamento, limiar 0,97 | exploratória | validation | atende numericamente, sem pré-registro |
| C07 | Híbrido: PI `english` + SL `multilingual` | exploratória | validation | atende numericamente, sem pré-registro |
| C08 | Opção A: `multilingual`, limiares por pergunta | pré-registrada | test | pendente |

C01 é a única retroativa com pré-registro de verdade: o critério foi commitado em `d7dd160` antes da execução. As exploratórias usam a palavra "atende" e nunca "passou".

R10 (padrões) é uma camada do SDK, não uma configuração do modelo. Ela entra como campo (`padroes_credencial`) e aparece como linha separada em C01.

## C08: a opção A

**Parâmetros fixos:** `multilingual` forçado, perguntas R1, `min_confidence` 0,8, padrões desligados (para isolar o efeito do modelo).

**Regra de seleção dos limiares, pré-registrada antes de rodar:**

- grade por pergunta: {0,85, 0,90, 0,93, 0,95, 0,97, 0,98, 0,99, 0,995, 0,999};
- conjunto de ajuste: dev + validation (356 textos);
- restrição: taxa de FP em difíceis ≤ 0,15 no ajuste, que dá margem sob o limite;
- objetivo: maior F1; em caso de empate, maior recall de injeção.

**Como a regra vira números:**

1. Um script de seleção aplica a regra sobre os resultados de C02 em validation e de uma execução nova de C02 em dev (o dev com `multilingual` forçado ainda não foi rodado).
2. Os limiares escolhidos são gravados no JSON de C08.
3. O commit de pré-registro de C08 só acontece depois disso.

**Conjunto de teste:** `scripts/experiments/data/laya-test.json`, escrito pelo Gabriel sem ver notas do modelo.

- Cerca de 300 textos, com **pelo menos 100 legítimos difíceis**.
- Metade em português e metade em inglês.
- `checkDatasetIntegrity` estendido para conferir que não há sobreposição com dev nem com validation.

**Critério:** `tres-condicoes-v1` contra C00 no mesmo conjunto de teste. Por isso C00 também roda no teste, uma vez. O resultado reporta também o intervalo de Wilson a 95% da taxa de FP em difíceis.

## Mudanças de código

- **SDK** (`laya-inspector.ts`):
  - `isHit(signal, threshold)` passa a receber o limiar.
  - Novo tipo `LayaThresholds { prompt_injection; secret_leak }`, com padrão 0,85/0,85.
  - O modo sombra e o interceptor Express aceitam `layaThresholds` opcional.
  - O comportamento sem configuração não muda.
- **Script** (`laya-eval.ts`):
  - `LAYA_CONFIG` carrega e valida o JSON.
  - Os campos do JSON substituem `LAYA_MODEL`, `LAYA_VARIANTS` e o limiar; se forem combinados com `LAYA_CONFIG`, o script recusa.
  - Imprime id, status e hash no cabeçalho.
  - Confere `git status` do JSON quando o conjunto é `test`.
  - Grava o resultado e a saída em `docs/tcc/experimento-4-registro/`.
- **Novos scripts:**
  - `laya-registry.ts`: tipos, validação, leitura e o gerador do índice;
  - `laya-select-thresholds.ts`: a regra de C08;
  - extrator retroativo das saídas brutas.
- **`package.json`:** `experiment:laya:index` e `experiment:laya:select`.
- **Relatório:**
  - nova §19 com o protocolo e o índice;
  - §14–§17 passam a citar os ids.

## Fica com quem implementar

- O formato exato da tabela renderizada na ficha.
- Os nomes internos de funções.
- Se o extrator retroativo é um script permanente ou de uso único (os resultados extraídos são commitados de qualquer forma).

## Decisões minhas a conferir

- **IDs em sequência única (C00…), com status por linha.** A alternativa era separar C (pré-registradas) de E (exploratórias).
- **Restrição de 0,15 na regra de seleção, e não 10/54.** Dá margem para a variação entre conjuntos (§3 da discussão).
- **Padrões desligados em C08.** Assim o efeito medido é só do modelo. Ligar os padrões seria uma C09 separada.
- **Trabalho no mesmo branch `feature/laya-tuning`.** O branch ainda não foi integrado e o registro depende dos resultados dele.
