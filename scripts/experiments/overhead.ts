/**
 * Experimento 3 — Overhead do RASP e latência de ingestão
 *
 * Mede p50/p95 de GET /health na demo-api (RASP analisa, não bloqueia)
 * e de POST /api/v1/ingest no backend.
 *
 * Uso: pnpm experiment:overhead
 */
const DEMO_API_URL = process.env.DEMO_API_URL ?? "http://localhost:4000";
const API_URL = process.env.API_URL ?? "http://localhost:3001";
const API_KEY = process.env.API_KEY;
const SAMPLES = 80;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1
  );
  return sorted[index] ?? 0;
}

async function timeRequest(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

async function measure(
  label: string,
  fn: () => Promise<void>
): Promise<number[]> {
  const samples: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    samples.push(await timeRequest(fn));
  }
  samples.sort((a, b) => a - b);
  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;

  console.log(`| ${label} | ${avg.toFixed(1)} | ${p50.toFixed(1)} | ${p95.toFixed(1)} |`);
  return samples;
}

async function assertReachable(url: string, hint: string): Promise<void> {
  try {
    await fetch(url);
  } catch {
    throw new Error(`${url} recusou conexão. ${hint}`);
  }
}

async function main(): Promise<void> {
  await assertReachable(
    `${DEMO_API_URL}/health`,
    "Suba a demo-api com: pnpm dev:demo-api"
  );
  await assertReachable(
    `${API_URL}/health`,
    "Suba o backend com: pnpm dev:backend"
  );

  console.log("## Experimento 3 — Overhead\n");
  console.log(`Amostras: ${SAMPLES}`);
  console.log(`demo-api: ${DEMO_API_URL}`);
  console.log(`backend: ${API_URL}\n`);
  console.log("| Alvo | média (ms) | p50 (ms) | p95 (ms) |");
  console.log("|---|---:|---:|---:|");

  await measure("GET /health (RASP analisa)", async () => {
    const res = await fetch(`${DEMO_API_URL}/health`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0",
      },
    });
    if (!res.ok) throw new Error(`health HTTP ${res.status}`);
  });

  await measure("POST /api/v1/ingest", async () => {
    const res = await fetch(`${API_URL}/api/v1/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { "x-api-key": API_KEY } : {}),
      },
      body: JSON.stringify([
        {
          traceId: "c".repeat(32),
          spanId: "d".repeat(16),
          service: "experiment-overhead",
          level: "info",
          message: "overhead sample",
          timestamp: new Date().toISOString(),
        },
      ]),
    });
    if (res.status !== 202) throw new Error(`ingest HTTP ${res.status}`);
  });

  console.log(
    "\nDocumente o hardware (CPU/RAM) na monografia. O p95 do ingest deve ficar abaixo de 500 ms (alvo do k6)."
  );
}

main().catch((error) => {
  console.error("[experiment:overhead]", error);
  process.exit(1);
});
