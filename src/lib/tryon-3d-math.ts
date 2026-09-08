import * as THREE from "three";

/**
 * Géométrie de l'essayage 3D : où placer la monture et l'occulteur (tête) à partir
 * des repères 2D du visage et de l'orientation donnée par MediaPipe.
 * Unités : celles de l'espace caméra (cm si la distance est exacte) ; tout est exprimé
 * relativement à l'écart pupillaire observé, donc indépendant de la distance réelle.
 */

export interface Pt2 {
  x: number;
  y: number;
}

/** Point 3D sur le rayon passant par un repère normalisé (0–1), à la profondeur `depth` (> 0). */
export function unprojectAtDepth(p: Pt2, camera: THREE.PerspectiveCamera, depth: number): THREE.Vector3 {
  const v = new THREE.Vector3(p.x * 2 - 1, -(p.y * 2 - 1), 0.5).unproject(camera);
  const dir = v.sub(camera.position).normalize();
  const t = depth / Math.max(1e-6, -dir.z);
  return camera.position.clone().add(dir.multiplyScalar(t));
}

/** Rotation pure (sans échelle) d'une matrice MediaPipe (16 valeurs, colonne-majeur). */
export function rotationFromMatrix(m: ArrayLike<number> | undefined): THREE.Quaternion {
  if (!m || m.length < 16) return new THREE.Quaternion();
  const mat = new THREE.Matrix4().fromArray(Array.from(m));
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  mat.decompose(pos, q, scale);
  if (![q.x, q.y, q.z, q.w].every(Number.isFinite)) return new THREE.Quaternion();
  return q;
}

/** Lacet (rotation autour de la verticale) d'une orientation. */
export function yawOf(q: THREE.Quaternion): number {
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  return Math.atan2(f.x, f.z);
}

export interface GlassesPlacement {
  /** Position du milieu des verres. */
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** Facteur d'échelle : unités du modèle → unités caméra. */
  scale: number;
  /** Écart pupillaire réel (unités caméra), corrigé du raccourcissement. */
  ipd: number;
}

export interface OccluderPlacement {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  radii: THREE.Vector3;
}

/**
 * Place la monture : ses centres de verres (±modelIpd/2 en x local, plan z = 0) tombent
 * sur les pupilles, orientée comme la tête, légèrement en avant des yeux.
 */
export function placeGlasses(
  pupilL: THREE.Vector3,
  pupilR: THREE.Vector3,
  head: THREE.Quaternion,
  modelIpd: number,
  sizeAdj = 1,
  yAdj = 0,
): GlassesPlacement {
  const mid = pupilL.clone().add(pupilR).multiplyScalar(0.5);
  const observed = pupilL.distanceTo(pupilR);
  const ipd = observed / Math.max(0.5, Math.cos(yawOf(head)));
  const scale = (ipd / modelIpd) * sizeAdj;
  // Les verres sont ~19 % de l'écart pupillaire en avant des yeux ; yAdj en fraction de l'IPD
  const offset = new THREE.Vector3(0, yAdj * ipd, 0.19 * ipd).applyQuaternion(head);
  return { position: mid.add(offset), quaternion: head.clone(), scale, ipd };
}

/**
 * Ellipsoïde qui masque ce qui passe derrière la tête (branches), sans jamais
 * dépasser le plan des yeux vers l'avant.
 */
export function placeOccluder(
  glasses: GlassesPlacement,
  faceWidth: number,
): OccluderPlacement {
  const rx = Math.max(faceWidth * 0.55, glasses.ipd * 1.05);
  const ry = rx * 1.4;
  const rz = rx * 1.25;
  // Face avant de l'ellipsoïde ~0,25 IPD derrière le plan des verres (donc derrière les yeux)
  const frontZ = 0.19 * glasses.ipd - 0.25 * glasses.ipd;
  const local = new THREE.Vector3(0, -0.35 * glasses.ipd, frontZ - rz);
  const eyeMid = glasses.position.clone().sub(new THREE.Vector3(0, 0, 0.19 * glasses.ipd).applyQuaternion(glasses.quaternion));
  return {
    position: eyeMid.add(local.applyQuaternion(glasses.quaternion)),
    quaternion: glasses.quaternion.clone(),
    radii: new THREE.Vector3(rx, ry, rz),
  };
}

/** Largeur du visage (distance entre les tempes) corrigée du raccourcissement. */
export function faceWidthFrom(templeL: THREE.Vector3, templeR: THREE.Vector3, head: THREE.Quaternion): number {
  return templeL.distanceTo(templeR) / Math.max(0.5, Math.cos(yawOf(head)));
}

/**
 * Normalise un modèle GLB de lunettes : origine au milieu des verres, plan des verres en
 * z = 0, face avant vers +z (convention glTF). Retourne l'écart des centres de verres estimé.
 */
export function normalizeGlassesModel(object: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const width = Math.max(size.x, 1e-6);
  // Les branches partent vers l'arrière : le plan des verres est près de la face avant (z max)
  const lensZ = box.max.z - width * 0.02;
  object.position.sub(new THREE.Vector3(center.x, center.y, lensZ));
  return width * 0.5;
}

const TEMPLE_NAME = /temple|branche|arm|hinge|charni|earpiece|tige/i;

/**
 * Vrai si un maillage est une branche (ou charnière) : nommé comme tel, ou allongé vers
 * l'arrière (−Z) par rapport à la largeur totale de la monture.
 */
export function isTemplePart(name: string, box: THREE.Box3, modelWidth: number): boolean {
  if (TEMPLE_NAME.test(name)) return true;
  const depth = box.max.z - box.min.z;
  const width = box.max.x - box.min.x;
  return depth > modelWidth * 0.3 && depth > width * 1.5 && box.min.z < -modelWidth * 0.15;
}

/** Masque les branches d'un modèle (essayage caméra). Retourne le nombre de pièces masquées. */
export function hideTemples(object: THREE.Object3D): number {
  const whole = new THREE.Box3().setFromObject(object);
  const modelWidth = Math.max(1e-6, whole.max.x - whole.min.x);
  let hidden = 0;
  object.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const box = new THREE.Box3().setFromObject(o);
    if (isTemplePart(o.name, box, modelWidth)) {
      o.visible = false;
      hidden++;
    }
  });
  return hidden;
}
