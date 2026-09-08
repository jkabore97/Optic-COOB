import { describe, expect, it } from "vitest";
import { defaultAnchors, eyePose, placeOverlay, placementToCss, smoothPose } from "../src/lib/tryon-math";
import { slugify } from "../src/lib/slug";

const image = { width: 1000, height: 400, anchorL: { x: 290, y: 200 }, anchorR: { x: 710, y: 200 } };

describe("tryon-math", () => {
  it("ordonne les pupilles et mesure l'angle et la distance", () => {
    const p = eyePose({ x: 400, y: 210 }, { x: 200, y: 200 });
    expect(p.mid).toEqual({ x: 300, y: 205 });
    expect(p.dist).toBeCloseTo(Math.hypot(200, 10));
    expect(p.angle).toBeCloseTo(Math.atan2(10, 200));
  });

  it("place les ancres du visuel sur les pupilles", () => {
    const pose = eyePose({ x: 200, y: 300 }, { x: 410, y: 300 }); // écart 210 px
    const pl = placeOverlay(pose, image);
    expect(pl.scale).toBeCloseTo(0.5); // 420 px d'ancres → 210 px
    expect(pl.rotation).toBeCloseTo(0);
    expect(pl.tx).toBe(305);
    expect(pl.ox).toBe(500);
    expect(pl.oy).toBe(200);
    // Vérification : l'ancre gauche projetée tombe sur la pupille gauche
    const projected = { x: pl.tx + (image.anchorL.x - pl.ox) * pl.scale, y: pl.ty + (image.anchorL.y - pl.oy) * pl.scale };
    expect(projected).toEqual({ x: 200, y: 300 });
    expect(placementToCss(pl)).toContain("translate(305px, 300px)");
  });

  it("gère des ancres inclinées et le réglage de hauteur", () => {
    const tilted = { ...image, anchorL: { x: 290, y: 180 }, anchorR: { x: 710, y: 220 } };
    const pose = eyePose({ x: 100, y: 100 }, { x: 520, y: 100 });
    const pl = placeOverlay(pose, tilted, 1, 20);
    expect(pl.rotation).toBeCloseTo(-Math.atan2(40, 420));
    expect(pl.oy).toBe(180);
  });

  it("lisse les poses", () => {
    const a = eyePose({ x: 0, y: 0 }, { x: 100, y: 0 });
    const b = eyePose({ x: 100, y: 0 }, { x: 200, y: 0 });
    expect(smoothPose(null, b)).toEqual(b);
    expect(smoothPose(a, b, 0.5).mid.x).toBe(100);
  });

  it("propose des ancres par défaut", () => {
    expect(defaultAnchors(1000, 500)).toEqual({ anchorL: { x: 300, y: 250 }, anchorR: { x: 700, y: 250 } });
  });
});

describe("slugify", () => {
  it("normalise les accents et les espaces", () => {
    expect(slugify("Kadiogo Écaille")).toBe("kadiogo-ecaille");
    expect(slugify("  Ray-Ban RB5154 / Noir ")).toBe("ray-ban-rb5154-noir");
  });
});
