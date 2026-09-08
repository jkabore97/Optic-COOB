import { getStore } from "../db";
import type { SmsLog } from "../db/types";
import { consoleProvider } from "./console";
import { createOrangeProvider } from "./orange";
import { createTwilioProvider } from "./twilio";
import type { SmsProvider, SmsResult } from "./types";

export type { SmsProvider, SmsMessage, SmsResult } from "./types";
export * from "./templates";

let provider: SmsProvider | null = null;

/** Sélectionne le fournisseur selon SMS_PROVIDER = twilio | orange | console (défaut). */
export function getSmsProvider(): SmsProvider {
  if (provider) return provider;
  const which = (process.env.SMS_PROVIDER ?? "console").toLowerCase();
  switch (which) {
    case "twilio":
      provider = createTwilioProvider();
      break;
    case "orange":
      provider = createOrangeProvider();
      break;
    case "console":
      provider = consoleProvider;
      break;
    default:
      throw new Error(`SMS_PROVIDER inconnu : ${which}`);
  }
  return provider;
}

export interface SendOptions {
  relatedType?: SmsLog["relatedType"];
  relatedId?: string;
}

/**
 * Envoie un SMS et journalise le résultat. Ne lève jamais : un échec d'envoi
 * ne doit pas faire échouer une réservation ou une mise à jour de commande.
 */
export async function sendSms(to: string, body: string, opts: SendOptions = {}): Promise<SmsResult> {
  const store = getStore();
  let result: SmsResult;
  let providerName = "unknown";
  try {
    const p = getSmsProvider();
    providerName = p.name;
    result = await p.send({ to, body });
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!result.ok) console.error(`[SMS] échec vers ${to} (${providerName}) : ${result.error}`);
  await store
    .logSms({
      to,
      body,
      provider: providerName,
      status: result.ok ? "sent" : "failed",
      providerId: result.providerId ?? null,
      error: result.error ?? null,
      relatedType: opts.relatedType ?? null,
      relatedId: opts.relatedId ?? null,
    })
    .catch((e) => console.error("[SMS] journalisation impossible", e));
  return result;
}
