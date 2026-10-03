import { absoluteUrl, indexingEnabled } from "@/app/seo";
import { env } from "@/server/env";
import {
  escapeXml,
  SITEMAP_BATCH_SIZE,
  SITEMAP_KINDS,
  sitemapCounts,
  xmlResponse,
} from "@/server/seo/sitemaps";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!indexingEnabled(env)) return new Response(null, { status: 404 });
  const counts = await sitemapCounts();
  const locations = [
    absoluteUrl("/sitemap.xml"),
    ...SITEMAP_KINDS.flatMap((kind) =>
      Array.from({ length: Math.ceil(counts[kind] / SITEMAP_BATCH_SIZE) }, (_, page) =>
        absoluteUrl(`/sitemaps/${kind}-${page}.xml`),
      ),
    ),
  ];
  return xmlResponse(
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locations
      .map((url) => `<sitemap><loc>${escapeXml(url)}</loc></sitemap>`)
      .join("")}</sitemapindex>`,
  );
}
