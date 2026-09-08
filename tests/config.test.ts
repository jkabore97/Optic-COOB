import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("BUSINESS.siteUrl", () => {
  it("ignore une variable vide ou invalide et retombe sur un défaut valide", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    const { BUSINESS } = await import("../src/lib/config");
    expect(() => new URL(BUSINESS.siteUrl)).not.toThrow();
    expect(BUSINESS.siteUrl).toBe("https://coob-optique.bf");
  });
  it("utilise l'URL fournie par l'hébergeur si NEXT_PUBLIC_SITE_URL est absente", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "optic-coob.vercel.app");
    const { BUSINESS } = await import("../src/lib/config");
    expect(BUSINESS.siteUrl).toBe("https://optic-coob.vercel.app");
  });
});
