import express from "express";
import { init } from "@traceguard/sdk";
import { raspMiddleware } from "@traceguard/sdk/express";
import { routes } from "./routes.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const BACKEND = process.env.TRACEGUARD_ENDPOINT ?? "http://localhost:3001/api/v1/ingest";

init({
  serviceName: "demo-api",
  endpoint: BACKEND,
  apiKey: process.env.TRACEGUARD_API_KEY,
  rasp: {
    enabled: true,
    mode: (process.env.RASP_MODE as "monitor" | "block") ?? "block",
    maxRequestsPerMinute: 60,
    blockThreshold: 70,
    sequentialScanThreshold: 20,
    redisUrl: process.env.REDIS_URL,
  },
});

const app = express();
app.set("trust proxy", true);
app.use(express.json());
app.use(raspMiddleware());
app.use(routes);

app.listen(PORT, () => {
  console.log(`[demo-api] Rodando em http://localhost:${PORT}`);
  console.log(`[demo-api] RASP ativo — telemetria → ${BACKEND}`);
});
