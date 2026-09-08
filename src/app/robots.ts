import type { MetadataRoute } from "next";
import { BUSINESS } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    sitemap: `${BUSINESS.siteUrl}/sitemap.xml`,
  };
}
