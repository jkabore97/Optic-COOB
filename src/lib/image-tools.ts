/**
 * Outils image côté navigateur pour les photos de montures (espace équipe).
 */

/** Charge un fichier image dans un canvas, réduit à `maxWidth` pixels de large. */
export async function loadToCanvas(file: File, maxWidth = 1400): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/**
 * Rend transparent le fond clair d'une photo produit, avec un léger adoucissement du contour.
 * - `edges` : seuls les pixels clairs reliés au bord de l'image sont effacés (le fond) ;
 * - `all` : toutes les zones claires sont effacées, y compris l'intérieur des verres, pour que
 *   les yeux restent visibles lors de l'essayage virtuel (à éviter pour une monture blanche).
 * `threshold` : luminosité minimale (0–255) considérée comme fond.
 */
export function removeLightBackground(canvas: HTMLCanvasElement, threshold = 228, mode: "edges" | "all" = "all"): void {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  const bright = new Uint8Array(n);
  const soft = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const min = Math.min(r, g, b);
    if (min >= threshold) bright[i] = 1;
    else if (min >= threshold - 40) soft[i] = 1;
  }
  const visited = mode === "all" ? bright.slice() : new Uint8Array(n);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!visited[i] && bright[i]) {
      visited[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (mode === "edges" && stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i + w < n) push(i + w);
  }
  for (let i = 0; i < n; i++) {
    if (visited[i]) {
      d[i * 4 + 3] = 0;
    } else if (soft[i]) {
      // Bord : voisin d'un pixel effacé → alpha partiel pour lisser
      const x = i % w;
      const near =
        (x > 0 && visited[i - 1]) || (x < w - 1 && visited[i + 1]) || (i >= w && visited[i - w]) || (i + w < n && visited[i + w]);
      if (near) {
        const min = Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
        d[i * 4 + 3] = Math.round(255 * (1 - (min - (threshold - 40)) / 40));
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Rogne les marges transparentes (avec une petite marge conservée). */
export function trimTransparent(canvas: HTMLCanvasElement, padding = 8): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  const d = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return canvas;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(w - 1, maxX + padding);
  maxY = Math.min(h - 1, maxY + padding);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** Centres des deux verres (voir detectLenses). */
export function detectLensCenters(canvas: HTMLCanvasElement): { anchorL: { x: number; y: number }; anchorR: { x: number; y: number } } | null {
  const lenses = detectLenses(canvas);
  if (!lenses) return null;
  return { anchorL: { x: lenses[0].cx, y: lenses[0].cy }, anchorR: { x: lenses[1].cx, y: lenses[1].cy } };
}

export interface LensRegion {
  cx: number;
  cy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Les deux verres (zones transparentes fermées) d'une photo détourée, gauche puis droite. */
export function detectLenses(canvas: HTMLCanvasElement): [LensRegion, LensRegion] | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { width: w, height: h } = canvas;
  const d = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const clear = new Uint8Array(n);
  for (let i = 0; i < n; i++) clear[i] = d[i * 4 + 3] < 40 ? 1 : 0;
  const label = new Int32Array(n).fill(-1);
  const comps: (LensRegion & { size: number; sx: number; sy: number; border: boolean })[] = [];
  const stack: number[] = [];
  for (let start = 0; start < n; start++) {
    if (!clear[start] || label[start] >= 0) continue;
    const id = comps.length;
    const c = { size: 0, sx: 0, sy: 0, border: false, cx: 0, cy: 0, minX: w, maxX: 0, minY: h, maxY: 0 };
    comps.push(c);
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i - x) / w;
      c.size++;
      c.sx += x;
      c.sy += y;
      if (x < c.minX) c.minX = x;
      if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) c.border = true;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const j of nb) {
        if (j >= 0 && j < n && clear[j] && label[j] < 0) {
          label[j] = id;
          stack.push(j);
        }
      }
    }
  }
  const inner = comps.filter((c) => !c.border && c.size > n * 0.01).sort((a, b) => b.size - a.size).slice(0, 2);
  if (inner.length < 2 || inner[1].size < inner[0].size * 0.4) return null;
  for (const c of inner) {
    c.cx = Math.round(c.sx / c.size);
    c.cy = Math.round(c.sy / c.size);
  }
  const [a, b] = inner;
  if (Math.abs(a.cy - b.cy) > h * 0.25 || Math.abs(a.cx - b.cx) < w * 0.2) return null;
  const [l, r] = a.cx < b.cx ? [a, b] : [b, a];
  const strip = (c: typeof a): LensRegion => ({ cx: c.cx, cy: c.cy, minX: c.minX, maxX: c.maxX, minY: c.minY, maxY: c.maxY });
  return [strip(l), strip(r)];
}

/**
 * Efface les branches d'une photo de face détourée : tout ce qui dépasse, à gauche et à
 * droite, du bord extérieur du cercle de chaque verre (mesuré à hauteur du verre) devient
 * transparent. Les dimensions de l'image sont conservées (les ancres restent valables).
 * Retourne false si les verres n'ont pas pu être identifiés (image inchangée).
 */
export function removeTemples(canvas: HTMLCanvasElement): boolean {
  const lenses = detectLenses(canvas);
  if (!lenses) return false;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const alpha = (x: number, y: number) => d[(y * w + x) * 4 + 3];
  const [l, r] = lenses;

  // Bord extérieur du cercle gauche : depuis le verre, vers la gauche, jusqu'au premier pixel transparent.
  // On prend la valeur la plus à l'extérieur sur quelques lignes autour du centre du verre.
  let cutL = 0;
  let cutR = w - 1;
  const rows = 9;
  for (let k = -rows; k <= rows; k++) {
    const yl = Math.min(h - 1, Math.max(0, l.cy + k * Math.max(1, Math.round((l.maxY - l.minY) / (rows * 2.5)))));
    let x = l.minX;
    while (x > 0 && alpha(x - 1, yl) > 40) x--;
    cutL = Math.max(cutL, x);
    const yr = Math.min(h - 1, Math.max(0, r.cy + k * Math.max(1, Math.round((r.maxY - r.minY) / (rows * 2.5)))));
    let xr = r.maxX;
    while (xr < w - 1 && alpha(xr + 1, yr) > 40) xr++;
    cutR = Math.min(cutR, xr);
  }
  // Petite marge pour garder l'arrondi du cercle, puis effacement
  const margin = Math.max(2, Math.round(w * 0.004));
  cutL = Math.max(0, cutL - margin);
  cutR = Math.min(w - 1, cutR + margin);
  if (cutL <= 0 && cutR >= w - 1) return true;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < cutL; x++) d[(y * w + x) * 4 + 3] = 0;
    for (let x = cutR + 1; x < w; x++) d[(y * w + x) * 4 + 3] = 0;
  }
  ctx.putImageData(img, 0, 0);
  return true;
}
