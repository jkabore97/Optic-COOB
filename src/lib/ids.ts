import { randomBytes, randomUUID } from "node:crypto";

/** Alphabet sans caractères ambigus (pas de 0/O, 1/I/L). */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function shortCode(length = 5): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function newId(): string {
  return randomUUID();
}

/** Référence client lisible, ex. "COOB-7KX4M" */
export function orderCode(): string {
  return `COOB-${shortCode(5)}`;
}

/** Référence de rendez-vous, ex. "RDV-4T7PQ" */
export function appointmentCode(): string {
  return `RDV-${shortCode(5)}`;
}
