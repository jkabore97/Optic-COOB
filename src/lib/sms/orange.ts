import type { SmsProvider } from "./types";

/**
 * Orange SMS API (https://developer.orange.com/apis/sms) — disponible au Burkina Faso.
 * Variables : ORANGE_CLIENT_ID, ORANGE_CLIENT_SECRET, ORANGE_SENDER (numéro dédié, ex. +2260000),
 * ORANGE_SENDER_NAME (optionnel, nom d'expéditeur alphanumérique validé par Orange).
 */
export function createOrangeProvider(env: NodeJS.ProcessEnv = process.env): SmsProvider {
  const clientId = env.ORANGE_CLIENT_ID;
  const clientSecret = env.ORANGE_CLIENT_SECRET;
  const sender = env.ORANGE_SENDER;
  const senderName = env.ORANGE_SENDER_NAME;
  if (!clientId || !clientSecret || !sender) {
    throw new Error("Orange SMS : ORANGE_CLIENT_ID, ORANGE_CLIENT_SECRET et ORANGE_SENDER sont requis");
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  let cached: { token: string; expiresAt: number } | null = null;

  async function token(): Promise<string> {
    if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
    const res = await fetch("https://api.orange.com/oauth/v3/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`Orange OAuth HTTP ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return cached.token;
  }

  return {
    name: "orange",
    async send({ to, body }) {
      const bearer = await token();
      const senderAddress = `tel:${sender}`;
      const url = `https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(senderAddress)}/requests`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: `tel:${to}`,
            senderAddress,
            ...(senderName ? { senderName } : {}),
            outboundSMSTextMessage: { message: body },
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        outboundSMSMessageRequest?: { resourceURL?: string };
        requestError?: { serviceException?: { text?: string }; policyException?: { text?: string } };
      };
      if (!res.ok) {
        const err = json.requestError?.serviceException?.text ?? json.requestError?.policyException?.text;
        return { ok: false, error: err ?? `HTTP ${res.status}` };
      }
      const resource = json.outboundSMSMessageRequest?.resourceURL;
      return { ok: true, providerId: resource?.split("/").pop() };
    },
  };
}
