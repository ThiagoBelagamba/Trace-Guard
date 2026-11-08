# Registro de configurações — Experimento 4 (Laya)

Gerado por `pnpm run experiment:laya:index`. Não editar à mão.

Critério `tres-condicoes-v1` contra a referência no mesmo conjunto. Só configurações pré-registradas, no seu conjunto de teste, recebem "passou" ou "não passou".

## Pré-registradas e referência

| Id | Configuração | Status | Checkpoint | Limiar PI / SL | Conjunto | F1 | Recall SL | Recall PI | FP difíceis | Latência média (ms) | Veredito |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---|
| C00 | Linha de base (pré-R1), roteamento por idioma | referencia | roteamento | 0,800 / 0,800 | dev | 0,684 | 0,300 | 0,667 | 3/10 | 786 | referência |
| C00 | Linha de base (pré-R1), roteamento por idioma | referencia | roteamento | 0,800 / 0,800 | validation | 0,502 | 0,144 | 0,434 | 8/54 | 633 | referência |
| C01 | R1–R3, roteamento por idioma, limiar 0,85 | pre-registrada | roteamento | 0,850 / 0,850 | dev | 0,909 | 0,900 | 0,917 | 2/10 | 795 | atende numericamente (sem pré-registro) |
| C01 | R1–R3, roteamento por idioma, limiar 0,85 | pre-registrada | roteamento | 0,850 / 0,850 | validation | 0,864 | 0,615 | 0,792 | 15/54 | 784 | não passou |

## Exploratórias (sem pré-registro)

Definidas depois de ver os dados. Nunca recebem "passou".

| Id | Configuração | Status | Checkpoint | Limiar PI / SL | Conjunto | F1 | Recall SL | Recall PI | FP difíceis | Latência média (ms) | Veredito |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---|
| C02 | R1–R3, multilingual forçado, limiar 0,85 | exploratoria | multilingual | 0,850 / 0,850 | dev | 0,936 | 1,000 | 1,000 | 3/10 | 458 | atende numericamente (sem pré-registro) |
| C02 | R1–R3, multilingual forçado, limiar 0,85 | exploratoria | multilingual | 0,850 / 0,850 | validation | 0,889 | 0,913 | 0,755 | 19/54 | 423 | não atende |
| C03 | R1–R3, english forçado, limiar 0,85 | exploratoria | english | 0,850 / 0,850 | validation | 0,839 | 0,260 | 0,915 | 19/54 | 1235 | não atende |
| C04 | R1–R3, english calibrado (R6), limiar 0,85 | exploratoria | english-cal | 0,850 / 0,850 | validation | 0,789 | 0,010 | 0,792 | 7/54 | 1303 | não atende |
| C05 | R1–R3, multilingual calibrado (R6), limiar 0,85 | exploratoria | multilingual-cal | 0,850 / 0,850 | validation | 0,733 | 0,615 | 0,340 | 5/54 | 421 | atende numericamente (sem pré-registro) |
| C06 | R1–R3, roteamento por idioma, limiar 0,97 | exploratoria | roteamento | 0,970 / 0,970 | validation | 0,801 | 0,490 | 0,660 | 10/54 | — | atende numericamente (sem pré-registro) |
| C07 | Híbrido do §15: injeção do roteamento, credencial do multilingual | exploratoria | PI roteamento · SL multilingual | 0,850 / 0,850 | validation | 0,910 | 0,913 | 0,792 | 14/54 | — | não atende |
| C08 | Híbrido por pergunta: injeção do english, credencial do multilingual | exploratoria | PI english · SL multilingual | 0,970 / 0,990 | validation | 0,885 | 0,740 | 0,802 | 8/54 | — | atende numericamente (sem pré-registro) |
| C09 | multilingual forçado, limiares por pergunta (ponto exploratório) | exploratoria | multilingual | 0,995 / 0,990 | validation | 0,814 | 0,740 | 0,519 | 9/54 | — | atende numericamente (sem pré-registro) |
