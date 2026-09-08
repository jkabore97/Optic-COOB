import { describe, expect, it } from "vitest";
import { bounds, lensOutline } from "../src/lib/lens-outline";
import type { FrameShape } from "../src/lib/frames";

const SHAPES: FrameShape[] = ["rond", "ovale", "rectangle", "carre", "wayfarer", "papillon", "aviateur", "browline"];

describe("lensOutline", () => {
  it("produit un contour fermé et plausible pour chaque forme", () => {
    for (const shape of SHAPES) {
      const pts = lensOutline(shape);
      expect(pts.length, shape).toBeGreaterThan(40);
      const b = bounds(pts);
      // Largeur d'un verre entre ~200 et ~290 unités SVG, hauteur entre ~150 et ~260
      expect(b.maxX - b.minX, shape).toBeGreaterThan(200);
      expect(b.maxX - b.minX, shape).toBeLessThan(290);
      expect(b.maxY - b.minY, shape).toBeGreaterThan(120);
      expect(b.maxY - b.minY, shape).toBeLessThan(260);
      // Centré autour de l'origine (le verre ne déborde pas sur l'autre)
      expect(b.maxX, shape).toBeLessThan(150);
      expect(b.minX, shape).toBeGreaterThan(-150);
      for (const p of pts) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });
});
