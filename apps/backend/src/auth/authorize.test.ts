import { describe, expect, it } from "vitest";
import { authorizeApiRequest } from "./authorize.js";

describe("authorizeApiRequest", () => {
  it("always allows health checks", () => {
    expect(
      authorizeApiRequest({
        path: "/health",
        apiKey: "secret",
        providedKey: undefined,
      })
    ).toBe("ok");
  });

  it("allows every route when no API key is configured", () => {
    expect(
      authorizeApiRequest({
        path: "/api/v1/ingest",
        apiKey: undefined,
        providedKey: undefined,
      })
    ).toBe("ok");
  });

  it("rejects ingest without the configured key", () => {
    expect(
      authorizeApiRequest({
        path: "/api/v1/ingest",
        apiKey: "secret",
        providedKey: undefined,
      })
    ).toBe("unauthorized");
  });

  it("accepts a matching x-api-key or Bearer token", () => {
    expect(
      authorizeApiRequest({
        path: "/api/v1/events",
        apiKey: "secret",
        providedKey: "secret",
      })
    ).toBe("ok");

    expect(
      authorizeApiRequest({
        path: "/api/v1/ws/events",
        apiKey: "secret",
        providedKey: undefined,
        wsToken: "secret",
      })
    ).toBe("ok");
  });
});
