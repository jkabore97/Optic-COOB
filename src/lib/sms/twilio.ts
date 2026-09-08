import type { SmsProvider } from "./types";

/**
 * Twilio (https://www.twilio.com) — couvre le Burkina Faso (+226).
 * Variables : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, et TWILIO_FROM (numéro) ou
 * TWILIO_MESSAGING_SERVICE_SID.
 */
export function createTwilioProvider(env: NodeJS.ProcessEnv = process.env): SmsProvider {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM;
  const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || (!from && !messagingServiceSid)) {
    throw new Error(
      "Twilio : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM (ou TWILIO_MESSAGING_SERVICE_SID) sont requis",
    );
  }
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  return {
    name: "twilio",
    async send({ to, body }) {
      const params = new URLSearchParams({ To: to, Body: body });
      if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
      else params.set("From", from!);

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });
      const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
      if (!res.ok) return { ok: false, error: json.message ?? `HTTP ${res.status}` };
      return { ok: true, providerId: json.sid };
    },
  };
}
