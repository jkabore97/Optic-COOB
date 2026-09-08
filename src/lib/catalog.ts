import "server-only";
import { getStore } from "./db";
import type { CatalogFrameRecord } from "./db/types";
import {
  BUILTIN_FRAMES,
  type Frame,
  type FrameColor,
  type FrameGender,
  type FrameMaterial,
  type FrameShape,
} from "./frames";

/** URL (versionnée pour le cache) de la photo d'une monture gérée en base. */
export function frameRecordImageUrl(r: Pick<CatalogFrameRecord, "id" | "updatedAt">): string {
  return `/api/frames/${r.id}/image?v=${Date.parse(r.updatedAt) || 0}`;
}

export function recordToFrame(r: CatalogFrameRecord): Frame {
  return {
    id: r.id,
    source: "db",
    slug: r.slug,
    name: r.name,
    collection: r.collection,
    shape: r.shape as FrameShape,
    material: r.material as FrameMaterial,
    color: r.color as FrameColor,
    gender: r.gender as FrameGender,
    priceFcfa: r.priceFcfa,
    size: [r.sizeLens, r.sizeBridge, r.sizeTemple],
    description: r.description,
    tags: r.tags,
    image: {
      url: frameRecordImageUrl(r),
      width: r.imageWidth,
      height: r.imageHeight,
      anchorL: { x: r.anchorLx, y: r.anchorLy },
      anchorR: { x: r.anchorRx, y: r.anchorRy },
    },
    has3d: false,
  };
}

/**
 * Catalogue public : les montures gérées dans l'espace équipe, ou les montures de
 * démonstration tant qu'aucune n'a été ajoutée.
 */
export async function getCatalog(): Promise<Frame[]> {
  const records = await getStore().listFrames();
  if (records.length === 0) return BUILTIN_FRAMES;
  return records.filter((r) => r.imageMime).map(recordToFrame);
}

export async function getCatalogFrame(slug: string): Promise<Frame | undefined> {
  const catalog = await getCatalog();
  return catalog.find((f) => f.slug === slug);
}
