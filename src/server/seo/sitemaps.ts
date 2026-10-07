import "server-only";
import { absoluteUrl } from "@/app/seo";
import { MIN_PRODUCTS_FOR_PLACE_PAGE, placePath } from "@/modules/catalog/places";
import { categoryPlaceCounts, placeCounts } from "@/modules/catalog/queries";
import { db } from "@/server/db";

export const SITEMAP_BATCH_SIZE = 10000;
export const SITEMAP_KINDS = [
  "products",
  "communities",
  "sellers",
  "categories",
  "places",
] as const;
export type SitemapKind = (typeof SITEMAP_KINDS)[number];

const publicProducts = {
  status: "ACTIVE" as const,
  moderationStatus: "VISIBLE" as const,
  stock: { gt: 0 },
  seller: { status: "ACTIVE" as const },
};
const publicSellers = {
  discoverable: true,
  onboardedAt: { not: null },
  user: {
    sellerProfile: { status: "ACTIVE" as const, products: { some: publicProducts } },
  },
};
const publicCategories = {
  OR: [
    { products: { some: publicProducts } },
    { children: { some: { products: { some: publicProducts } } } },
  ],
};

/**
 * «Comprar en Jalisco» y «Decoración y plantas en Jalisco»: solo los lugares con al menos
 * `MIN_PRODUCTS_FOR_PLACE_PAGE` productos a la venta (sin páginas vacías). Son pocas (32 estados por
 * categoría como máximo), así que se calculan completas.
 */
async function placePaths() {
  const [states, categories] = await Promise.all([placeCounts(), categoryPlaceCounts()]);
  const paths: string[] = [];
  for (const place of states.values()) {
    if (place.count >= MIN_PRODUCTS_FOR_PLACE_PAGE) paths.push(placePath(place.state.slug));
  }
  for (const [key, count] of categories) {
    if (count < MIN_PRODUCTS_FOR_PLACE_PAGE) continue;
    const slash = key.lastIndexOf("/");
    paths.push(placePath(key.slice(slash + 1), key.slice(0, slash)));
  }
  return paths.sort();
}

export async function sitemapCounts() {
  const [products, communities, sellers, categories, places] = await Promise.all([
    db.product.count({ where: publicProducts }),
    db.community.count(),
    db.profile.count({ where: publicSellers }),
    db.category.count({ where: publicCategories }),
    placePaths().then((paths) => paths.length),
  ]);
  return { products, communities, sellers, categories, places };
}

/** Solo URLs públicas; nunca pedidos, mensajes, borradores, productos ocultos ni fotos de prueba. */
export async function sitemapRows(kind: SitemapKind, page: number) {
  const batch = {
    skip: page * SITEMAP_BATCH_SIZE,
    take: SITEMAP_BATCH_SIZE,
    orderBy: { id: "asc" as const },
  };
  switch (kind) {
    case "products":
      return (
        await db.product.findMany({
          ...batch,
          where: publicProducts,
          select: { slug: true, updatedAt: true },
        })
      ).map((row) => ({
        url: absoluteUrl(`/producto/${encodeURIComponent(row.slug)}`),
        lastModified: row.updatedAt,
      }));
    case "communities":
      return (
        await db.community.findMany({ ...batch, select: { slug: true, updatedAt: true } })
      ).map((row) => ({
        url: absoluteUrl(`/c/${encodeURIComponent(row.slug)}`),
        lastModified: row.updatedAt,
      }));
    case "sellers":
      return (
        await db.profile.findMany({
          ...batch,
          where: publicSellers,
          select: { username: true, updatedAt: true },
        })
      ).map((row) => ({
        url: absoluteUrl(`/u/${encodeURIComponent(row.username)}`),
        lastModified: row.updatedAt,
      }));
    case "categories":
      return (
        await db.category.findMany({ ...batch, where: publicCategories, select: { slug: true } })
      ).map((row) => ({ url: absoluteUrl(`/comprar/${encodeURIComponent(row.slug)}`) }));
    case "places":
      return (await placePaths())
        .slice(batch.skip, batch.skip + batch.take)
        .map((path) => ({ url: absoluteUrl(path) }));
  }
}

/** Lo que lista `llms.txt`: categorías con productos públicos y comunidades (las primeras 100). */
export async function llmsData() {
  const [categories, communities] = await Promise.all([
    db.category.findMany({
      where: publicCategories,
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    db.community.findMany({
      select: { slug: true, name: true, description: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);
  return { categories, communities };
}

export function escapeXml(text: string) {
  return text.replace(
    /[<>&"']/g,
    (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!,
  );
}

export function xmlResponse(xml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
