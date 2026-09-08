import type { FrameShape } from "./frames";

/**
 * Contour d'un verre (gauche, centré en (0,0)) sous forme de polygone fermé,
 * dans le repère des visuels SVG (x vers la droite = vers le nez, y vers le bas).
 * Utilisé par la vue 3D ; le générateur SVG (scripts/generate-frames.mts) garde ses
 * propres tracés, équivalents.
 */

export interface Pt {
  x: number;
  y: number;
}

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Échantillonne une suite de segments cubiques (chaque segment = [c1, c2, fin]). */
function bezierPath(start: Pt, segments: [Pt, Pt, Pt][], perSegment = 12): Pt[] {
  const pts: Pt[] = [];
  let p0 = start;
  for (const [c1, c2, p3] of segments) {
    for (let i = 0; i < perSegment; i++) pts.push(cubic(p0, c1, c2, p3, i / perSegment));
    p0 = p3;
  }
  return pts;
}

function ellipse(rx: number, ry: number, n = 64): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: Math.cos(a) * rx, y: Math.sin(a) * ry };
  });
}

function roundedRect(hw: number, hh: number, r: number, perCorner = 10): Pt[] {
  const corners: [number, number, number][] = [
    [hw - r, -hh + r, -Math.PI / 2],
    [hw - r, hh - r, 0],
    [-hw + r, hh - r, Math.PI / 2],
    [-hw + r, -hh + r, Math.PI],
  ];
  const pts: Pt[] = [];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= perCorner; i++) {
      const a = a0 + (i / perCorner) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  }
  return pts;
}

const P = (x: number, y: number): Pt => ({ x, y });

export function lensOutline(shape: FrameShape): Pt[] {
  switch (shape) {
    case "rond":
      return ellipse(104, 104);
    case "ovale":
      return ellipse(118, 78);
    case "rectangle":
      return roundedRect(118, 70, 28);
    case "carre":
      return roundedRect(112, 92, 34);
    case "browline":
      return roundedRect(116, 74, 30);
    case "wayfarer":
      return bezierPath(P(-128, -76), [
        [P(-60, -92), P(40, -90), P(110, -70)],
        [P(128, -64), P(130, -50), P(126, -30)],
        [P(118, 20), P(105, 70), P(80, 84)],
        [P(40, 100), P(-60, 96), P(-100, 80)],
        [P(-122, 70), P(-132, 40), P(-134, 0)],
        [P(-136, -30), P(-136, -60), P(-128, -76)],
      ]);
    case "papillon":
      return bezierPath(P(-140, -70), [
        [P(-90, -70), P(-20, -60), P(115, -68)],
        [P(130, -66), P(128, -40), P(122, -14)],
        [P(112, 40), P(96, 76), P(60, 84)],
        [P(20, 92), P(-60, 88), P(-100, 70)],
        [P(-128, 58), P(-140, 20), P(-142, -20)],
        [P(-143, -45), P(-144, -66), P(-140, -70)],
      ]);
    case "aviateur":
      return bezierPath(P(-130, -70), [
        [P(-80, -100), P(60, -100), P(118, -74)],
        [P(134, -66), P(134, -40), P(128, -14)],
        [P(116, 50), P(90, 108), P(40, 122)],
        [P(-10, 136), P(-80, 124), P(-110, 90)],
        [P(-136, 60), P(-142, 0), P(-134, -50)],
        [P(-133, -62), P(-132, -68), P(-130, -70)],
      ]);
  }
}

/** Boîte englobante d'un contour. */
export function bounds(pts: Pt[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}
