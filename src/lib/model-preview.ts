import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { loadGlbModel } from "./tryon-3d";

/** Aperçu tournant d'un modèle GLB de lunettes (espace équipe). Retourne une fonction de nettoyage. */
export function mountModelPreview(host: HTMLElement, url: string, onError?: (err: unknown) => void): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10000);
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(1, 2, 3);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.3));
  const pivot = new THREE.Group();
  scene.add(pivot);

  let disposed = false;
  let raf = 0;
  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  loadGlbModel(url)
    .then((model) => {
      if (disposed) return;
      pivot.add(model.object);
      // Cadre le modèle : sa largeur ≈ 2 × ipd
      const dist = (model.ipd * 2.4) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / 2;
      camera.position.set(0, model.ipd * 0.15, dist);
      camera.near = dist / 100;
      camera.far = dist * 100;
      camera.updateProjectionMatrix();
      camera.lookAt(0, 0, 0);
    })
    .catch((err) => onError?.(err));

  const t0 = performance.now();
  const tick = () => {
    raf = requestAnimationFrame(tick);
    pivot.rotation.y = -0.4 + Math.sin((performance.now() - t0) / 1800) * 0.6;
    renderer.render(scene, camera);
  };
  tick();

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material as THREE.Material | THREE.Material[];
        (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
      }
    });
    pmrem.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
