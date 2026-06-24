/**
 * Simula um scraper agressivo: UA de bot, alta taxa de requisições e varredura sequencial.
 * Uso: pnpm demo:scrape
 */
const BASE_URL = process.env.DEMO_API_URL ?? "http://localhost:4000";
const TOTAL = parseInt(process.env.SCRAPE_COUNT ?? "50", 10);
const DELAY_MS = parseInt(process.env.SCRAPE_DELAY_MS ?? "100", 10);

async function scrape(): Promise<void> {
  console.log(`[scraper-sim] Alvo: ${BASE_URL} — ${TOTAL} requisições`);
  let blocked = 0;
  let ok = 0;
  let errors = 0;

  for (let i = 1; i <= TOTAL; i++) {
    const url = `${BASE_URL}/api/products/${i}`;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "python-requests/2.31.0",
        },
      });
      if (res.status === 403) {
        blocked++;
        const body = (await res.json()) as { threatType?: string; traceId?: string };
        console.log(
          `  [${i}] 403 BLOCKED — ${body.threatType ?? "?"} trace=${body.traceId?.slice(0, 8) ?? "?"}`
        );
      } else if (res.ok) {
        ok++;
        console.log(`  [${i}] ${res.status} OK`);
      } else {
        errors++;
        console.log(`  [${i}] ${res.status}`);
      }
    } catch (err) {
      errors++;
      console.error(`  [${i}] ERRO:`, err);
    }

    if (DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log("\n[scraper-sim] Resumo:");
  console.log(`  Bloqueados (403): ${blocked}`);
  console.log(`  Sucesso (2xx):    ${ok}`);
  console.log(`  Outros erros:     ${errors}`);
}

scrape().catch((err) => {
  console.error("[scraper-sim] Falha:", err);
  process.exit(1);
});
