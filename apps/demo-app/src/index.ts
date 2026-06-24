import http from "node:http";
import https from "node:https";
import { getContext, init, shutdown, withTraceAsync } from "@traceguard/sdk";

const ENDPOINT =
  process.env.TRACEGUARD_ENDPOINT ?? "http://localhost:3001/api/v1/ingest";
const SERVICE_NAME = process.env.TRACEGUARD_SERVICE_NAME ?? "demo-app";
const STRESS_MODE = process.argv.includes("--stress-errors");

function httpGet(url: string): Promise<string> {
  const client = url.startsWith("https") ? https : http;

  return new Promise((resolve, reject) => {
    client
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

async function runChainedRequests(): Promise<void> {
  await withTraceAsync(async () => {
    const rootTraceId = getContext()?.traceId;
    console.log(`\n[demo] Trace root iniciado: ${rootTraceId}\n`);

    const urls = [
      "https://jsonplaceholder.typicode.com/posts/1",
      "https://jsonplaceholder.typicode.com/users/1",
      "https://jsonplaceholder.typicode.com/comments/1",
    ];

    for (let i = 0; i < urls.length; i++) {
      const ctxBefore = getContext();
      console.log(`[demo] Request ${i + 1} — traceId: ${ctxBefore?.traceId}`);

      const body = await httpGet(urls[i]);
      const preview = body.slice(0, 60).replace(/\n/g, " ");
      console.log(`[demo] Response ${i + 1}: ${preview}...`);
    }

    console.log(`\n[demo] Sucesso: 3 requests compartilharam traceId=${rootTraceId}`);
  });
}

/** Gera erros HTTP em rajada para testar regras de alerta (Fase 3). */
async function runStressErrors(): Promise<void> {
  console.log("\n[demo] Modo stress-errors: gerando falhas HTTP...\n");

  await withTraceAsync(async () => {
    const traceId = getContext()?.traceId;
    const badUrl = "http://localhost:59999/unreachable";

    for (let i = 0; i < 15; i++) {
      try {
        await httpGet(badUrl);
      } catch {
        console.log(`[demo] Erro ${i + 1}/15 gerado (traceId=${traceId})`);
      }
    }
  });
}

async function main(): Promise<void> {
  init({
    serviceName: SERVICE_NAME,
    endpoint: ENDPOINT,
    flushIntervalMs: 2000,
  });

  try {
    if (STRESS_MODE) {
      await runStressErrors();
    } else {
      await runChainedRequests();
    }

    console.log("\n[demo] Aguardando exportação de telemetria...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } finally {
    await shutdown();
  }
}

main().catch((error) => {
  console.error("[demo] Erro:", error);
  process.exit(1);
});
