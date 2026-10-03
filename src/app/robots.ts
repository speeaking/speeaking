import type { MetadataRoute } from "next";
import { env } from "@/server/env";
import { robotsFile } from "./seo";

// En cada petición, como el layout: con el archivo del build, cambiar ALLOW_INDEXING dejaría a
// robots.txt diciendo otra cosa que las páginas.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return robotsFile(env);
}
