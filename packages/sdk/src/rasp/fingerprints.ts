import type { RaspThreatType } from "@traceguard/shared";
import type { IncomingRequestLike } from "./types.js";

/** Padrões de User-Agent associados a scrapers e bots conhecidos */
const BOT_UA_PATTERNS = [
  "python-requests",
  "scrapy",
  "curl/",
  "wget/",
  "headless",
  "httpclient",
  "go-http-client",
  "java/",
  "libwww",
  "bot",
  "spider",
  "crawler",
];

/** Headers típicos de navegadores reais em rotas de API/browser-like */
const BROWSER_HEADERS = ["accept-language", "accept"];

/** Crawlers de busca que não devem ser tratados como scraper. */
const TRUSTED_CRAWLERS = [
  "googlebot",
  "bingbot",
  "slurp",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "applebot",
];

export function isTrustedCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const lower = userAgent.toLowerCase();
  return TRUSTED_CRAWLERS.some((name) => lower.includes(name));
}

export function detectBotUserAgent(
  userAgent: string | undefined
): RaspThreatType | null {
  if (!userAgent) return null;
  if (isTrustedCrawler(userAgent)) return null;
  const lower = userAgent.toLowerCase();
  for (const pattern of BOT_UA_PATTERNS) {
    if (lower.includes(pattern)) return "bot_user_agent";
  }
  return null;
}

export function detectMissingHeaders(
  req: IncomingRequestLike
): RaspThreatType | null {
  const path = req.path.toLowerCase();
  const isBrowserLike =
    path.startsWith("/api/") ||
    path.startsWith("/products") ||
    path.endsWith(".html");

  if (!isBrowserLike) return null;

  for (const header of BROWSER_HEADERS) {
    const value = req.headers[header];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      return "missing_headers";
    }
  }
  return null;
}

export function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}
