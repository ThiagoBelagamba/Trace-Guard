import { describe, expect, it } from "vitest";
import { forwardMessage, type McpPost } from "./stdio-bridge.js";

const ping = '{"jsonrpc":"2.0","id":7,"method":"ping"}';

describe("forwardMessage", () => {
  it("ignores empty lines", async () => {
    const post: McpPost = async () => ({ status: 200, text: "x" });
    expect(await forwardMessage("", post)).toBeNull();
    expect(await forwardMessage("   ", post)).toBeNull();
  });

  it("answers invalid JSON with a parse error", async () => {
    const post: McpPost = async () => ({ status: 200, text: "x" });
    const out = await forwardMessage("{oops", post);
    expect(out).toContain("-32700");
    expect(JSON.parse(out!)).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  });

  it("writes nothing for notifications answered with 202", async () => {
    const post: McpPost = async () => ({ status: 202, text: "" });
    const out = await forwardMessage(
      '{"jsonrpc":"2.0","method":"notifications/initialized"}',
      post
    );
    expect(out).toBeNull();
  });

  it("maps non-2xx statuses to a JSON-RPC error carrying the request id", async () => {
    const post: McpPost = async () => ({ status: 500, text: "boom" });
    const parsed = JSON.parse((await forwardMessage(ping, post))!);
    expect(parsed.id).toBe(7);
    expect(parsed.error.code).toBe(-32603);
    expect(parsed.error.message).toBe("Backend respondeu HTTP 500");
  });

  it("re-serializes a pretty-printed backend body into a single line", async () => {
    const post: McpPost = async () => ({
      status: 200,
      text: '{\n  "jsonrpc": "2.0",\n  "id": 7,\n  "result": {}\n}',
    });
    expect(await forwardMessage(ping, post)).toBe(
      '{"jsonrpc":"2.0","id":7,"result":{}}'
    );
  });

  it("turns a non-JSON 200 body into a JSON-RPC error", async () => {
    const post: McpPost = async () => ({
      status: 200,
      text: "<html>proxy</html>",
    });
    expect(JSON.parse((await forwardMessage(ping, post))!)).toEqual({
      jsonrpc: "2.0",
      id: 7,
      error: {
        code: -32603,
        message: "Backend devolveu resposta que não é JSON",
      },
    });
  });

  it("explains how to fix a 401", async () => {
    const post: McpPost = async () => ({ status: 401, text: "{}" });
    expect(JSON.parse((await forwardMessage(ping, post))!).error.message).toBe(
      "Backend respondeu HTTP 401: defina TRACEGUARD_API_KEY com o valor de API_KEY do backend"
    );
  });

  it("keeps answering when the backend is down", async () => {
    const post: McpPost = async () => {
      throw new Error("ECONNREFUSED");
    };
    const first = JSON.parse((await forwardMessage(ping, post))!);
    expect(first.error.message).toContain("ECONNREFUSED");
    expect(first.error.message).toContain("Backend indisponível");
    const second = JSON.parse((await forwardMessage(ping, post))!);
    expect(second.id).toBe(7);
    expect(second.error.code).toBe(-32603);
  });

  it("returns the backend body untouched on success", async () => {
    const body = '{"jsonrpc":"2.0","id":7,"result":{}}';
    const post: McpPost = async () => ({ status: 200, text: body });
    expect(await forwardMessage(ping, post)).toBe(body);
  });
});
