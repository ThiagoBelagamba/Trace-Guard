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

## Revisão — ajustes pós-Experimento 4 (nov/2026)

O Experimento 4 (`docs/tcc/relatorio-experimento-4-laya.md`) mediu a configuração original: precisão 0,813, recall 0,591 e recall de credenciais 0,300. As decisões abaixo **substituem** as da seção Decisão onde conflitam, em particular "alerta quando `noul >= 0.80`".

- **Perguntas:** as três perguntas `noul` do preset `guard_questions()` do Laya (`jailbreak`, `prompt_injection` e `sensitive_data`), copiadas literalmente do pacote. O sinal de `prompt_injection` é a maior nota entre `jailbreak` e `prompt_injection`. O de `secret_leak` vem de `sensitive_data` (R1).
- **Campo do state:** `prompt`, que é o campo que as perguntas do preset leem.
- **Payload:** os valores string do corpo, um por linha, e não `JSON.stringify(req.body)`. O envelope JSON mudava notas individuais de forma imprevisível (R5, §6.2).
- **Limiar:** `noul >= 0.85` (`LAYA_NOUL_THRESHOLD`), separado do `min_confidence = 0.8` (`LAYA_MIN_CONFIDENCE`). A checagem de abstenção em `isHit` continua (R3, §7.3 e §8.5).
- **Tipo do evento:** se `secret_leak` passou do limiar, o tipo é `secret_leak`. Senão, é `prompt_injection`. `reasons` lista todos os sinais que passaram (R2, §7.1).
- **Sidecar:** `laya[serve]==0.4.12` fixado na imagem, com os checkpoints `multilingual` e `english` pré-carregados (`LAYA_MODELS=multilingual,english`, ~3,2 GB de RAM). O carregamento sob demanda do `english` travou a 1ª execução por ~2 min (R4, §8.1).

**Ressalva:** os ganhos esperados (F1 de 0,684 para ~0,9) foram medidos nos mesmos 40 textos usados para escolher as perguntas. Eles só valem como resultado depois da validação num conjunto independente (R9).
