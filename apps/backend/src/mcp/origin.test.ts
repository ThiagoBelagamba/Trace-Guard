import { describe, expect, it } from "vitest";
import { isMcpOriginAllowed } from "./origin.js";

describe("isMcpOriginAllowed", () => {
  it("allows requests without Origin", () => {
    expect(isMcpOriginAllowed(undefined, "http://a")).toBe(true);
  });

  it("allows any origin when CORS_ORIGIN is not configured", () => {
    expect(isMcpOriginAllowed("http://evil", undefined)).toBe(true);
  });

  it("rejects origins outside the configured list", () => {
    expect(isMcpOriginAllowed("http://evil", "http://a, http://b")).toBe(false);
  });

  it("accepts origins inside the configured list", () => {
    expect(isMcpOriginAllowed("http://b", "http://a, http://b")).toBe(true);
  });

  it("allows any origin when the list contains '*'", () => {
    expect(isMcpOriginAllowed("http://evil.example", "*")).toBe(true);
    expect(isMcpOriginAllowed("http://x", "http://a.com, *")).toBe(true);
  });

  it("ignores a trailing slash and letter case", () => {
    expect(isMcpOriginAllowed("http://a.com", "http://a.com/")).toBe(true);
    expect(isMcpOriginAllowed("HTTP://A.com", "http://a.com")).toBe(true);
  });
});
