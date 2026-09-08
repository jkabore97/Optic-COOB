import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { FrameColor, FrameMaterial, FrameShape } from "./frames";
import { bounds, lensOutline, type Pt } from "./lens-outline";

/**
 * Construction et animation d'une paire de lunettes en 3D.
 * Repère : mêmes unités que les visuels SVG (1 unité ≈ 0,14 mm), centres des verres
 * à ±210 en x, verres dans le plan z = 0, branches vers z négatif (l'arrière).
 */

export interface SceneOptions {
  shape: FrameShape;
  material: FrameMaterial;
  color: string;
  colorKey: FrameColor;
  autoRotate: boolean;
  interactive: boolean;
}

const LENS_OFFSET = 210; // demi-distance entre les centres des verres

function toCurve(pts: Pt[], mirror: boolean, offsetX: number): THREE.CatmullRomCurve3 {
  const v = pts.map((p) => new THREE.Vector3((mirror ? -p.x : p.x) + offsetX, -p.y, 0));
  return new THREE.CatmullRomCurve3(v, true, "catmullrom", 0.5);
}

function toShape(pts: Pt[], mirror: boolean, offsetX: number): THREE.Shape {
  const s = new THREE.Shape();
  pts.forEach((p, i) => {
    const x = (mirror ? -p.x : p.x) + offsetX;
    const y = -p.y;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  });
  s.closePath();
  return s;
}

function frameMaterial(opts: SceneOptions): THREE.Material {
  const color = new THREE.Color(opts.color);
  const thin = opts.material === "metal" || opts.material === "titane";
  if (thin) {
    return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: opts.material === "titane" ? 0.45 : 0.25 });
  }
  if (opts.colorKey === "cristal") {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#dfe6ee"),
      transmission: 0.7,
      thickness: 6,
      roughness: 0.15,
      ior: 1.49,
      clearcoat: 1,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: opts.colorKey === "ecaille" ? 0.35 : 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: opts.colorKey === "ecaille" ? 0.4 : 0,
    sheenColor: new THREE.Color("#c47a35"),
  });
}

/** Distance entre les centres des verres du modèle procédural (unités de la scène). */
export const PROCEDURAL_IPD = LENS_OFFSET * 2;

/**
 * Construit une paire de lunettes procédurale. Repère : centres des verres en (±210, 0, 0),
 * plan des verres en z = 0, branches vers z négatif, face avant vers +z.
 */
export function buildGlasses(opts: SceneOptions): THREE.Group {
  const group = new THREE.Group();
  const thin = opts.material === "metal" || opts.material === "titane";
  const rimR = thin ? 4.5 : opts.shape === "wayfarer" || opts.shape === "carre" ? 12 : 9;
  const mat = frameMaterial(opts);
  const outline = lensOutline(opts.shape);
  const b = bounds(outline);

  const lensMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#cfe3ef"),
    transmission: 0.92,
    thickness: 3,
    roughness: 0.05,
    ior: 1.5,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });

  for (const mirror of [false, true]) {
    const offset = mirror ? LENS_OFFSET : -LENS_OFFSET;
    // Cercle (tube le long du contour)
    const curve = toCurve(outline, mirror, offset);
    const rim = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, rimR, 16, true), mat);
    group.add(rim);
    // Verre
    const lens = new THREE.Mesh(new THREE.ShapeGeometry(toShape(outline, mirror, offset), 4), lensMat);
    lens.position.z = -1;
    group.add(lens);

    // Charnière + branche
    const outerX = mirror ? offset - b.minX : offset + b.minX; // bord extérieur
    const hingeY = -(b.minY + rimR + 14);
    const dir = mirror ? 1 : -1;
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(thin ? 14 : 26, thin ? 10 : 22, thin ? 10 : 16), mat);
    hinge.name = "hinge";
    hinge.position.set(outerX + dir * (thin ? 8 : 12), hingeY, -6);
    group.add(hinge);

    const templeStart = new THREE.Vector3(outerX + dir * (thin ? 14 : 22), hingeY, -12);
    const temple = new THREE.CatmullRomCurve3([
      templeStart,
      new THREE.Vector3(templeStart.x + dir * 4, hingeY, -120),
      new THREE.Vector3(templeStart.x - dir * 6, hingeY - 4, -400),
      new THREE.Vector3(templeStart.x - dir * 14, hingeY - 30, -520),
      new THREE.Vector3(templeStart.x - dir * 18, hingeY - 110, -570),
    ]);
    const templeGeo = new THREE.TubeGeometry(temple, 64, thin ? 3.5 : 7, 12, false);
    const templeMesh = new THREE.Mesh(templeGeo, mat);
    templeMesh.name = "temple";
    group.add(templeMesh);

    // Plaquettes de nez (montures métal)
    if (thin) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), new THREE.MeshPhysicalMaterial({ color: "#e8eef2", transmission: 0.5, roughness: 0.3 }));
      pad.scale.set(0.6, 1, 0.5);
      pad.position.set(mirror ? offset - b.maxX + 8 : offset + b.maxX - 8, -30, -10);
      group.add(pad);
    }
  }

  // Pont
  const innerL = -LENS_OFFSET + b.maxX;
  const innerR = LENS_OFFSET - b.maxX;
  const bridgeY = -(b.minY + rimR * 0.6 + 12);
  const bridge = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(innerL - 2, bridgeY, 0),
    new THREE.Vector3(0, bridgeY + 28, 0),
    new THREE.Vector3(innerR + 2, bridgeY, 0),
  );
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridge, 32, thin ? 4 : rimR * 0.9, 12, false), mat));
  if (opts.shape === "aviateur" && thin) {
    const bar = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(innerL - 2, bridgeY - 22, 0),
      new THREE.Vector3(0, bridgeY - 4, 0),
      new THREE.Vector3(innerR + 2, bridgeY - 22, 0),
    );
    group.add(new THREE.Mesh(new THREE.TubeGeometry(bar, 32, 3.5, 12, false), mat));
  }

  // Sourcil browline
  if (opts.shape === "browline") {
    const browMat = new THREE.MeshPhysicalMaterial({ color: "#1a1a1a", roughness: 0.25, clearcoat: 1 });
    for (const mirror of [false, true]) {
      const offset = mirror ? LENS_OFFSET : -LENS_OFFSET;
      const s = mirror ? -1 : 1;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(offset + s * b.minX - s * 6, -(b.minY + 8), 2),
        new THREE.Vector3(offset + s * (b.minX * 0.5), -(b.minY - 22), 2),
        new THREE.Vector3(offset + s * (b.maxX * 0.6), -(b.minY - 20), 2),
        new THREE.Vector3(offset + s * b.maxX + s * 6, -(b.minY + 6), 2),
      ]);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 13, 12, false), browMat));
    }
  }

  return group;
}

export function mountGlassesScene(host: HTMLElement, opts: SceneOptions): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.style.display = "block";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 10, 5000);
  camera.position.set(0, 60, 1150);
  camera.lookAt(0, 0, 0);

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(300, 500, 600);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff4d6, 0.5);
  fill.position.set(-400, 100, 300);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  const pivot = new THREE.Group();
  const glasses = buildGlasses(opts);
  // Recentre sur le centre visuel (le verre, pas les branches)
  glasses.position.set(0, 0, 40);
  pivot.add(glasses);
  scene.add(pivot);

  // État de rotation : cible + inertie
  let rotY = -0.35;
  let rotX = 0.08;
  let velY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastInteraction = 0;

  const onDown = (e: PointerEvent) => {
    if (!opts.interactive) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    velY = 0;
    host.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    rotY += dx * 0.006;
    rotX = THREE.MathUtils.clamp(rotX + dy * 0.004, -0.6, 0.6);
    velY = dx * 0.006;
    lastInteraction = performance.now();
  };
  const onUp = () => {
    dragging = false;
    lastInteraction = performance.now();
  };
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onUp);

  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    // Cadre la monture (largeur ≈ 1000 unités) quelle que soit la largeur de l'hôte
    const fit = 1000 / Math.min(1, camera.aspect / 2.2);
    camera.position.z = fit * 1.15;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let raf = 0;
  let visible = true;
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  io.observe(host);

  const t0 = performance.now();
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    const t = (performance.now() - t0) / 1000;
    if (!dragging) {
      // Inertie après un geste, puis reprise douce de la rotation automatique
      velY *= 0.94;
      rotY += velY;
      const idle = performance.now() - lastInteraction > 2500;
      if (opts.autoRotate && idle) rotY += 0.004;
      rotX += (0.08 + Math.sin(t * 0.6) * 0.04 - rotX) * 0.02;
    }
    pivot.rotation.set(rotX, rotY, 0);
    pivot.position.y = Math.sin(t * 0.9) * 8;
    renderer.render(scene, camera);
  };
  tick();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    host.removeEventListener("pointerdown", onDown);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerup", onUp);
    host.removeEventListener("pointercancel", onUp);
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const m = obj.material as THREE.Material | THREE.Material[];
        (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
      }
    });
    scene.environment?.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
