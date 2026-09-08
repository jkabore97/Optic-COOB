import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Configuration minimale : pas de cache incrémental (pages dynamiques rendues à la demande).
export default defineCloudflareConfig({});
