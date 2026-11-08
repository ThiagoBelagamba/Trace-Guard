# ADR 010 — Padrões de credencial junto com o sombra do Laya

## Status

Aceito

## Contexto

O Experimento 4 (`docs/tcc/relatorio-experimento-4-laya.md`) mostrou que o Laya erra justamente as credenciais com formato fixo:

- **§6.5:** na configuração original, chaves AWS, tokens do GitHub e *connection strings* ficaram entre 0,19 e 0,73, abaixo do limiar. Todos têm prefixo ou estrutura que uma regex reconhece.
- **§8.6:** sob rajada, o gate de 4 inspeções em voo descarta corpos sem aviso (a R8 passou a contá-los). Uma credencial colada durante um pico pode nunca chegar ao modelo.

Na reexecução com R1–R5 (§13), o recall de `secret_leak` subiu para 0,900, mas `sl-github-en` continuou sendo um falso negativo. Um token com prefixo `ghp_` não deveria depender de uma nota de modelo.

## Decisão

Rodar quatro regex síncronas sobre o mesmo texto que vai ao Laya (`packages/sdk/src/rasp/secret-patterns.ts`):

| Padrão | Regex |
|---|---|
| `aws_access_key` | `\b(?:AKIA\|ASIA)[A-Z0-9]{16}\b` |
| `github_token` | `\bgh[pousr]_[A-Za-z0-9]{36,}\b` |
| `url_credentials` | `[a-z][a-z0-9+.-]*://[^\s:@/]+:[^\s@/]+@` (sem diferenciar maiúsculas) |
| `private_key_block` | `-----BEGIN [A-Z ]*PRIVATE KEY-----` |

- **Onde:** no `setImmediate` do sombra, depois da extração do texto e **antes** do gate. A regex não ocupa vaga e sobrevive a rajadas.
- **Evento:** `threatType: "secret_leak"`, `action: "logged"`, `score: 100` e `metadata: { source: "pattern", patterns: [...] }`.
- **Sem o segredo:** o evento leva só os nomes dos padrões, nunca o trecho casado. O evento vai para o PostgreSQL e para o dashboard, e gravar a credencial ali criaria um segundo vazamento.
- **Laya continua:** a inspeção do modelo segue normalmente depois do padrão. Ela pode achar o que a regex não cobre, como um `Bearer` genérico ou uma senha em prosa.
- **Escopo:** os padrões só rodam quando o sombra está ligado (`LAYA_SIDECAR_URL`), como parte da inspeção de corpo da ADR 009. Ligar padrões sem sidecar fica fora desta decisão.

## Consequências

- **Positivas:** credenciais de formato conhecido são registradas sem custo de modelo e mesmo com o gate cheio. No conjunto de desenvolvimento, os padrões cobrem 8 das 10 credenciais (os 2 `bearer_header` ficam de fora) e nenhum dos 18 textos legítimos.
- **Negativas:** o mesmo trace pode ter dois eventos, um `source: "pattern"` e outro `source: "laya"`. Os dois chegam ao backend como eventos distintos. A medição de entrega do Experimento 4 (`matchDeliveries`) considera só `source: "laya"`.
- **Manutenção:** novos formatos (Stripe, Slack, JWT) exigem mudar a lista. Uma regex nova precisa de teste com um texto legítimo parecido antes de entrar.

## Alternativas rejeitadas

- **Regex no caminho quente, bloqueando com 403:** protege a primeira requisição, mas transforma um falso positivo em erro para o usuário e muda o orçamento do ADR 005.
- **Guardar o trecho mascarado (`AKIA****`):** ajuda na triagem, mas mantém parte do segredo no banco. O nome do padrão e o `traceId` bastam para achar a requisição.
- **Depender só do Laya:** o modelo erra formatos fixos (§6.5) e perde corpos sob rajada (§8.6).
