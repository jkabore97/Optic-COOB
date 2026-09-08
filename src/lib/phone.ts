/**
 * Normalisation des numéros de téléphone burkinabè (indicatif +226, 8 chiffres).
 * Accepte : "70 12 34 56", "+226 70 12 34 56", "0022670123456", "22670123456".
 */

const BF_COUNTRY_CODE = "226";

export function normalizeBurkinaPhone(input: string): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith(BF_COUNTRY_CODE)) {
    digits = digits.slice(3);
  }
  if (!/^\d{8}$/.test(digits)) return null;
  // Les numéros burkinabè commencent par 0, 5, 6 ou 7 (mobiles) ou 2 (fixes).
  if (!/^[02567]/.test(digits)) return null;
  return `+${BF_COUNTRY_CODE}${digits}`;
}

/** "+22670123456" → "70 12 34 56" */
export function formatPhoneLocal(e164: string): string {
  const local = e164.replace(/^\+?226/, "");
  return local.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

/** "+22670123456" → "+226 70 12 34 56" */
export function formatPhoneInternational(e164: string): string {
  return `+226 ${formatPhoneLocal(e164)}`;
}
