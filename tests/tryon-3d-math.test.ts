import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { faceWidthFrom, normalizeGlassesModel, placeGlasses, placeOccluder, rotationFromMatrix, unprojectAtDepth, yawOf } from "../src/lib/tryon-3d-math";

const camera = new THREE.PerspectiveCamera(63, 4 / 3, 1, 1000);
camera.position.set(0, 0, 0);
camera.updateMatrixWorld();

describe("tryon-3d-math", () => {
  it("projette un repère normalisé à la profondeur demandée", () => {
    const c = unprojectAtDepth({ x: 0.5, y: 0.5 }, camera, 45);
    expect(c.x).toBeCloseTo(0, 5);
    expect(c.y).toBeCloseTo(0, 5);
    expect(c.z).toBeCloseTo(-45, 5);
    const right = unprojectAtDepth({ x: 0.75, y: 0.5 }, camera, 45);
    expect(right.x).toBeGreaterThan(0);
    const up = unprojectAtDepth({ x: 0.5, y: 0.25 }, camera, 45);
    expect(up.y).toBeGreaterThan(0);
  });

  it("extrait une rotation propre de la matrice MediaPipe", () => {
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -40, 1];
    expect(yawOf(rotationFromMatrix(identity))).toBeCloseTo(0);
    const m = new THREE.Matrix4().makeRotationY(0.4).setPosition(0, 0, -40);
    expect(yawOf(rotationFromMatrix(m.toArray()))).toBeCloseTo(0.4);
    expect(rotationFromMatrix(undefined).w).toBe(1);
  });

  it("pose la monture sur les pupilles, en avant des yeux, à la bonne échelle", () => {
    const L = new THREE.Vector3(-3.15, 0, -45);
    const R = new THREE.Vector3(3.15, 0, -45);
    const p = placeGlasses(L, R, new THREE.Quaternion(), 420);
    expect(p.ipd).toBeCloseTo(6.3);
    expect(p.scale).toBeCloseTo(6.3 / 420);
    expect(p.position.x).toBeCloseTo(0);
    expect(p.position.z).toBeGreaterThan(-45); // devant les yeux (vers la caméra)
    // Tête tournée : l'écart observé est raccourci, l'IPD réel est retrouvé
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
    const Lf = new THREE.Vector3(-3.15 * Math.cos(0.5), 0, -45);
    const Rf = new THREE.Vector3(3.15 * Math.cos(0.5), 0, -45);
    expect(placeGlasses(Lf, Rf, q, 420).ipd).toBeCloseTo(6.3, 3);
  });

  it("place l'occulteur derrière le plan des yeux", () => {
    const L = new THREE.Vector3(-3.15, 0, -45);
    const R = new THREE.Vector3(3.15, 0, -45);
    const g = placeGlasses(L, R, new THREE.Quaternion(), 420);
    const occ = placeOccluder(g, 14);
    expect(occ.radii.x).toBeCloseTo(7.7);
    const front = occ.position.z + occ.radii.z;
    expect(front).toBeLessThan(-45); // derrière les yeux
    expect(front).toBeLessThan(g.position.z); // et derrière les verres
    expect(faceWidthFrom(new THREE.Vector3(-7, 0, -45), new THREE.Vector3(7, 0, -45), new THREE.Quaternion())).toBeCloseTo(14);
  });

  it("normalise un modèle : origine au milieu des verres, face avant en z = 0", () => {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(140, 40, 10));
    box.position.set(10, 5, -5); // face avant en z = 0 avant normalisation
    const temple = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 140));
    temple.position.set(78, 10, -75);
    group.add(box, temple);
    const ipd = normalizeGlassesModel(group);
    expect(ipd).toBeCloseTo((80 - -60) * 0.5); // largeur 140 → 70
    const b = new THREE.Box3().setFromObject(group);
    expect(b.max.z).toBeCloseTo(140 * 0.02);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(0);
  });
});
