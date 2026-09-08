import path from "node:path";
import { D1Store } from "./d1-store";
import { FileStore } from "./file-store";
import { PgStore } from "./pg-store";
import type { Store } from "./types";

export type { Store } from "./types";
export * from "./types";

declare global {
  var __coobStore: Store | undefined;
}

/**
 * Retourne le stockage configuré, dans cet ordre :
 * 1. Cloudflare D1 si un binding `DB` est présent (déploiement Cloudflare Workers) ;
 * 2. PostgreSQL si DATABASE_URL est défini (Supabase, Neon…) ;
 * 3. sinon un fichier JSON local (DATA_FILE, défaut ./data/store.json).
 */
export function getStore(): Store {
  if (globalThis.__coobStore) return globalThis.__coobStore;

  const d1 = getD1Binding();
  const url = process.env.DATABASE_URL;
  const store = d1
    ? new D1Store(d1)
    : url
      ? new PgStore(url)
      : new FileStore(
          process.env.DATA_FILE
            ? path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DATA_FILE)
            : path.join(process.cwd(), "data", "store.json"),
        );
  // Sur Cloudflare, le binding est lié à la requête : ne pas mettre en cache globalement.
  if (!d1) globalThis.__coobStore = store;
  return store;
}

/** Binding D1 exposé par @opennextjs/cloudflare (undefined hors de Cloudflare). */
function getD1Binding(): import("@cloudflare/workers-types").D1Database | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as typeof import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as { DB?: import("@cloudflare/workers-types").D1Database };
    return env.DB;
  } catch {
    return undefined;
  }
}
