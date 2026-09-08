import type { MetadataRoute } from "next";
import { BUSINESS } from "@/lib/config";
import { getCatalog } from "@/lib/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = BUSINESS.siteUrl;
  const frames = await getCatalog();
  const now = new Date();
  return [
    { url: base, lastModified: now, priority: 1 },
    { url: `${base}/montures`, lastModified: now, priority: 0.9 },
    { url: `${base}/essayage`, lastModified: now, priority: 0.8 },
    { url: `${base}/rendez-vous`, lastModified: now, priority: 0.9 },
    { url: `${base}/suivi`, lastModified: now, priority: 0.5 },
    ...frames.map((f) => ({ url: `${base}/montures/${f.slug}`, lastModified: now, priority: 0.7 })),
  ];
}
