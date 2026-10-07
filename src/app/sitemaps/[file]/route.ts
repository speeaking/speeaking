import { indexingEnabled } from "@/app/seo";
import { env } from "@/server/env";
import {
  escapeXml,
  SITEMAP_BATCH_SIZE,
  sitemapCounts,
  sitemapRows,
  xmlResponse,
  type SitemapKind,
} from "@/server/seo/sitemaps";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteContext<"/sitemaps/[file]">) {
  if (!indexingEnabled(env)) return new Response(null, { status: 404 });
  const match = /^(products|communities|sellers|categories|places)-(0|[1-9]\d{0,5})\.xml$/.exec(
    (await params).file,
  );
  if (!match) return new Response(null, { status: 404 });
  const kind = match[1] as SitemapKind;
  const page = Number(match[2]);
  const counts = await sitemapCounts();
  if (page >= Math.ceil(counts[kind] / SITEMAP_BATCH_SIZE))
    return new Response(null, { status: 404 });
  const rows: { url: string; lastModified?: Date }[] = await sitemapRows(kind, page);
  return xmlResponse(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows
      .map(
        (row) =>
          `<url><loc>${escapeXml(row.url)}</loc>${row.lastModified ? `<lastmod>${row.lastModified.toISOString()}</lastmod>` : ""}</url>`,
      )
      .join("")}</urlset>`,
  );
}
