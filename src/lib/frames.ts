/**
 * Catalogue des montures. Les prix sont indicatifs (à ajuster) et les visuels
 * sont générés dans public/frames/ par `npm run frames`.
 *
 * Repère commun à tous les visuels (viewBox 1000×400) : centres des verres en
 * (290,200) et (710,200). L'essayage virtuel aligne ces deux points sur les pupilles.
 */

export type FrameShape =
  | "rond"
  | "ovale"
  | "rectangle"
  | "carre"
  | "wayfarer"
  | "papillon"
  | "aviateur"
  | "browline";

export type FrameMaterial = "acetate" | "metal" | "titane" | "tr90";
export type FrameGender = "homme" | "femme" | "mixte" | "enfant";

export type FrameColor =
  | "noir"
  | "ecaille"
  | "dore"
  | "argent"
  | "bleu"
  | "bordeaux"
  | "cristal"
  | "vert"
  | "rose-dore"
  | "gris";

export interface Frame {
  slug: string;
  name: string;
  collection: string;
  shape: FrameShape;
  material: FrameMaterial;
  color: FrameColor;
  gender: FrameGender;
  /** Prix indicatif en FCFA (monture seule). */
  priceFcfa: number;
  /** Largeur verre / pont / branche, en mm. */
  size: [number, number, number];
  description: string;
  tags?: string[];
}

export const SHAPE_LABELS: Record<FrameShape, string> = {
  rond: "Rond",
  ovale: "Ovale",
  rectangle: "Rectangle",
  carre: "Carré",
  wayfarer: "Wayfarer",
  papillon: "Papillon",
  aviateur: "Aviateur",
  browline: "Browline",
};

export const MATERIAL_LABELS: Record<FrameMaterial, string> = {
  acetate: "Acétate",
  metal: "Métal",
  titane: "Titane",
  tr90: "TR90 (souple)",
};

export const GENDER_LABELS: Record<FrameGender, string> = {
  homme: "Homme",
  femme: "Femme",
  mixte: "Mixte",
  enfant: "Enfant",
};

export const COLOR_LABELS: Record<FrameColor, string> = {
  noir: "Noir",
  ecaille: "Écaille",
  dore: "Doré",
  argent: "Argent",
  bleu: "Bleu nuit",
  bordeaux: "Bordeaux",
  cristal: "Cristal",
  vert: "Vert forêt",
  "rose-dore": "Rose doré",
  gris: "Gris",
};

/** Couleur d'aperçu (pastille) pour chaque coloris. */
export const COLOR_SWATCH: Record<FrameColor, string> = {
  noir: "#1a1a1a",
  ecaille: "#6b3d1a",
  dore: "#c9a24a",
  argent: "#b8bcc4",
  bleu: "#1f3a68",
  bordeaux: "#6b1f2a",
  cristal: "#dfe6ee",
  vert: "#2f5d46",
  "rose-dore": "#d3a08b",
  gris: "#5b6068",
};

export const FRAMES: Frame[] = [
  {
    slug: "kadiogo-noir",
    name: "Kadiogo",
    collection: "COOB Essentiel",
    shape: "rectangle",
    material: "acetate",
    color: "noir",
    gender: "homme",
    priceFcfa: 25000,
    size: [54, 18, 145],
    description: "Le classique du bureau : rectangle sobre en acétate noir, confortable toute la journée.",
    tags: ["best-seller"],
  },
  {
    slug: "kadiogo-ecaille",
    name: "Kadiogo",
    collection: "COOB Essentiel",
    shape: "rectangle",
    material: "acetate",
    color: "ecaille",
    gender: "mixte",
    priceFcfa: 25000,
    size: [54, 18, 145],
    description: "Même coupe que le Kadiogo noir, dans un acétate écaille chaleureux.",
  },
  {
    slug: "yennenga-papillon",
    name: "Yennenga",
    collection: "COOB Signature",
    shape: "papillon",
    material: "acetate",
    color: "bordeaux",
    gender: "femme",
    priceFcfa: 38000,
    size: [53, 17, 140],
    description: "Une monture papillon affirmée, bordeaux profond, qui relève le regard.",
    tags: ["nouveauté"],
  },
  {
    slug: "yennenga-noir",
    name: "Yennenga",
    collection: "COOB Signature",
    shape: "papillon",
    material: "acetate",
    color: "noir",
    gender: "femme",
    priceFcfa: 38000,
    size: [53, 17, 140],
    description: "Le papillon Yennenga en noir brillant, intemporel.",
  },
  {
    slug: "sahel-aviateur",
    name: "Sahel",
    collection: "COOB Signature",
    shape: "aviateur",
    material: "metal",
    color: "dore",
    gender: "mixte",
    priceFcfa: 42000,
    size: [58, 14, 140],
    description: "Aviateur en métal doré, double pont. Parfait avec des verres solaires teintés.",
    tags: ["solaire"],
  },
  {
    slug: "sahel-argent",
    name: "Sahel",
    collection: "COOB Signature",
    shape: "aviateur",
    material: "metal",
    color: "argent",
    gender: "mixte",
    priceFcfa: 42000,
    size: [58, 14, 140],
    description: "L'aviateur Sahel en finition argent brossé.",
  },
  {
    slug: "nazinga-rond",
    name: "Nazinga",
    collection: "COOB Atelier",
    shape: "rond",
    material: "titane",
    color: "dore",
    gender: "mixte",
    priceFcfa: 55000,
    size: [48, 21, 145],
    description: "Rond fin en titane ultra-léger : moins de 10 g sur le nez.",
    tags: ["léger"],
  },
  {
    slug: "nazinga-gris",
    name: "Nazinga",
    collection: "COOB Atelier",
    shape: "rond",
    material: "titane",
    color: "gris",
    gender: "mixte",
    priceFcfa: 55000,
    size: [48, 21, 145],
    description: "Le rond Nazinga en titane gris mat, discret et résistant.",
  },
  {
    slug: "ouaga-carre",
    name: "Ouaga",
    collection: "COOB Essentiel",
    shape: "carre",
    material: "acetate",
    color: "bleu",
    gender: "homme",
    priceFcfa: 28000,
    size: [52, 19, 145],
    description: "Carré épais bleu nuit, pour un look moderne et assumé.",
  },
  {
    slug: "ouaga-cristal",
    name: "Ouaga",
    collection: "COOB Essentiel",
    shape: "carre",
    material: "acetate",
    color: "cristal",
    gender: "mixte",
    priceFcfa: 28000,
    size: [52, 19, 145],
    description: "Le carré Ouaga en acétate cristal transparent, très tendance.",
    tags: ["nouveauté"],
  },
  {
    slug: "bobo-wayfarer",
    name: "Bobo",
    collection: "COOB Essentiel",
    shape: "wayfarer",
    material: "acetate",
    color: "noir",
    gender: "mixte",
    priceFcfa: 30000,
    size: [52, 20, 145],
    description: "Le wayfarer indémodable, en acétate noir mat.",
    tags: ["best-seller"],
  },
  {
    slug: "bobo-ecaille",
    name: "Bobo",
    collection: "COOB Essentiel",
    shape: "wayfarer",
    material: "acetate",
    color: "ecaille",
    gender: "mixte",
    priceFcfa: 30000,
    size: [52, 20, 145],
    description: "Le wayfarer Bobo en écaille, chaleureux et lumineux.",
  },
  {
    slug: "loumbila-browline",
    name: "Loumbila",
    collection: "COOB Atelier",
    shape: "browline",
    material: "metal",
    color: "noir",
    gender: "homme",
    priceFcfa: 48000,
    size: [51, 21, 145],
    description: "Browline : sourcil acétate noir sur cerclage métal doré. Élégance rétro.",
  },
  {
    slug: "sindou-ovale",
    name: "Sindou",
    collection: "COOB Atelier",
    shape: "ovale",
    material: "metal",
    color: "rose-dore",
    gender: "femme",
    priceFcfa: 45000,
    size: [50, 19, 140],
    description: "Ovale fin en métal rose doré, féminin et léger.",
  },
  {
    slug: "sindou-vert",
    name: "Sindou",
    collection: "COOB Atelier",
    shape: "ovale",
    material: "acetate",
    color: "vert",
    gender: "femme",
    priceFcfa: 35000,
    size: [50, 19, 140],
    description: "L'ovale Sindou en acétate vert forêt, une touche de couleur en douceur.",
  },
  {
    slug: "petit-tenkodogo",
    name: "Petit Tenkodogo",
    collection: "COOB Kids",
    shape: "rond",
    material: "tr90",
    color: "bleu",
    gender: "enfant",
    priceFcfa: 18000,
    size: [44, 16, 125],
    description: "Rond souple et incassable en TR90 pour les enfants de 5 à 10 ans.",
    tags: ["enfant"],
  },
  {
    slug: "petit-tenkodogo-bordeaux",
    name: "Petit Tenkodogo",
    collection: "COOB Kids",
    shape: "rond",
    material: "tr90",
    color: "bordeaux",
    gender: "enfant",
    priceFcfa: 18000,
    size: [44, 16, 125],
    description: "Le rond enfant Petit Tenkodogo en bordeaux.",
    tags: ["enfant"],
  },
  {
    slug: "reo-rectangle-titane",
    name: "Réo",
    collection: "COOB Atelier",
    shape: "rectangle",
    material: "titane",
    color: "argent",
    gender: "homme",
    priceFcfa: 60000,
    size: [55, 17, 145],
    description: "Rectangle fin en titane argent, hypoallergénique et quasi invisible.",
    tags: ["léger"],
  },
];

export function getFrame(slug: string): Frame | undefined {
  return FRAMES.find((f) => f.slug === slug);
}

export function frameImageUrl(frame: Pick<Frame, "slug">): string {
  return `/frames/${frame.slug}.svg`;
}

export function formatFcfa(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount).replace(/ | /g, " ")} FCFA`;
}
