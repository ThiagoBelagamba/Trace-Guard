# ADR 009 — Inspeção semântica em sombra com sidecar Laya

## Status

Aceito

## Contexto

O ADR 005 fixou heurísticas em memória para scraping (User-Agent, headers, taxa e varredura de paths), com orçamento de latência na casa de 2 ms. Prompt injection e credencial colada no corpo da requisição usam cabeçalho de navegador e baixa frequência. Essas requisições passam pelo detector atual.

Rodar um modelo no mesmo processo, no caminho da resposta, somaria dezenas ou centenas de milissegundos a cada POST e misturaria probabilidade com a soma de pontos que o limiar 70 compara.

## Decisão

Classificar texto com o Laya (`mmBERT-base`, checkpoint `multilingual`) num sidecar `laya-serve`, fora do ciclo HTTP.

- O middleware copia `traceId`, `spanId`, IP, path e método e só então agenda `setImmediate`.
- O sidecar recebe `POST /v1/systemone`. Alerta quando `noul >= 0.80` e `abstention !== "abstained"`. `min_confidence` continua sendo o gate de certeza (`answer_confidence`), não o de positividade.
- O evento vai para `POST /api/v1/ingest/rasp` com `action: "logged"`, tipos `prompt_injection` ou `secret_leak`, e a probabilidade em `metadata` (`scoreScale: "noul_percent"`). Esses tipos pesam 0 em `THREAT_SCORES`.
- Falha, timeout (8 s) ou fila cheia (4 em voo) não alteram a resposta da aplicação.
- Pedido que o heurístico já bloqueia com 403 não é enviado ao sidecar.
- O serviço Compose usa o profile `laya` e uma imagem que instala o pacote no build.

## Consequências

- **Positivas:** o cliente da API não espera o modelo; o heap do Node não carrega o checkpoint; o dashboard junta o alerta ao mesmo `traceId`.
- **Negativas:** a primeira requisição maliciosa é registrada depois da resposta. Não há bloqueio preventivo desse corpo. Uma lista de bloqueio para as requisições seguintes fica fora desta decisão.
- **Medição:** latência do sombra e precisão do classificador só entram na monografia depois de um dataset rotulado. Não há número de produção neste ADR.

## Alternativas rejeitadas

- Inferência ONNX dentro do middleware (`laya-ts`): mesmo processo e mesmo atraso no caminho quente.
- Bloqueio síncrono esperando o sidecar: protege a primeira requisição e quebra o orçamento do ADR 005.
