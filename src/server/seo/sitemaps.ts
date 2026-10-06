import "server-only";
import { absoluteUrl } from "@/app/seo";
import { db } from "@/server/db";

export const SITEMAP_BATCH_SIZE = 10000;
export const SITEMAP_KINDS = ["products", "communities", "sellers", "categories"] as const;
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

export async function sitemapCounts() {
  const [products, communities, sellers, categories] = await Promise.all([
    db.product.count({ where: publicProducts }),
    db.community.count(),
    db.profile.count({ where: publicSellers }),
    db.category.count({ where: publicCategories }),
  ]);
  return { products, communities, sellers, categories };
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
