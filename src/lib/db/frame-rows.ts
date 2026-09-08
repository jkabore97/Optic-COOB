import type { CatalogFrameRecord } from "./types";

type Row = Record<string, unknown>;
const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v));
const num = (v: unknown) => (v == null ? 0 : Number(v));
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : str(v));

/** Conversion d'une ligne SQL (Postgres ou SQLite) en enregistrement de monture. */
export function rowToFrame(r: Row): CatalogFrameRecord {
  return {
    id: str(r.id),
    slug: str(r.slug),
    name: str(r.name),
    collection: str(r.collection),
    shape: str(r.shape),
    material: str(r.material),
    color: str(r.color),
    gender: str(r.gender),
    priceFcfa: num(r.price_fcfa),
    sizeLens: num(r.size_lens),
    sizeBridge: num(r.size_bridge),
    sizeTemple: num(r.size_temple),
    description: str(r.description),
    tags: str(r.tags).split(",").map((t) => t.trim()).filter(Boolean),
    imageMime: r.image_mime == null ? null : str(r.image_mime),
    imageWidth: num(r.image_width),
    imageHeight: num(r.image_height),
    anchorLx: num(r.anchor_lx),
    anchorLy: num(r.anchor_ly),
    anchorRx: num(r.anchor_rx),
    anchorRy: num(r.anchor_ry),
    active: r.active === true || r.active === 1 || r.active === "1" || r.active === "true",
    sortOrder: num(r.sort_order),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}
