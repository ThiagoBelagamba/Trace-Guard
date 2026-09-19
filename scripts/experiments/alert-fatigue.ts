/**
 * Experimento 1 — Fadiga de alertas
 *
 * Compara o número de eventos de erro ingeridos com alertas acionáveis
 * vs. suprimidos pelo cooldown. Requer backend + Postgres + RabbitMQ.
 *
 * Uso: pnpm experiment:fatigue
 */
const API_URL = process.env.API_URL ?? "http://localhost:3001";
const API_KEY = process.env.API_KEY;

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...extra,
    ...(API_KEY ? { "x-api-key": API_KEY } : {}),
  };
}

interface AlertStats {
  fired: number;
  suppressed: number;
  suppressionRate: number;
}

async function ingestErrors(count: number, burst: string): Promise<void> {
  const events = Array.from({ length: count }, (_, index) => ({
    traceId: burst.replace(/-/g, "").slice(0, 32).padEnd(32, "a"),
    spanId: index.toString(16).padStart(16, "0"),
    service: "experiment-fatigue",
    level: "error" as const,
    message: `erro experimental ${burst} #${index + 1}`,
    timestamp: new Date().toISOString(),
  }));

  const res = await fetch(`${API_URL}/api/v1/ingest`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(events),
  });

  if (!res.ok) {
    throw new Error(`Ingest falhou: HTTP ${res.status} ${await res.text()}`);
  }
}

async function fetchStats(): Promise<AlertStats> {
  const res = await fetch(`${API_URL}/api/v1/alerts/stats`, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Stats falhou: HTTP ${res.status}`);
  }
  return (await res.json()) as AlertStats;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const before = await fetchStats();
  const stamp = Date.now().toString(16);

  await ingestErrors(100, `${stamp}aaaa`);
  await wait(3000);
  const afterFirst = await fetchStats();

  await ingestErrors(50, `${stamp}bbbb`);
  await wait(3000);
  const afterSecond = await fetchStats();

  const fired = afterSecond.fired - before.fired;
  const suppressed = afterSecond.suppressed - before.suppressed;
  const naiveNotifications = 150;
  const suppressionRate =
    fired + suppressed === 0 ? 0 : suppressed / (fired + suppressed);

  console.log("## Experimento 1 — Fadiga de alertas\n");
  console.log(`API: ${API_URL}`);
  console.log(`Baseline naive: ${naiveNotifications} notificações (1 por erro)\n`);
  console.log("| Etapa | Fired | Suprimidos | Taxa |");
  console.log("|---|---:|---:|---:|");
  console.log(
    `| Antes | ${before.fired} | ${before.suppressed} | ${before.suppressionRate.toFixed(1)}% |`
  );
  console.log(
    `| Após 100 erros | ${afterFirst.fired} | ${afterFirst.suppressed} | ${afterFirst.suppressionRate.toFixed(1)}% |`
  );
  console.log(
    `| Após +50 erros (cooldown) | ${afterSecond.fired} | ${afterSecond.suppressed} | ${afterSecond.suppressionRate.toFixed(1)}% |`
  );
  console.log(
    `\nDelta desta execução: ${fired} acionável(is), ${suppressed} suprimido(s), taxa ${(suppressionRate * 100).toFixed(1)}%.`
  );
  console.log(
    "Interpretação: o motor agrega a janela (não cria 1 alerta por log). A segunda rajada deve ser suprimida pelo cooldown."
  );
}

main().catch((error) => {
  console.error("[experiment:fatigue]", error);
  process.exit(1);
});
