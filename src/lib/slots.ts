import {
  BOOKING_HORIZON_DAYS,
  BUSINESS,
  OPENING_HOURS,
  SLOT_CAPACITY,
  SLOT_MINUTES,
  type Weekday,
} from "./config";

/** "HH:MM" → minutes depuis minuit */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** minutes depuis minuit → "HH:MM" */
export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Date locale (Ouagadougou, UTC+0) au format YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Heure locale "HH:MM" à Ouagadougou. */
export function nowHHMM(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export function isValidISODate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(date);
}

export function weekdayOf(date: string): Weekday {
  return new Date(`${date}T00:00:00Z`).getUTCDay() as Weekday;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Tous les créneaux théoriques d'une journée, selon les horaires d'ouverture. */
export function allSlotsForDate(date: string): string[] {
  const periods = OPENING_HOURS[weekdayOf(date)];
  const slots: string[] = [];
  for (const p of periods) {
    const open = toMinutes(p.open);
    const close = toMinutes(p.close);
    for (let t = open; t + SLOT_MINUTES <= close; t += SLOT_MINUTES) {
      slots.push(toHHMM(t));
    }
  }
  return slots;
}

export interface SlotAvailability {
  time: string;
  available: boolean;
}

/**
 * Créneaux disponibles pour une date, en tenant compte des réservations
 * existantes et de l'heure courante (pas de réservation dans le passé).
 */
export function availableSlots(
  date: string,
  bookedTimes: string[],
  now: Date = new Date(),
): SlotAvailability[] {
  const counts = new Map<string, number>();
  for (const t of bookedTimes) counts.set(t, (counts.get(t) ?? 0) + 1);

  const today = todayISO(now);
  const horizon = addDays(today, BOOKING_HORIZON_DAYS);
  if (date < today || date > horizon) return [];

  const cutoff = date === today ? toMinutes(nowHHMM(now)) + SLOT_MINUTES : -1;

  return allSlotsForDate(date).map((time) => ({
    time,
    available:
      (counts.get(time) ?? 0) < SLOT_CAPACITY && toMinutes(time) > cutoff,
  }));
}

/** Formatte une date ISO en français long : "lundi 14 septembre 2026". */
export function formatDateFr(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** "14/09/2026" */
export function formatDateShortFr(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}
