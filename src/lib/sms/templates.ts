import { BUSINESS, getAgency } from "../config";
import { formatDateShortFr } from "../slots";
import type { Appointment, Order } from "../db/types";

/**
 * Modèles de SMS. Rester sous 160 caractères GSM-7 quand c'est possible
 * (les accents peuvent forcer l'encodage UCS-2 : 70 caractères / segment).
 */

export function appointmentConfirmationSms(a: Appointment): string {
  return (
    `${BUSINESS.shortName} Optique: RDV confirme le ${formatDateShortFr(a.date)} a ${a.time}, ${getAgency(a.agency).name}. ` +
    `Ref ${a.code}. Pour modifier: ${getAgency(a.agency).phoneDisplay}.`
  );
}

export function appointmentReminderSms(a: Appointment): string {
  return (
    `${BUSINESS.shortName} Optique: rappel de votre RDV demain ${formatDateShortFr(a.date)} a ${a.time}, ${getAgency(a.agency).name}. ` +
    `Ref ${a.code}. En cas d'empechement: ${getAgency(a.agency).phoneDisplay}.`
  );
}

export function orderReceivedSms(o: Order): string {
  return (
    `${BUSINESS.shortName} Optique: commande ${o.code} enregistree${o.frame ? ` (${o.frame})` : ""}. ` +
    `Nous vous enverrons un SMS des que vos lunettes seront pretes. Suivi: ${BUSINESS.siteUrl}/suivi`
  );
}

export function orderReadySms(o: Order): string {
  return (
    `${BUSINESS.shortName} Optique: bonne nouvelle, vos lunettes${o.frame ? ` (${o.frame})` : ""} sont pretes ! ` +
    `Passez les recuperer a l'${getAgency(o.agency).name} avec la ref ${o.code}. Infos: ${getAgency(o.agency).phoneDisplay}.`
  );
}
