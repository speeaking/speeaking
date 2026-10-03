import type { MetadataRoute } from "next";
import { env } from "@/server/env";
import { sitemapEntries } from "./seo";

// En cada petición, como el layout y robots.txt (lee ALLOW_INDEXING del entorno vigente).
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(env);
}
