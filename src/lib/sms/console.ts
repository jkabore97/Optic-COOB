import type { SmsProvider } from "./types";

/** Fournisseur de développement : affiche le SMS dans la console sans rien envoyer. */
export const consoleProvider: SmsProvider = {
  name: "console",
  async send({ to, body }) {
    console.log(`\n[SMS → ${to}]\n${body}\n`);
    return { ok: true, providerId: `console-${Date.now()}` };
  },
};
