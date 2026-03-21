import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getCorsHeaders", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("sets Access-Control-Allow-Origin to SITE_URL", async () => {
    process.env.SITE_URL = "https://ugent2.vercel.app";
    vi.resetModules();
    const { getCorsHeaders } = await import("../convex/lib/cors");
    const headers = getCorsHeaders();
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://ugent2.vercel.app");
  });

  it("allows credentials", async () => {
    process.env.SITE_URL = "https://ugent2.vercel.app";
    vi.resetModules();
    const { getCorsHeaders } = await import("../convex/lib/cors");
    const headers = getCorsHeaders();
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("throws if SITE_URL is not set", async () => {
    delete process.env.SITE_URL;
    vi.resetModules();
    const { getCorsHeaders } = await import("../convex/lib/cors");
    expect(() => getCorsHeaders()).toThrow("SITE_URL env var is required for CORS.");
  });

  it("does not use wildcard origin", async () => {
    process.env.SITE_URL = "https://ugent2.vercel.app";
    vi.resetModules();
    const { getCorsHeaders } = await import("../convex/lib/cors");
    const headers = getCorsHeaders();
    expect(headers["Access-Control-Allow-Origin"]).not.toBe("*");
  });
});
