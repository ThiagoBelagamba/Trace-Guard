import http from "k6/http";
import { check, sleep } from "k6";

const DEMO_API = __ENV.DEMO_API_URL || "http://localhost:4000";

export const options = {
  vus: 20,
  duration: "30s",
};

export default function () {
  const id = Math.floor(Math.random() * 50) + 1;
  const res = http.get(`${DEMO_API}/api/products/${id}`, {
    headers: { "User-Agent": "python-requests/2.31.0" },
  });

  check(res, {
    "blocked or ok": (r) => r.status === 200 || r.status === 403,
  });
  sleep(0.2);
}
