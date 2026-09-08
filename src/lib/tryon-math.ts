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
