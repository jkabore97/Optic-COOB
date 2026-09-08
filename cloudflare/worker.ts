/**
 * Point d'entrée Cloudflare Workers : sert l'application Next.js (générée par
 * @opennextjs/cloudflare dans .open-next/) et ajoute un déclencheur planifié pour
 * les SMS de rappel de rendez-vous (voir `triggers.crons` dans wrangler.jsonc).
 */
// Ce fichier est bundlé par wrangler (esbuild) et volontairement hors du typecheck de
// l'application : `.open-next/worker.js` n'existe qu'après `opennextjs-cloudflare build`.
import app from "../.open-next/worker.js";

interface Env {
  CRON_SECRET?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}

const worker = {
  fetch: app.fetch,
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    if (!env.CRON_SECRET || !env.NEXT_PUBLIC_SITE_URL) return;
    ctx.waitUntil(
      fetch(`${env.NEXT_PUBLIC_SITE_URL}/api/cron/reminders`, {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }),
    );
  },
};

export default worker;
