import { afterEach, describe, expect, it } from "vitest";
import { checkPassword, createSessionToken, verifySessionToken } from "../src/lib/auth";

afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
});

describe("auth", () => {
  it("signe et vérifie un jeton de session", () => {
    process.env.ADMIN_PASSWORD = "secret";
    const token = createSessionToken(1_000_000);
    expect(verifySessionToken(token, 1_000_000)).toBe(true);
    expect(verifySessionToken(token, 1_000_000 + 15 * 24 * 3600 * 1000)).toBe(false);
    expect(verifySessionToken(token + "x", 1_000_000)).toBe(false);
    expect(verifySessionToken(undefined)).toBe(false);
  });
  it("vérifie le mot de passe", () => {
    process.env.ADMIN_PASSWORD = "secret";
    expect(checkPassword("secret")).toBe(true);
    expect(checkPassword("Secret")).toBe(false);
    delete process.env.ADMIN_PASSWORD;
    expect(checkPassword("secret")).toBe(false);
  });
});
