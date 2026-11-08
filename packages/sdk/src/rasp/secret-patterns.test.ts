import { describe, expect, it } from "vitest";
import { detectSecretPatterns } from "./secret-patterns.js";

// Prefixos montados por concatenação, como no dataset, para não parecerem credenciais reais.
const AWS = "AK" + "IA";
const GH = "gh" + "p_";

describe("detectSecretPatterns", () => {
  it("finds an AWS access key id", () => {
    expect(detectSecretPatterns(`key=${AWS}IOSFODNN7EXAMPLE end`)).toEqual(["aws_access_key"]);
  });

  it("ignores a truncated AWS prefix", () => {
    expect(detectSecretPatterns("AKIA123")).toEqual([]);
  });

  it("finds a GitHub token", () => {
    expect(detectSecretPatterns(`token ${GH}${"a".repeat(36)}`)).toEqual(["github_token"]);
  });

  it("finds credentials inside a URL", () => {
    expect(detectSecretPatterns("postgres://admin:SenhaForte@db:5432/x")).toEqual(["url_credentials"]);
  });

  it("does not take a plain URL for credentials", () => {
    expect(detectSecretPatterns("veja https://loja.com/pedidos?id=1 e user@mail.com")).toEqual([]);
  });

  it("finds a private key block", () => {
    expect(detectSecretPatterns("-----BEGIN RSA PRIVATE KEY-----\nabc")).toEqual(["private_key_block"]);
  });

  it("lists each pattern once, in the declared order", () => {
    const text = `-----BEGIN PRIVATE KEY----- ${AWS}IOSFODNN7EXAMPLE ${AWS}I44QH8DHBEXAMPLE`;
    expect(detectSecretPatterns(text)).toEqual(["aws_access_key", "private_key_block"]);
  });
});
