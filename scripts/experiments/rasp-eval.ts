/**
 * Experimento 2 — Precisão e recall do RASP
 *
 * Dataset rotulado contra a demo-api. Requer demo-api com RASP em modo block.
 * Usa http.request (não fetch) para não injetar Accept-Language automático do Node.
 *
 * Uso: pnpm experiment:rasp
 */
import http from "node:http";
import { computeClassificationMetrics } from "../../packages/shared/src/metrics.ts";

const DEMO_API_URL = process.env.DEMO_API_URL ?? "http://localhost:4000";

interface CaseSpec {
  name: string;
  expectedThreat: boolean;
  path: string;
  headers: Record<string, string>;
}

const CASES: CaseSpec[] = [
  {
    name: "browser_legitimo",
    expectedThreat: false,
    path: "/api/products",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0",
      Accept: "application/json",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
  },
  {
    name: "healthcheck_curl",
    expectedThreat: false,
    path: "/health",
    headers: { "User-Agent": "curl/8.5.0" },
  },
  {
    name: "scraper_python",
    expectedThreat: true,
    path: "/api/products/1",
    headers: { "User-Agent": "python-requests/2.31.0" },
  },
  {
    name: "scraper_scrapy",
    expectedThreat: true,
    path: "/api/products/2",
    headers: { "User-Agent": "Scrapy/2.11.0" },
  },
  {
    name: "crawler_googlebot",
    expectedThreat: false,
    path: "/api/products",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      Accept: "text/html",
      "Accept-Language": "en",
    },
  },
];

function runCase(spec: CaseSpec): Promise<boolean> {
  const url = new URL(spec.path, DEMO_API_URL);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: "GET",
        headers: spec.headers,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 403);
      }
    );
    req.on("error", (error) => {
      reject(
        new Error(
          `demo-api inacessível em ${DEMO_API_URL} (${error.message}). Suba com: pnpm dev:demo-api`
        )
      );
    });
    req.end();
  });
}

async function main(): Promise<void> {
  const results = [];

  for (const spec of CASES) {
    const detected = await runCase(spec);
    results.push({
      name: spec.name,
      expectedThreat: spec.expectedThreat,
      detected,
    });
  }

  const metrics = computeClassificationMetrics(results);

  console.log("## Experimento 2 — Precisão e recall do RASP\n");
  console.log(`API: ${DEMO_API_URL}\n`);
  console.log("| Caso | Esperado | Detectado |");
  console.log("|---|---|---|");
  for (const row of results) {
    const expected = row.expectedThreat ? "ameaça" : "legítimo";
    const detected = row.detected ? "bloqueado" : "permitido";
    console.log(`| ${row.name} | ${expected} | ${detected} |`);
  }

  console.log("\n| Métrica | Valor |");
  console.log("|---|---:|");
  console.log(`| TP | ${metrics.tp} |`);
  console.log(`| FP | ${metrics.fp} |`);
  console.log(`| FN | ${metrics.fn} |`);
  console.log(`| TN | ${metrics.tn} |`);
  console.log(`| Precisão | ${metrics.precision.toFixed(3)} |`);
  console.log(`| Recall | ${metrics.recall.toFixed(3)} |`);
  console.log(`| F1 | ${metrics.f1.toFixed(3)} |`);
  console.log(`| Youden | ${metrics.youden.toFixed(3)} |`);
}

main().catch((error) => {
  console.error("[experiment:rasp]", error);
  process.exit(1);
});
