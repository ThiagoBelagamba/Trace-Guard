import { describe, expect, it } from "vitest";
import { detectBotUserAgent, detectMissingHeaders } from "./fingerprints.js";

describe("detectBotUserAgent", () => {
  it("flags known scraper user agents", () => {
    expect(detectBotUserAgent("python-requests/2.31.0")).toBe("bot_user_agent");
    expect(detectBotUserAgent("curl/8.5.0")).toBe("bot_user_agent");
  });

  it("does not flag a browser user agent", () => {
    expect(
      detectBotUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0"
      )
    ).toBeNull();
  });

  it("does not flag trusted search crawlers", () => {
    expect(
      detectBotUserAgent(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
      )
    ).toBeNull();
    expect(
      detectBotUserAgent("Mozilla/5.0 (compatible; bingbot/2.0)")
    ).toBeNull();
  });
});

describe("detectMissingHeaders", () => {
  it("flags API requests missing accept-language", () => {
    expect(
      detectMissingHeaders({
        method: "GET",
        path: "/api/products/1",
        headers: { accept: "application/json" },
      })
    ).toBe("missing_headers");
  });

  it("does not flag health checks outside browser-like routes", () => {
    expect(
      detectMissingHeaders({
        method: "GET",
        path: "/health",
        headers: {},
      })
    ).toBeNull();
  });
});
