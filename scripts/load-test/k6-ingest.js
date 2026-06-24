import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.API_URL || "http://localhost:3001";

export const options = {
  vus: 100,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const payload = JSON.stringify([
    {
      traceId: "a".repeat(32),
      spanId: "b".repeat(16),
      service: "load-test",
      level: "info",
      message: "k6 load test event",
      timestamp: new Date().toISOString(),
    },
  ]);

  const res = http.post(`${BASE_URL}/api/v1/ingest`, payload, {
    headers: { "Content-Type": "application/json" },
  });

  check(res, { "status is 202": (r) => r.status === 202 });
  sleep(0.1);
}
