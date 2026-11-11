import { describe, expect, it } from "vitest";
import { toMcpParseError } from "./http-errors.js";

const PARSE_ERROR = {
  jsonrpc: "2.0",
  id: null,
  error: { code: -32700, message: "Parse error" },
};

describe("toMcpParseError", () => {
  it("maps a SyntaxError to -32700", () => {
    expect(toMcpParseError(new SyntaxError("Unexpected token"))).toEqual(
      PARSE_ERROR
    );
  });

  it("maps Fastify invalid and empty JSON body errors to -32700", () => {
    expect(
      toMcpParseError({ code: "FST_ERR_CTP_EMPTY_JSON_BODY" })
    ).toEqual(PARSE_ERROR);
    expect(
      toMcpParseError({ code: "FST_ERR_CTP_INVALID_JSON_BODY" })
    ).toEqual(PARSE_ERROR);
  });

  it("does not handle oversized bodies", () => {
    expect(toMcpParseError({ code: "FST_ERR_CTP_BODY_TOO_LARGE" })).toBeNull();
  });

  it("does not handle unrelated errors", () => {
    expect(toMcpParseError(new Error("x"))).toBeNull();
    expect(toMcpParseError(null)).toBeNull();
  });
});
