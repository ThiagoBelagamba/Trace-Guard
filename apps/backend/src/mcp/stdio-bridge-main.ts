import { createInterface } from "node:readline";
import { forwardMessage, type McpPost } from "./stdio-bridge.js";

const url = process.env.TRACEGUARD_MCP_URL ?? "http://localhost:3001/api/v1/mcp";
const apiKey = process.env.TRACEGUARD_API_KEY;

const post: McpPost = async (body) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiKey) headers["x-api-key"] = apiKey;

  const response = await fetch(url, { method: "POST", headers, body });
  return { status: response.status, text: await response.text() };
};

function log(message: string): void {
  process.stderr.write(`[traceguard-mcp-stdio] ${message}\n`);
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

// Processa as linhas em ordem, uma de cada vez, para preservar a ordem das respostas.
let queue: Promise<void> = Promise.resolve();

rl.on("line", (line) => {
  queue = queue.then(async () => {
    try {
      const out = await forwardMessage(line, post);
      if (out !== null) process.stdout.write(`${out}\n`);
    } catch (err) {
      log(`erro inesperado: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
});

rl.on("close", () => {
  void queue.then(() => process.exit(0));
});

log(`ponte stdio ativa, encaminhando para ${url}`);
