/**
 * Géométrie de l'essayage virtuel : placer le visuel d'une monture sur un visage.
 *
 * Chaque visuel déclare deux points d'ancrage (centres des verres gauche et droit, en
 * pixels de l'image). On les fait coïncider avec les pupilles détectées.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Description d'un visuel de monture, tel que stocké dans le catalogue. */
export interface FrameImageSpec {
  width: number;
  height: number;
  /** Centre du verre gauche dans l'image (gauche de l'image = œil droit du sujet). */
  anchorL: Pt;
  /** Centre du verre droit dans l'image. */
  anchorR: Pt;
}

/** Position des pupilles dans l'espace d'affichage (pixels). `a` est à gauche de l'image. */
export interface EyePose {
  mid: Pt;
  /** Angle de la ligne des pupilles, en radians. */
  angle: number;
  /** Distance entre les pupilles, en pixels. */
  dist: number;
}

export interface OverlayPlacement {
  /** Point de l'écran où placer le milieu des ancres. */
  tx: number;
  ty: number;
  /** Rotation à appliquer au visuel, en radians. */
  rotation: number;
  /** Facteur d'échelle du visuel (pixels écran / pixels image). */
  scale: number;
  /** Milieu des ancres dans l'image, décalé du réglage vertical. */
  ox: number;
  oy: number;
}

export function eyePose(a: Pt, b: Pt): EyePose {
  const [l, r] = a.x <= b.x ? [a, b] : [b, a];
  const dx = r.x - l.x;
  const dy = r.y - l.y;
  return { mid: { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 }, angle: Math.atan2(dy, dx), dist: Math.hypot(dx, dy) };
}

/** Lissage exponentiel entre deux poses (réduit les tremblements). */
export function smoothPose(prev: EyePose | null, next: EyePose, alpha = 0.45): EyePose {
  if (!prev) return next;
  return {
    mid: { x: prev.mid.x + (next.mid.x - prev.mid.x) * alpha, y: prev.mid.y + (next.mid.y - prev.mid.y) * alpha },
    angle: prev.angle + (next.angle - prev.angle) * alpha,
    dist: prev.dist + (next.dist - prev.dist) * alpha,
  };
}

/**
 * Calcule le placement du visuel : ses deux ancres tombent sur les pupilles,
 * modulo un ajustement de taille (facteur) et de hauteur (pixels image).
 */
export function placeOverlay(pose: EyePose, image: FrameImageSpec, sizeAdj = 1, yAdj = 0): OverlayPlacement {
  const adx = image.anchorR.x - image.anchorL.x;
  const ady = image.anchorR.y - image.anchorL.y;
  const anchorDist = Math.hypot(adx, ady) || 1;
  const anchorAngle = Math.atan2(ady, adx);
  return {
    tx: pose.mid.x,
    ty: pose.mid.y,
    rotation: pose.angle - anchorAngle,
    scale: (pose.dist / anchorDist) * sizeAdj,
    ox: (image.anchorL.x + image.anchorR.x) / 2,
    oy: (image.anchorL.y + image.anchorR.y) / 2 - yAdj,
  };
}

/** Transformation CSS correspondante (transform-origin: 0 0). */
export function placementToCss(p: OverlayPlacement): string {
  return `translate(${p.tx}px, ${p.ty}px) rotate(${p.rotation}rad) scale(${p.scale}) translate(${-p.ox}px, ${-p.oy}px)`;
}

/** Ancres par défaut pour une image dont on ne sait rien : 30 % / 70 % de la largeur, mi-hauteur. */
export function defaultAnchors(width: number, height: number): Pick<FrameImageSpec, "anchorL" | "anchorR"> {
  return { anchorL: { x: width * 0.3, y: height * 0.5 }, anchorR: { x: width * 0.7, y: height * 0.5 } };
}

// ---- Orientation de la tête et placement en 3D ----

export interface HeadPose {
  /** Rotation autour de l'axe vertical (radians, > 0 : le visage regarde vers la droite de l'image). */
  yaw: number;
  /** Rotation autour de l'axe horizontal (radians, > 0 : le visage regarde vers le haut). */
  pitch: number;
}

/**
 * Orientation à partir de la matrice de transformation faciale de MediaPipe
 * (16 valeurs, colonne-majeur ; repère caméra : x à droite, y en haut, z vers la caméra).
 * On lit le vecteur « avant » du visage (troisième colonne).
 */
export function headPoseFromMatrix(m: ArrayLike<number>): HeadPose {
  const fx = m[8], fy = m[9], fz = m[10];
  if (!Number.isFinite(fx) || !Number.isFinite(fy) || !Number.isFinite(fz)) return { yaw: 0, pitch: 0 };
  return { yaw: Math.atan2(fx, fz), pitch: Math.atan2(fy, fz) };
}

const clampAngle = (a: number, max: number) => Math.max(-max, Math.min(max, a));

export interface Placement3D extends OverlayPlacement {
  yaw: number;
  pitch: number;
  /** Distance de perspective (pixels). */
  perspective: number;
}

/**
 * Placement avec orientation : les ancres tombent sur les pupilles, l'échelle est corrigée
 * du raccourcissement dû à la rotation, et le visuel est incliné comme la tête.
 */
export function placeOverlay3D(
  pose: EyePose,
  head: HeadPose,
  image: FrameImageSpec,
  sizeAdj = 1,
  yAdj = 0,
  maxAngle = 0.6,
): Placement3D {
  const yaw = clampAngle(head.yaw, maxAngle);
  const pitch = clampAngle(head.pitch, maxAngle);
  const base = placeOverlay(pose, image, sizeAdj, yAdj);
  const foreshorten = Math.max(0.5, Math.cos(yaw));
  return {
    ...base,
    scale: base.scale / foreshorten,
    yaw,
    pitch,
    perspective: Math.max(600, pose.dist * 7),
  };
}

/**
 * Transformation CSS 3D. À utiliser avec `transform-origin: ox oy` (milieu des ancres),
 * pour que le point de fuite soit au centre du visage.
 */
export function placement3DToCss(p: Placement3D): string {
  return (
    `translate(${p.tx - p.ox}px, ${p.ty - p.oy}px) perspective(${p.perspective}px) ` +
    `rotate(${p.rotation}rad) rotateY(${p.yaw}rad) rotateX(${p.pitch}rad) scale(${p.scale})`
  );
}

type Mat4 = number[]; // ligne-majeur 4×4

function mul(a: Mat4, b: Mat4): Mat4 {
  const r = new Array<number>(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
  return r;
}
const I: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const translate = (x: number, y: number): Mat4 => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, 0, 0, 0, 0, 1];
const scaleM = (s: number): Mat4 => [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];
const rotZ = (a: number): Mat4 => [Math.cos(a), -Math.sin(a), 0, 0, Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const rotY = (a: number): Mat4 => [Math.cos(a), 0, Math.sin(a), 0, 0, 1, 0, 0, -Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1];
const rotX = (a: number): Mat4 => [1, 0, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, 0, Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1];
const persp = (d: number): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1 / d, 1];

/**
 * Projette les coins du visuel (en pixels image) sur l'écran, avec la même chaîne de
 * transformations que le CSS — utilisé pour la capture sur canvas.
 * Retourne [haut-gauche, haut-droit, bas-gauche, bas-droit].
 */
export function projectCorners(p: Placement3D, image: Pick<FrameImageSpec, "width" | "height">): Pt[] {
  const M = [translate(p.tx, p.ty), persp(p.perspective), rotZ(p.rotation), rotY(p.yaw), rotX(p.pitch), scaleM(p.scale), translate(-p.ox, -p.oy)].reduce(mul, I);
  const corners: Pt[] = [
    { x: 0, y: 0 },
    { x: image.width, y: 0 },
    { x: 0, y: image.height },
    { x: image.width, y: image.height },
  ];
  return corners.map(({ x, y }) => {
    const X = M[0] * x + M[1] * y + M[3];
    const Y = M[4] * x + M[5] * y + M[7];
    const W = M[12] * x + M[13] * y + M[15] || 1;
    return { x: X / W, y: Y / W };
  });
}

/** Lissage d'une orientation (réduit les tremblements), avec zone morte. */
export function smoothHead(prev: HeadPose | null, next: HeadPose, alpha = 0.35, deadZone = 0.02): HeadPose {
  if (!prev) return next;
  const step = (a: number, b: number) => (Math.abs(b - a) < deadZone ? a : a + (b - a) * alpha);
  return { yaw: step(prev.yaw, next.yaw), pitch: step(prev.pitch, next.pitch) };
}
