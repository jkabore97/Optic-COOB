import { describe, expect, it } from "vitest";
import { formatPhoneInternational, formatPhoneLocal, normalizeBurkinaPhone } from "../src/lib/phone";

describe("normalizeBurkinaPhone", () => {
  it("accepte les formats courants", () => {
    expect(normalizeBurkinaPhone("70 12 34 56")).toBe("+22670123456");
    expect(normalizeBurkinaPhone("70123456")).toBe("+22670123456");
    expect(normalizeBurkinaPhone("+226 70 12 34 56")).toBe("+22670123456");
    expect(normalizeBurkinaPhone("0022670123456")).toBe("+22670123456");
    expect(normalizeBurkinaPhone("22670123456")).toBe("+22670123456");
    expect(normalizeBurkinaPhone("25 30 70 28")).toBe("+22625307028");
  });
  it("rejette les numéros invalides", () => {
    expect(normalizeBurkinaPhone("")).toBeNull();
    expect(normalizeBurkinaPhone("7012345")).toBeNull();
    expect(normalizeBurkinaPhone("701234567")).toBeNull();
    expect(normalizeBurkinaPhone("+33612345678")).toBeNull();
    expect(normalizeBurkinaPhone("abc")).toBeNull();
    expect(normalizeBurkinaPhone("90123456")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("formate en local et international", () => {
    expect(formatPhoneLocal("+22670123456")).toBe("70 12 34 56");
    expect(formatPhoneInternational("+22670123456")).toBe("+226 70 12 34 56");
  });
});
