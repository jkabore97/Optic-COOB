/**
 * Génère les visuels SVG des montures dans public/frames/.
 * Repère : viewBox 0 0 1000 400, centres des verres en (290,200) et (710,200).
 *
 *   node scripts/generate-frames.mts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BUILTIN_FRAMES as FRAMES, type Frame, type FrameColor, type FrameShape } from "../src/lib/frames.ts";

const OUT = path.resolve(import.meta.dirname, "../public/frames");
const CX = 290; // centre du verre gauche ; le droit est en 1000 - CX
const CY = 200;

interface Palette {
  main: string;
  dark: string;
  light: string;
  lensTint: string;
  pattern?: string;
}

const PALETTES: Record<FrameColor, Palette> = {
  noir: { main: "#1a1a1a", dark: "#050505", light: "#3a3a3a", lensTint: "rgba(120,160,200,0.10)" },
  ecaille: {
    main: "url(#ecaille)",
    dark: "#3a1d08",
    light: "#a8672e",
    lensTint: "rgba(200,170,120,0.10)",
    pattern: `<pattern id="ecaille" patternUnits="userSpaceOnUse" width="60" height="44">
      <rect width="60" height="44" fill="#8a4c1f"/>
      <ellipse cx="14" cy="12" rx="13" ry="9" fill="#3d1e07" opacity="0.85"/>
      <ellipse cx="44" cy="30" rx="15" ry="10" fill="#2e1504" opacity="0.8"/>
      <ellipse cx="50" cy="6" rx="7" ry="5" fill="#c47a35" opacity="0.6"/>
      <ellipse cx="6" cy="36" rx="9" ry="6" fill="#c47a35" opacity="0.5"/>
    </pattern>`,
  },
  dore: { main: "#c9a24a", dark: "#8a6a24", light: "#f0d786", lensTint: "rgba(255,220,150,0.10)" },
  argent: { main: "#b8bcc4", dark: "#6f747c", light: "#eef0f3", lensTint: "rgba(180,200,220,0.10)" },
  bleu: { main: "#1f3a68", dark: "#0e1d38", light: "#3d5f9a", lensTint: "rgba(120,160,220,0.10)" },
  bordeaux: { main: "#6b1f2a", dark: "#3b0d14", light: "#9a3b48", lensTint: "rgba(220,150,160,0.10)" },
  cristal: {
    main: "rgba(220,230,240,0.55)",
    dark: "rgba(150,165,180,0.9)",
    light: "rgba(255,255,255,0.9)",
    lensTint: "rgba(200,220,240,0.08)",
  },
  vert: { main: "#2f5d46", dark: "#173124", light: "#4f8a6b", lensTint: "rgba(150,210,180,0.10)" },
  "rose-dore": { main: "#d3a08b", dark: "#9a6350", light: "#f4d2c3", lensTint: "rgba(255,200,190,0.10)" },
  gris: { main: "#5b6068", dark: "#2f3237", light: "#8d929a", lensTint: "rgba(180,190,200,0.10)" },
};

/** Contour d'un verre centré en (0,0). Retourne le `d` du path et sa demi-largeur. */
function lensPath(shape: FrameShape): { d: string; halfW: number; halfH: number; topY: number } {
  switch (shape) {
    case "rond": {
      const r = 104;
      return { d: `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 Z`, halfW: r, halfH: r, topY: -r };
    }
    case "ovale": {
      const rx = 118, ry = 78;
      return { d: `M ${-rx} 0 A ${rx} ${ry} 0 1 0 ${rx} 0 A ${rx} ${ry} 0 1 0 ${-rx} 0 Z`, halfW: rx, halfH: ry, topY: -ry };
    }
    case "rectangle": {
      const w = 118, h = 70, r = 28;
      return { d: roundedRect(w, h, r), halfW: w, halfH: h, topY: -h };
    }
    case "carre": {
      const w = 112, h = 92, r = 34;
      return { d: roundedRect(w, h, r), halfW: w, halfH: h, topY: -h };
    }
    case "wayfarer":
      // Coin extérieur haut relevé, bas plus étroit. Gauche = extérieur (x négatif).
      return {
        d: `M -128 -76 C -60 -92 40 -90 110 -70 C 128 -64 130 -50 126 -30
            C 118 20 105 70 80 84 C 40 100 -60 96 -100 80 C -122 70 -132 40 -134 0
            C -136 -30 -136 -60 -128 -76 Z`,
        halfW: 134,
        halfH: 92,
        topY: -90,
      };
    case "papillon":
      return {
        d: `M -140 -70 C -90 -70 -20 -60 115 -68 C 130 -66 128 -40 122 -14
            C 112 40 96 76 60 84 C 20 92 -60 88 -100 70 C -128 58 -140 20 -142 -20
            C -143 -45 -144 -66 -140 -70 Z`,
        halfW: 142,
        halfH: 88,
        topY: -70,
      };
    case "aviateur":
      return {
        d: `M -130 -70 C -80 -100 60 -100 118 -74 C 134 -66 134 -40 128 -14
            C 116 50 90 108 40 122 C -10 136 -80 124 -110 90 C -136 60 -142 0 -134 -50
            C -133 -62 -132 -68 -130 -70 Z`,
        halfW: 134,
        halfH: 128,
        topY: -92,
      };
    case "browline": {
      const w = 116, h = 74, r = 30;
      return { d: roundedRect(w, h, r), halfW: w, halfH: h, topY: -h };
    }
  }
}

function roundedRect(hw: number, hh: number, r: number): string {
  return `M ${-hw + r} ${-hh} H ${hw - r} A ${r} ${r} 0 0 1 ${hw} ${-hh + r}
    V ${hh - r} A ${r} ${r} 0 0 1 ${hw - r} ${hh} H ${-hw + r}
    A ${r} ${r} 0 0 1 ${-hw} ${hh - r} V ${-hh + r} A ${r} ${r} 0 0 1 ${-hw + r} ${-hh} Z`;
}

function render(frame: Frame): string {
  const p = PALETTES[frame.color];
  const thin = frame.material === "metal" || frame.material === "titane";
  const rim = thin ? 9 : frame.shape === "wayfarer" || frame.shape === "carre" ? 24 : 18;
  const { d, halfW, topY } = lensPath(frame.shape);
  const innerX = CX + halfW; // bord intérieur du verre gauche
  const outerX = CX - halfW; // bord extérieur du verre gauche
  const bridgeY = CY + topY + rim * 0.6 + 8;

  // Pont
  const bridge = thin
    ? `<path d="M ${innerX - 4} ${bridgeY + 6} C ${innerX + 30} ${bridgeY - 24} ${1000 - innerX - 30} ${bridgeY - 24} ${1000 - innerX + 4} ${bridgeY + 6}"
         fill="none" stroke="${p.main}" stroke-width="${rim}" stroke-linecap="round"/>
       ${frame.shape === "aviateur" ? `<path d="M ${innerX - 4} ${bridgeY + 26} C ${innerX + 30} ${bridgeY + 6} ${1000 - innerX - 30} ${bridgeY + 6} ${1000 - innerX + 4} ${bridgeY + 26}" fill="none" stroke="${p.main}" stroke-width="${rim * 0.8}" stroke-linecap="round"/>` : ""}
       <ellipse cx="${innerX + 8}" cy="${CY + 26}" rx="7" ry="12" fill="rgba(230,235,240,0.55)" stroke="${p.dark}" stroke-width="2"/>
       <ellipse cx="${1000 - innerX - 8}" cy="${CY + 26}" rx="7" ry="12" fill="rgba(230,235,240,0.55)" stroke="${p.dark}" stroke-width="2"/>`
    : `<path d="M ${innerX - rim / 2} ${bridgeY + 4} C ${innerX + 24} ${bridgeY - 18} ${1000 - innerX - 24} ${bridgeY - 18} ${1000 - innerX + rim / 2} ${bridgeY + 4}
         L ${1000 - innerX + rim / 2} ${bridgeY + 4 + rim} C ${1000 - innerX - 24} ${bridgeY - 18 + rim} ${innerX + 24} ${bridgeY - 18 + rim} ${innerX - rim / 2} ${bridgeY + 4 + rim} Z"
         fill="${p.main}" stroke="${p.dark}" stroke-width="2"/>`;

  // Charnières / départ de branches (vue de face)
  const hingeY = CY + topY + rim + 14;
  const hingeW = thin ? 16 : 30;
  const hingeH = thin ? 12 : 26;
  const hinges = `
    <rect x="${outerX - hingeW - rim / 2 + 4}" y="${hingeY}" width="${hingeW}" height="${hingeH}" rx="4" fill="${p.main}" stroke="${p.dark}" stroke-width="2"/>
    <rect x="${1000 - outerX + rim / 2 - 4}" y="${hingeY}" width="${hingeW}" height="${hingeH}" rx="4" fill="${p.main}" stroke="${p.dark}" stroke-width="2"/>`;

  // Sourcil browline
  const brow =
    frame.shape === "browline"
      ? `<path d="M ${outerX - 10} ${CY + topY + 4} C ${CX - 40} ${CY + topY - 30} ${CX + 60} ${CY + topY - 30} ${innerX + 12} ${CY + topY + 2}
           L ${innerX + 12} ${CY + topY + 28} C ${CX + 60} ${CY + topY + 2} ${CX - 40} ${CY + topY + 2} ${outerX - 10} ${CY + topY + 30} Z"
           fill="#1a1a1a" stroke="#050505" stroke-width="2"/>`
      : "";
  const browMirror = brow ? `<g transform="translate(1000,0) scale(-1,1)">${brow}</g>` : "";

  const lens = (mirror: boolean) => `
    <g transform="${mirror ? `translate(1000,0) scale(-1,1)` : ""} translate(${CX},${CY})">
      <path d="${d}" fill="${p.lensTint}"/>
      <path d="${d}" fill="url(#glare)" opacity="0.9"/>
      <path d="${d}" fill="none" stroke="${p.dark}" stroke-width="${rim + 4}" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="${p.main}" stroke-width="${rim}" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="${p.light}" stroke-width="${Math.max(2, rim * 0.18)}" stroke-linejoin="round" opacity="0.55"
            transform="translate(${-rim * 0.18},${-rim * 0.18})"/>
    </g>`;

  // Léger décalage vertical : la monture s'assoit un peu au-dessus des pupilles.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 400" width="1000" height="400" role="img" aria-label="${frame.name} ${frame.color}">
  <defs>
    ${p.pattern ?? ""}
    <linearGradient id="glare" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="0.02"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.10"/>
    </linearGradient>
  </defs>
  <g>
    ${hinges}
    ${lens(false)}
    ${lens(true)}
    ${bridge}
    ${brow}${browMirror}
  </g>
</svg>
`;
}

mkdirSync(OUT, { recursive: true });
for (const frame of FRAMES) {
  writeFileSync(path.join(OUT, `${frame.slug}.svg`), render(frame));
}
console.log(`${FRAMES.length} visuels générés dans ${OUT}`);
