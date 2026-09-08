import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Sur Cloudflare Workers, pas d'optimiseur d'images intégré : servir les fichiers tels quels.
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === "1",
  },
};

export default nextConfig;

// Expose les bindings Cloudflare (D1…) pendant `next dev`.
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) => initOpenNextCloudflareForDev()).catch(() => {});
}
