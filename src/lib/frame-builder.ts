import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { buildRegions, simplify, traceContours, type P, type Region } from "./contour";

/**
 * Construit un modèle 3D de lunettes à partir de la photo de face détourée :
 * la monture (zone opaque) est extraite, extrudée avec une épaisseur et une courbure de
 * galbe, texturée avec la photo ; les trous (verres) deviennent des verres transparents ;
 * des branches paramétriques sont ajoutées. Export GLB pour l'essayage 3D.
 *
 * Repère du modèle : millimètres, centre des verres autour de l'origine, face avant vers +Z,
 * branches vers −Z (convention du moteur d'essayage).
 */

export interface BuildOptions {
  /** Largeur totale de la face avant, en mm (défaut 140). */
  widthMm?: number;
  /** Épaisseur de la monture, en mm. */
  thicknessMm?: number;
  /** Longueur des branches, en mm. */
  templeMm?: number;
  /** Rayon de galbe de la face avant, en mm (plus petit = plus courbé). */
  wrapRadiusMm?: number;
  /** Centres des verres dans la photo (pixels), pour l'origine et l'IPD du modèle. */
  anchors?: { anchorL: P; anchorR: P };
}

export interface BuiltModel {
  group: THREE.Group;
  /** Écart des centres de verres, en mm. */
  ipdMm: number;
  widthMm: number;
}

/** Masque binaire (1 = monture) à partir du canal alpha, à résolution réduite. */
function alphaMask(src: HTMLCanvasElement, maxW = 480): { mask: Uint8Array; w: number; h: number; scale: number } {
  const scale = Math.min(1, maxW / src.width);
  const w = Math.max(2, Math.round(src.width * scale));
  const h = Math.max(2, Math.round(src.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = d[i * 4 + 3] > 96 ? 1 : 0;
  return { mask, w, h, scale };
}

/** Couleur moyenne des pixels opaques proches d'un point (pour les branches). */
function sampleColor(src: HTMLCanvasElement, x: number, y: number, radius: number): THREE.Color {
  const ctx = src.getContext("2d", { willReadFrequently: true })!;
  const x0 = Math.max(0, Math.round(x - radius)), y0 = Math.max(0, Math.round(y - radius));
  const w = Math.min(src.width - x0, Math.round(radius * 2)), h = Math.min(src.height - y0, Math.round(radius * 2));
  if (w <= 0 || h <= 0) return new THREE.Color("#222");
  const d = ctx.getImageData(x0, y0, w, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 200) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
      n++;
    }
  }
  if (!n) return new THREE.Color("#222");
  return new THREE.Color(r / n / 255, g / n / 255, b / n / 255).convertSRGBToLinear();
}

/** Texture carrée (puissance de 2) contenant la photo, et le facteur de remplissage utilisé. */
function makeTexture(src: HTMLCanvasElement): { texture: THREE.Texture; fill: { u: number; v: number } } {
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const s = Math.min(size / src.width, size / src.height);
  const w = Math.round(src.width * s), h = Math.round(src.height * s);
  ctx.drawImage(src, 0, 0, w, h);
  const texture = new THREE.CanvasTexture(c);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, fill: { u: w / size, v: h / size } };
}

export function buildFrameModel(photo: HTMLCanvasElement, opts: BuildOptions = {}): BuiltModel {
  const widthMm = opts.widthMm ?? 140;
  const thickness = opts.thicknessMm ?? 4;
  const templeMm = opts.templeMm ?? 140;
  const wrapR = opts.wrapRadiusMm ?? 140;

  const { mask, w, h, scale } = alphaMask(photo);
  const regions = buildRegions(traceContours(mask, w, h), 6).map((r) => ({
    outer: simplify(r.outer, 0.6),
    holes: r.holes.map((hh) => simplify(hh, 0.6)),
  }));
  if (regions.length === 0) throw new Error("Aucune forme de monture trouvée : la photo doit être détourée (fond transparent).");

  // Pixels (photo pleine résolution) → mm, origine au milieu des centres de verres
  const mmPerPx = widthMm / photo.width;
  const anchors = opts.anchors ?? { anchorL: { x: photo.width * 0.3, y: photo.height * 0.5 }, anchorR: { x: photo.width * 0.7, y: photo.height * 0.5 } };
  const ox = (anchors.anchorL.x + anchors.anchorR.x) / 2;
  const oy = (anchors.anchorL.y + anchors.anchorR.y) / 2;
  const toMm = (p: P): P => ({ x: (p.x / scale - ox) * mmPerPx, y: -(p.y / scale - oy) * mmPerPx });
  const ipdMm = Math.hypot(anchors.anchorR.x - anchors.anchorL.x, anchors.anchorR.y - anchors.anchorL.y) * mmPerPx;

  const toShape = (poly: P[]) => {
    const s = new THREE.Shape();
    poly.forEach((p, i) => {
      const m = toMm(p);
      if (i === 0) s.moveTo(m.x, m.y);
      else s.lineTo(m.x, m.y);
    });
    s.closePath();
    return s;
  };
  const toPath = (poly: P[]) => {
    const path = new THREE.Path();
    poly.forEach((p, i) => {
      const m = toMm(p);
      if (i === 0) path.moveTo(m.x, m.y);
      else path.lineTo(m.x, m.y);
    });
    path.closePath();
    return path;
  };

  const group = new THREE.Group();
  const { texture, fill } = makeTexture(photo);
  const rimMat = new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0xdfeaf2, transmission: 0.92, thickness: 1.5, roughness: 0.05, ior: 1.5, transparent: true, opacity: 0.85 });

  // UV : projection planaire de la photo (mm → pixels de la texture)
  const uvFromMm = (x: number, y: number) => {
    const px = x / mmPerPx + ox;
    const py = -y / mmPerPx + oy;
    return [(px / photo.width) * fill.u, (py / photo.height) * fill.v];
  };
  const applyPlanarUv = (geo: THREE.BufferGeometry) => {
    const pos = geo.getAttribute("position");
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const [u, v] = uvFromMm(pos.getX(i), pos.getY(i));
      uv[i * 2] = u;
      uv[i * 2 + 1] = v;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  };
  const applyWrap = (geo: THREE.BufferGeometry) => {
    const pos = geo.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, pos.getZ(i) - (x * x) / (2 * wrapR));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };

  let minX = Infinity, maxX = -Infinity, hingeYL = 0, hingeYR = 0;
  for (const region of regions as Region[]) {
    const shape = toShape(region.outer);
    shape.holes = region.holes.map(toPath);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: Math.min(0.8, thickness / 4), bevelSize: 0.5, bevelSegments: 2, curveSegments: 4 });
    geo.translate(0, 0, -thickness / 2);
    applyPlanarUv(geo);
    applyWrap(geo);
    group.add(new THREE.Mesh(geo, rimMat));

    // Verres dans les trous
    for (const hole of region.holes) {
      const lens = new THREE.Mesh(new THREE.ShapeGeometry(toShape(hole), 2), lensMat);
      applyWrap(lens.geometry);
      group.add(lens);
    }
    for (const p of region.outer) {
      const m = toMm(p);
      if (m.x < minX) {
        minX = m.x;
        hingeYL = m.y;
      }
      if (m.x > maxX) {
        maxX = m.x;
        hingeYR = m.y;
      }
    }
  }

  // Branches paramétriques, couleur prélevée près des charnières
  const templeColor = sampleColor(photo, ox + (minX + 6) / mmPerPx, oy - hingeYL / mmPerPx, Math.max(6, 8 / mmPerPx));
  const templeMat = new THREE.MeshPhysicalMaterial({ color: templeColor, roughness: 0.35, clearcoat: 0.6 });
  const templeH = Math.max(3, Math.min(7, thickness * 1.4));
  for (const side of [-1, 1] as const) {
    const hx = side < 0 ? minX : maxX;
    const hy = (side < 0 ? hingeYL : hingeYR) + templeH * 0.4;
    const hz = -(hx * hx) / (2 * wrapR) - thickness / 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, hy, hz),
      new THREE.Vector3(hx + side * 1.5, hy, hz - templeMm * 0.15),
      new THREE.Vector3(hx + side * 2, hy - 1, hz - templeMm * 0.68),
      new THREE.Vector3(hx - side * 1, hy - 9, hz - templeMm * 0.86),
      new THREE.Vector3(hx - side * 4, hy - 24, hz - templeMm),
    ]);
    const geo = new THREE.TubeGeometry(curve, 40, templeH / 2.6, 10, false);
    geo.scale(1, 1, 1);
    const temple = new THREE.Mesh(geo, templeMat);
    temple.name = "temple";
    group.add(temple);
    // Charnière
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(thickness * 1.2, templeH, thickness * 1.2), templeMat);
    hinge.name = "hinge";
    hinge.position.set(hx + side * thickness * 0.4, hy, hz - thickness * 0.2);
    group.add(hinge);
  }

  group.userData.ipd = ipdMm;
  group.userData.generatedBy = "coob-frame-builder";
  return { group, ipdMm, widthMm };
}

/** Exporte le modèle en GLB (data URL). */
export async function exportGlb(group: THREE.Object3D): Promise<string> {
  const exporter = new GLTFExporter();
  const result = (await exporter.parseAsync(group, { binary: true })) as ArrayBuffer;
  const bytes = new Uint8Array(result);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return `data:model/gltf-binary;base64,${btoa(bin)}`;
}

/** Charge une data URL / URL d'image dans un canvas. */
export async function imageToCanvas(src: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("image"));
    img.src = src;
  });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext("2d")!.drawImage(img, 0, 0);
  return c;
}
