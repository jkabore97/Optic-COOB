import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { buildGlasses, PROCEDURAL_IPD, type SceneOptions } from "./glasses-scene";
import { faceWidthFrom, normalizeGlassesModel, placeGlasses, placeOccluder, rotationFromMatrix, unprojectAtDepth } from "./tryon-3d-math";

/**
 * Moteur d'essayage 3D : un calque WebGL transparent au-dessus de la vidéo, une monture
 * (modèle GLB ou procédurale) posée sur le visage suivi par MediaPipe, et un occulteur
 * qui cache les branches derrière la tête.
 */

/** Champ de vision vertical supposé par MediaPipe pour la matrice faciale. */
const VERTICAL_FOV = 63;
/** Distance de travail (unités caméra) à laquelle les repères 2D sont projetés. */
const DEPTH = 45;

export interface FaceObservation {
  landmarks: NormalizedLandmark[];
  matrix?: ArrayLike<number>;
}

export interface ModelSpec {
  object: THREE.Object3D;
  /** Distance entre les centres des verres, en unités du modèle. */
  ipd: number;
}

export interface TryOnEngine {
  setModel(model: ModelSpec | null): void;
  /** Met à jour la pose ; null si aucun visage. */
  update(face: FaceObservation | null): void;
  setAdjust(size: number, y: number): void;
  setExposure(value: number): void;
  resize(width: number, height: number, pixelRatio?: number): void;
  render(): void;
  dispose(): void;
  readonly canvas: HTMLCanvasElement;
}

export function createTryOnEngine(canvas: HTMLCanvasElement): TryOnEngine {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(VERTICAL_FOV, 1, 1, 1000);
  camera.position.set(0, 0, 0);

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(20, 40, 60);
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a80, 0.5));

  // Occulteur : écrit la profondeur, pas la couleur
  const occluder = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshBasicMaterial({ colorWrite: false }));
  occluder.renderOrder = -1;
  occluder.visible = false;
  scene.add(occluder);

  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  let current: ModelSpec | null = null;
  let sizeAdj = 1;
  let yAdj = 0;
  const smoothQ = new THREE.Quaternion();
  const smoothPos = new THREE.Vector3();
  let smoothScale = 0;
  let hasPose = false;

  const disposeObject = (obj: THREE.Object3D) => {
    obj.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material as THREE.Material | THREE.Material[];
        (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
      }
    });
  };

  return {
    canvas,
    setModel(model) {
      if (current) {
        root.remove(current.object);
        disposeObject(current.object);
      }
      current = model;
      if (model) root.add(model.object);
      hasPose = false;
    },
    setAdjust(size, y) {
      sizeAdj = size;
      yAdj = y;
    },
    setExposure(value) {
      renderer.toneMappingExposure = value;
    },
    resize(width, height, pixelRatio = Math.min(window.devicePixelRatio || 1, 2)) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    },
    update(face) {
      if (!face || !current || face.landmarks.length < 468) {
        root.visible = false;
        occluder.visible = false;
        return;
      }
      const lm = face.landmarks;
      const pL = lm.length >= 478 ? lm[468] : lm[133];
      const pR = lm.length >= 478 ? lm[473] : lm[362];
      const pupilL = unprojectAtDepth(pL, camera, DEPTH);
      const pupilR = unprojectAtDepth(pR, camera, DEPTH);
      const head = rotationFromMatrix(face.matrix);
      const placement = placeGlasses(pupilL, pupilR, head, current.ipd, sizeAdj, yAdj);
      const faceWidth = faceWidthFrom(unprojectAtDepth(lm[234], camera, DEPTH), unprojectAtDepth(lm[454], camera, DEPTH), head);
      const occ = placeOccluder(placement, faceWidth);

      // Lissage (position, rotation, échelle) pour un rendu stable
      if (!hasPose) {
        smoothPos.copy(placement.position);
        smoothQ.copy(placement.quaternion);
        smoothScale = placement.scale;
        hasPose = true;
      } else {
        smoothPos.lerp(placement.position, 0.5);
        smoothQ.slerp(placement.quaternion, 0.4);
        smoothScale += (placement.scale - smoothScale) * 0.4;
      }
      root.position.copy(smoothPos);
      root.quaternion.copy(smoothQ);
      root.scale.setScalar(smoothScale);
      root.visible = true;

      occluder.position.copy(occ.position);
      occluder.quaternion.copy(occ.quaternion);
      occluder.scale.copy(occ.radii);
      occluder.visible = true;
    },
    render() {
      renderer.render(scene, camera);
    },
    dispose() {
      if (current) disposeObject(current.object);
      occluder.geometry.dispose();
      (occluder.material as THREE.Material).dispose();
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}

/** Modèle procédural (montures de démonstration), dans la convention du moteur. */
export function proceduralModel(opts: SceneOptions): ModelSpec {
  return { object: buildGlasses(opts), ipd: PROCEDURAL_IPD };
}

/** Charge un GLB et le normalise (origine au milieu des verres). */
export async function loadGlbModel(url: string): Promise<ModelSpec> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const object = gltf.scene;
  const ipd = normalizeGlassesModel(object);
  return { object, ipd };
}

/** Luminance moyenne (0–1) d'une image vidéo, pour caler l'exposition du rendu. */
export function averageLuminance(video: HTMLVideoElement, sampler: HTMLCanvasElement): number | null {
  if (!video.videoWidth) return null;
  sampler.width = 32;
  sampler.height = 24;
  const ctx = sampler.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, 32, 24);
  const d = ctx.getImageData(0, 0, 32, 24).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return sum / (d.length / 4) / 255;
}
