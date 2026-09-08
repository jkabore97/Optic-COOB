/**
 * Copie les fichiers WASM de MediaPipe (node_modules) vers public/mediapipe/wasm
 * pour les servir depuis notre propre domaine (pas de dépendance à un CDN tiers).
 * Exécuté automatiquement après `npm install` (postinstall).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = path.join(root, "public", "mediapipe", "wasm");

if (!existsSync(src)) {
  console.warn("[mediapipe] @mediapipe/tasks-vision introuvable, WASM non copié");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
let n = 0;
for (const f of readdirSync(src)) {
  copyFileSync(path.join(src, f), path.join(dest, f));
  n++;
}
console.log(`[mediapipe] ${n} fichiers WASM copiés dans public/mediapipe/wasm`);
