/**
 * Informations de l'entreprise et réglages métier.
 * Tout ce qui est spécifique à COOB se règle ici (ou via variables d'environnement).
 */

export interface Agency {
  /** Identifiant stable (stocké avec les rendez-vous et commandes). */
  id: string;
  name: string;
  city: string;
  phoneDisplay: string;
  phoneE164: string;
  address: string;
  mapsUrl: string;
  /** Agence principale (par défaut dans les formulaires). */
  main?: boolean;
}

const mapsSearch = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

/** Variable d'environnement non vide, sinon la valeur par défaut. */
const env = (name: string, fallback: string): string => {
  const v = process.env[name]?.trim();
  return v ? v : fallback;
};

/**
 * URL publique du site : NEXT_PUBLIC_SITE_URL si valide, sinon l'URL fournie par
 * l'hébergeur (Vercel), sinon le domaine par défaut.
 */
function resolveSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    "https://coob-optique.bf",
  ];
  for (const c of candidates) {
    const v = c?.trim();
    if (!v) continue;
    try {
      return new URL(v).origin;
    } catch {
      // valeur invalide : on passe à la suivante
    }
  }
  return "https://coob-optique.bf";
}

export const AGENCIES: Agency[] = [
  {
    id: "koulouba",
    name: "Agence Koulouba",
    city: "Ouagadougou",
    phoneDisplay: "+226 25 30 70 28",
    phoneE164: "+22625307028",
    address: env("NEXT_PUBLIC_ADDRESS_KOULOUBA", "Koulouba, Ouagadougou"),
    mapsUrl: env("NEXT_PUBLIC_MAPS_KOULOUBA", mapsSearch("COOB Optique Koulouba Ouagadougou")),
    main: true,
  },
  {
    id: "gounghin",
    name: "Agence Gounghin",
    city: "Ouagadougou",
    phoneDisplay: "+226 78 39 38 15",
    phoneE164: "+22678393815",
    address: env("NEXT_PUBLIC_ADDRESS_GOUNGHIN", "Gounghin, Ouagadougou"),
    mapsUrl: env("NEXT_PUBLIC_MAPS_GOUNGHIN", mapsSearch("COOB Optique Gounghin Ouagadougou")),
  },
  {
    id: "bobo",
    name: "Agence Bobo",
    city: "Bobo-Dioulasso",
    phoneDisplay: "+226 20 98 38 04",
    phoneE164: "+22620983804",
    address: env("NEXT_PUBLIC_ADDRESS_BOBO", "Bobo-Dioulasso"),
    mapsUrl: env("NEXT_PUBLIC_MAPS_BOBO", mapsSearch("COOB Optique Bobo-Dioulasso")),
  },
];

export const MAIN_AGENCY = AGENCIES.find((a) => a.main) ?? AGENCIES[0];

export function getAgency(id: string | null | undefined): Agency {
  return AGENCIES.find((a) => a.id === id) ?? MAIN_AGENCY;
}

export const BUSINESS = {
  name: "COOB Optique",
  shortName: "COOB",
  legalName: "Centre d'Optique et d'Optométrie du Burkina",
  tagline: "La garantie de bien voir",
  award: "Élue meilleure agence de l'année 2025",
  phoneDisplay: MAIN_AGENCY.phoneDisplay,
  phoneE164: MAIN_AGENCY.phoneE164,
  /** Numéro WhatsApp (sans +). */
  whatsapp: env("NEXT_PUBLIC_WHATSAPP_NUMBER", "22678393815"),
  whatsappDisplay: "+226 78 39 38 15",
  address: MAIN_AGENCY.address,
  city: "Ouagadougou",
  country: "Burkina Faso",
  mapsUrl: MAIN_AGENCY.mapsUrl,
  reviewsUrl: env("NEXT_PUBLIC_REVIEWS_URL", MAIN_AGENCY.mapsUrl),
  reviewCount: 175,
  facebookUrl: env("NEXT_PUBLIC_FACEBOOK_URL", ""),
  instagramUrl: env("NEXT_PUBLIC_INSTAGRAM_URL", ""),
  timeZone: "Africa/Ouagadougou",
  siteUrl: resolveSiteUrl(),
} as const;

/** Marques distribuées (affichées sur la page d'accueil). */
export const BRANDS = [
  "Ray-Ban",
  "Gucci",
  "Prada",
  "Dior",
  "Cartier",
  "Tom Ford",
  "Versace",
  "Emporio Armani",
  "Boss",
  "Carrera",
  "Persol",
  "D&G",
  "Chopard",
  "Silhouette",
  "Tommy Hilfiger",
  "Dsquared2",
  "Polaroid",
  "Adidas",
];

/** Jour de la semaine : 0 = dimanche … 6 = samedi */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface OpeningPeriod {
  /** "HH:MM" */
  open: string;
  /** "HH:MM" */
  close: string;
}

/**
 * Horaires d'ouverture (communs aux agences). Hypothèse : lun–ven 08h–12h30 / 15h–18h,
 * sam 08h–13h, fermé dimanche. À ajuster selon les horaires réels.
 */
export const OPENING_HOURS: Record<Weekday, OpeningPeriod[]> = {
  0: [],
  1: [
    { open: "08:00", close: "12:30" },
    { open: "15:00", close: "18:00" },
  ],
  2: [
    { open: "08:00", close: "12:30" },
    { open: "15:00", close: "18:00" },
  ],
  3: [
    { open: "08:00", close: "12:30" },
    { open: "15:00", close: "18:00" },
  ],
  4: [
    { open: "08:00", close: "12:30" },
    { open: "15:00", close: "18:00" },
  ],
  5: [
    { open: "08:00", close: "12:30" },
    { open: "15:00", close: "18:00" },
  ],
  6: [{ open: "08:00", close: "13:00" }],
};

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "Dimanche",
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
};

/** Durée d'un créneau d'examen de vue, en minutes. */
export const SLOT_MINUTES = 30;

/** Nombre de rendez-vous acceptés par créneau et par agence. */
export const SLOT_CAPACITY = 1;

/** Jusqu'à combien de jours à l'avance on peut réserver. */
export const BOOKING_HORIZON_DAYS = 30;

export const EXAM_REASONS = [
  { value: "examen", label: "Examen de vue complet" },
  { value: "renouvellement", label: "Renouvellement de lunettes" },
  { value: "lentilles", label: "Adaptation lentilles de contact" },
  { value: "enfant", label: "Examen de vue enfant" },
  { value: "reparation", label: "Réparation / ajustage" },
  { value: "autre", label: "Autre" },
] as const;

export type ExamReason = (typeof EXAM_REASONS)[number]["value"];
