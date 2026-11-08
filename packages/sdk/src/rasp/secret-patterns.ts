/**
 * Formatos de credencial com prefixo ou estrutura fixa (R10, ADR 010). O
 * Laya erra justamente nesses casos (relatório do Experimento 4, §6.5 e §8),
 * e uma regex os reconhece sem custo de modelo.
 *
 * Só o nome do padrão sai daqui: o trecho casado é o segredo e nunca pode ir
 * para o evento.
 */
export type SecretPatternName = "aws_access_key" | "github_token" | "url_credentials" | "private_key_block";

const SECRET_PATTERNS: readonly (readonly [SecretPatternName, RegExp])[] = [
  ["aws_access_key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["github_token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  // Esquema ancorado no início da palavra e partes limitadas: sem isso, um
  // corpo de 8 KB montado de propósito leva ~50 ms (a busca é quadrática)
  // e trava o event loop.
  ["url_credentials", /(?<![a-z0-9+.-])[a-z][a-z0-9+.-]{0,31}:\/\/[^\s:@/]{1,256}:[^\s@/]{1,256}@/i],
  ["private_key_block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

/** Padrões presentes no texto, sem repetição, na ordem de `SecretPatternName`. */
export function detectSecretPatterns(text: string): SecretPatternName[] {
  return SECRET_PATTERNS.filter(([, regex]) => regex.test(text)).map(([name]) => name);
}
