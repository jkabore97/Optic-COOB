/**
 * Extraction de contours d'un masque binaire (marching squares), simplification et
 * classification contours extérieurs / trous. Fonctions pures, testées.
 */

export interface P {
  x: number;
  y: number;
}

/** Trace les contours fermés d'un masque (1 = plein) de taille w×h. Coordonnées en pixels. */
export function traceContours(mask: Uint8Array, w: number, h: number): P[][] {
  // Grille rembourrée pour fermer les contours touchant le bord
  const W = w + 2, H = h + 2;
  const g = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[(y + 1) * W + x + 1] = mask[y * w + x];
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : g[y * W + x]);

  // Segments par cellule (marching squares, sans interpolation : milieux d'arêtes)
  const segs = new Map<string, P[]>(); // clé = point de départ → [fin]
  const key = (p: P) => `${p.x},${p.y}`;
  const addSeg = (a: P, b: P) => {
    const list = segs.get(key(a));
    if (list) list.push(b);
    else segs.set(key(a), [b]);
  };
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const idx = (at(x, y) << 3) | (at(x + 1, y) << 2) | (at(x + 1, y + 1) << 1) | at(x, y + 1);
      if (idx === 0 || idx === 15) continue;
      const top = { x: x + 0.5, y }, right = { x: x + 1, y: y + 0.5 }, bottom = { x: x + 0.5, y: y + 1 }, left = { x, y: y + 0.5 };
      // Orientation : l'intérieur (plein) reste à droite du sens de parcours
      const table: Record<number, [P, P][]> = {
        1: [[bottom, left]], 2: [[right, bottom]], 3: [[right, left]], 4: [[top, right]],
        5: [[top, left], [bottom, right]], 6: [[top, bottom]], 7: [[top, left]], 8: [[left, top]],
        9: [[bottom, top]], 10: [[left, bottom], [right, top]], 11: [[right, top]], 12: [[left, right]],
        13: [[bottom, right]], 14: [[left, bottom]],
      };
      for (const [a, b] of table[idx]) addSeg(a, b);
    }
  }

  // Chaînage des segments en boucles
  const loops: P[][] = [];
  while (segs.size) {
    const [startKey, ends] = segs.entries().next().value as [string, P[]];
    const [sx, sy] = startKey.split(",").map(Number);
    const loop: P[] = [{ x: sx, y: sy }];
    let cur = ends.shift()!;
    if (ends.length === 0) segs.delete(startKey);
    let guard = 0;
    while (key(cur) !== startKey && guard++ < 1e6) {
      loop.push(cur);
      const nexts = segs.get(key(cur));
      if (!nexts || nexts.length === 0) break;
      const nx = nexts.shift()!;
      if (nexts.length === 0) segs.delete(key(cur));
      cur = nx;
    }
    // Retire le rembourrage
    loops.push(loop.map((p) => ({ x: p.x - 1, y: p.y - 1 })));
  }
  return loops;
}

/** Aire signée (positive si sens horaire dans un repère y vers le bas). */
export function signedArea(poly: P[]): number {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Simplification Ramer–Douglas–Peucker (polygone fermé). */
export function simplify(poly: P[], epsilon: number): P[] {
  if (poly.length < 4) return poly;
  const sqEps = epsilon * epsilon;
  const distSq = (p: P, a: P, b: P) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = dx * dx + dy * dy;
    let t = len ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len : 0;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx - p.x, py = a.y + t * dy - p.y;
    return px * px + py * py;
  };
  const rdp = (pts: P[]): P[] => {
    if (pts.length < 3) return pts;
    let maxD = 0, idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = distSq(pts[i], pts[0], pts[pts.length - 1]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD <= sqEps) return [pts[0], pts[pts.length - 1]];
    const left = rdp(pts.slice(0, idx + 1));
    const right = rdp(pts.slice(idx));
    return left.slice(0, -1).concat(right);
  };
  // Coupe la boucle en deux au point le plus éloigné du premier pour un RDP robuste
  let far = 0, farD = 0;
  for (let i = 1; i < poly.length; i++) {
    const dx = poly[i].x - poly[0].x, dy = poly[i].y - poly[0].y;
    const d = dx * dx + dy * dy;
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const a = rdp(poly.slice(0, far + 1));
  const b = rdp(poly.slice(far).concat([poly[0]]));
  const out = a.slice(0, -1).concat(b.slice(0, -1));
  return out.length >= 3 ? out : poly;
}

export function pointInPolygon(p: P, poly: P[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface Region {
  outer: P[];
  holes: P[][];
}

/**
 * Regroupe les contours en régions : chaque contour est extérieur ou trou selon le nombre
 * de contours qui le contiennent (pair = extérieur, impair = trou du plus petit contenant).
 */
export function buildRegions(contours: P[][], minArea = 4): Region[] {
  const items = contours
    .map((poly) => ({ poly, area: Math.abs(signedArea(poly)) }))
    .filter((c) => c.area >= minArea)
    .sort((a, b) => b.area - a.area);
  const depth = items.map((c) => items.filter((o) => o !== c && o.area > c.area && pointInPolygon(c.poly[0], o.poly)).length);
  const regions: Region[] = [];
  const regionOf = new Map<number, Region>();
  items.forEach((c, i) => {
    if (depth[i] % 2 === 0) {
      const r = { outer: c.poly, holes: [] };
      regions.push(r);
      regionOf.set(i, r);
    }
  });
  items.forEach((c, i) => {
    if (depth[i] % 2 === 1) {
      // Le plus petit contour extérieur qui le contient
      let best = -1;
      items.forEach((o, j) => {
        if (depth[j] % 2 === 0 && o.area > c.area && pointInPolygon(c.poly[0], o.poly) && (best < 0 || o.area < items[best].area)) best = j;
      });
      if (best >= 0) regionOf.get(best)!.holes.push(c.poly);
    }
  });
  return regions;
}
