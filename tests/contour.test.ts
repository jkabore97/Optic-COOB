import { describe, expect, it } from "vitest";
import { buildRegions, pointInPolygon, signedArea, simplify, traceContours } from "../src/lib/contour";

/** Masque : un anneau (carré plein 20×20 avec un trou 8×8 au centre). */
function ring(w = 30, h = 30): Uint8Array {
  const m = new Uint8Array(w * h);
  for (let y = 5; y < 25; y++) for (let x = 5; x < 25; x++) m[y * w + x] = 1;
  for (let y = 11; y < 19; y++) for (let x = 11; x < 19; x++) m[y * w + x] = 0;
  return m;
}

describe("contour", () => {
  it("trace un contour extérieur et un trou pour un anneau", () => {
    const loops = traceContours(ring(), 30, 30);
    expect(loops.length).toBe(2);
    const regions = buildRegions(loops);
    expect(regions.length).toBe(1);
    expect(regions[0].holes.length).toBe(1);
    expect(Math.abs(signedArea(regions[0].outer))).toBeGreaterThan(Math.abs(signedArea(regions[0].holes[0])));
    // Le trou est bien à l'intérieur de l'extérieur
    expect(pointInPolygon(regions[0].holes[0][0], regions[0].outer)).toBe(true);
  });

  it("simplifie un carré échantillonné en peu de sommets", () => {
    const loops = traceContours(ring(), 30, 30);
    const outer = buildRegions(loops)[0].outer;
    const simple = simplify(outer, 0.8);
    expect(simple.length).toBeLessThan(outer.length);
    expect(simple.length).toBeGreaterThanOrEqual(4);
    // Les coins sont légèrement rognés par la simplification : aire conservée à quelques % près
    expect(Math.abs(signedArea(simple)) / Math.abs(signedArea(outer))).toBeGreaterThan(0.92);
  });

  it("gère deux régions séparées", () => {
    const w = 40, h = 20, m = new Uint8Array(w * h);
    for (let y = 4; y < 16; y++) for (let x = 3; x < 15; x++) m[y * w + x] = 1;
    for (let y = 4; y < 16; y++) for (let x = 25; x < 37; x++) m[y * w + x] = 1;
    const regions = buildRegions(traceContours(m, w, h));
    expect(regions.length).toBe(2);
    expect(regions.every((r) => r.holes.length === 0)).toBe(true);
  });
});
