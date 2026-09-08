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
