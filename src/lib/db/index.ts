import path from "node:path";
import { FileStore } from "./file-store";
import { PgStore } from "./pg-store";
import type { Store } from "./types";

export type { Store } from "./types";
export * from "./types";

declare global {
  var __coobStore: Store | undefined;
}

/**
 * Retourne le stockage configuré :
 * - DATABASE_URL défini → PostgreSQL (Supabase, Neon…)
 * - sinon → fichier JSON local (DATA_FILE, défaut ./data/store.json)
 */
export function getStore(): Store {
  if (globalThis.__coobStore) return globalThis.__coobStore;
  const url = process.env.DATABASE_URL;
  const store = url
    ? new PgStore(url)
    : new FileStore(
        process.env.DATA_FILE
          ? path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DATA_FILE)
          : path.join(process.cwd(), "data", "store.json"),
      );
  globalThis.__coobStore = store;
  return store;
}
