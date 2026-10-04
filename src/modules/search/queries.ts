import "server-only";
import type { ProductStatus } from "@/generated/prisma/enums";
import type { ProductCardDTO } from "@/modules/catalog/queries";
import type { FeedItemDTO } from "@/modules/feed/dto";
import { hydratePosts } from "@/modules/social/post-queries";
import { slotForPublicProduct } from "@/modules/stylist/slots";
import { VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import type { SearchQuery } from "./normalize";
import { communitySearchSql, postSearchSql, productSearchSql } from "./sql";

/** Comunidad encontrada (solo datos públicos). */
export type CommunityResultDTO = {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  hue: number;
  description: string;
  memberCount: number;
};

export type SearchResults = {
  communities: CommunityResultDTO[];
  products: ProductCardDTO[];
  posts: FeedItemDTO[];
};

/** Reordena filas según una lista de IDs (la consulta de búsqueda ya decidió el orden). */
function inOrder<T extends { id: string }>(ids: string[], rows: T[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

/**
 * Tarjetas de producto por ID, en ese orden. Lista blanca de campos: el costo (`ProductCost`) ni
 * se consulta. `statuses` decide qué productos siguen visibles (por omisión, solo los activos).
 */
export async function productCardsByIds(
  ids: string[],
  statuses: readonly ProductStatus[] = ["ACTIVE"],
  options: { excludeUserId?: string | null } = {},
): Promise<ProductCardDTO[]> {
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({
    // Nunca los ocultos por moderación (búsqueda y Guardados usan esta misma función).
    where: {
      id: { in: ids },
      status: { in: [...statuses] },
      ...VISIBLE_PRODUCT,
      // El carrusel del feed no sugiere a nadie lo que esa misma persona vende.
      ...(options.excludeUserId ? { seller: { userId: { not: options.excludeUserId } } } : {}),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      priceCents: true,
      currency: true,
      city: true,
      stock: true,
      status: true,
      tags: true,
      category: { select: { slug: true } },
      media: {
        orderBy: { position: "asc" },
        take: 1,
        select: {
          media: {
            select: {
              storageKey: true,
              width: true,
              height: true,
              blurDataUrl: true,
              altText: true,
            },
          },
        },
      },
    },
  });
  const storage = getStorage();
  return inOrder(ids, rows).map((row) => {
    const cover = row.media[0]?.media;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      priceCents: row.priceCents,
      currency: row.currency,
      city: row.city,
      inStock: row.status === "ACTIVE" && row.stock > 0,
      tryOn:
        slotForPublicProduct({
          categorySlug: row.category.slug,
          title: row.title,
          tags: row.tags,
        }) !== null,
      image: cover
        ? {
            url: storage.publicUrl(cover.storageKey),
            width: cover.width,
            height: cover.height,
            blurDataUrl: cover.blurDataUrl,
            alt: cover.altText,
          }
        : null,
    };
  });
}

/**
 * Búsqueda global: comunidades (nombre y descripción), productos activos (título y etiquetas) y
 * publicaciones visibles (texto), sin acentos ni mayúsculas. Cada sección tiene su límite.
 */
export async function searchEverything(
  query: SearchQuery,
  viewerId: string | null,
): Promise<SearchResults> {
  const [communityRows, productRows, postRows] = await Promise.all([
    db.$queryRaw<{ id: string }[]>(communitySearchSql(query.terms)),
    db.$queryRaw<{ id: string }[]>(productSearchSql(query.terms)),
    db.$queryRaw<{ id: string }[]>(postSearchSql(query.terms, undefined, viewerId)),
  ]);
  const communityIds = communityRows.map((row) => row.id);

  const [communities, products, posts] = await Promise.all([
    communityIds.length > 0
      ? db.community.findMany({
          where: { id: { in: communityIds } },
          select: {
            id: true,
            slug: true,
            name: true,
            emoji: true,
            hue: true,
            description: true,
            memberCount: true,
          },
        })
      : [],
    productCardsByIds(productRows.map((row) => row.id)),
    hydratePosts(
      postRows.map((row) => row.id),
      viewerId,
    ),
  ]);

  return { communities: inOrder(communityIds, communities), products, posts };
}
