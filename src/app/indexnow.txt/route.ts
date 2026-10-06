import { indexingEnabled } from "@/app/seo";
import { siteConfig } from "@/config/site";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

/**
 * La llave de IndexNow (`server/seo/indexnow.ts`): el buscador la lee aquí para comprobar que el
 * aviso viene de este sitio. Fuera de producción (sin indexación) no existe.
 */
export function GET() {
  if (!indexingEnabled(env)) return new Response(null, { status: 404 });
  return new Response(siteConfig.indexNowKey, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
