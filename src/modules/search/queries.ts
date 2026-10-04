import "server-only";
import type { ProductStatus } from "@/generated/prisma/enums";
import type { ProductCardDTO } from "@/modules/catalog/queries";
import type { FeedItemDTO } from "@/modules/feed/dto";
import { hydratePosts } from "@/modules/social/post-queries";
import { hydrateContacts } from "@/modules/relationships/queries";
import type { ContactDTO } from "@/modules/relationships/types";
import { slotForPublicProduct } from "@/modules/stylist/slots";
import { VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import type { SearchQuery } from "./normalize";
import {
  communitySearchSql,
  personSearchSql,
  postSearchSql,
  productSearchSql,
  SEARCH_CATEGORY_PAGE_SIZE,
  SEARCH_LIMITS,
} from "./sql";
import type { SearchCategory, SearchScope } from "./scopes";
import { SEARCH_MAX_PAGES } from "./scopes";

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
  people: ContactDTO[];
  communities: CommunityResultDTO[];
  products: ProductCardDTO[];
  posts: FeedItemDTO[];
  videos: FeedItemDTO[];
  hasMore: Partial<Record<SearchCategory, boolean>>;
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
 * Búsqueda global o por categoría, solo con datos públicos y contenido visible para la sesión.
 */
export async function searchEverything(
  query: SearchQuery,
  viewerId: string | null,
  { scope = "todo", page = 0 }: { scope?: SearchScope; page?: number } = {},
): Promise<SearchResults> {
  const all = scope === "todo";
  const pageIndex = all ? 0 : Math.max(0, Math.min(Math.floor(page), SEARCH_MAX_PAGES - 1));
  const offset = pageIndex * SEARCH_CATEGORY_PAGE_SIZE;
  const limits = all
    ? SEARCH_LIMITS
    : {
        people: SEARCH_CATEGORY_PAGE_SIZE,
        communities: SEARCH_CATEGORY_PAGE_SIZE,
        products: SEARCH_CATEGORY_PAGE_SIZE,
        posts: SEARCH_CATEGORY_PAGE_SIZE,
      };
  const [personRows, communityRows, productRows, postRows] = await Promise.all([
    all || scope === "personas"
      ? db.$queryRaw<{ id: string }[]>(
          personSearchSql(query.terms, limits.people + 1, viewerId, offset),
        )
      : [],
    all || scope === "comunidades"
      ? db.$queryRaw<{ id: string }[]>(
          communitySearchSql(query.terms, limits.communities + 1, offset),
        )
      : [],
    all || scope === "productos"
      ? db.$queryRaw<{ id: string }[]>(
          productSearchSql(query.terms, limits.products + 1, { offset }),
        )
      : [],
    all || scope === "publicaciones" || scope === "videos"
      ? db.$queryRaw<{ id: string }[]>(
          postSearchSql(query.terms, limits.posts + 1, viewerId, {
            videosOnly: scope === "videos",
            offset,
          }),
        )
      : [],
  ]);
  const personIds = personRows.slice(0, limits.people).map((row) => row.id);
  const communityIds = communityRows.slice(0, limits.communities).map((row) => row.id);

  const [personRecords, communities, products, posts] = await Promise.all([
    personIds.length
      ? db.user.findMany({
          where: {
            id: { in: personIds },
            profile: { onboardedAt: { not: null }, isEditorial: false },
            ...(viewerId
              ? {
                  messageBlocksMade: { none: { blockedId: viewerId } },
                  messageBlocksReceived: { none: { blockerId: viewerId } },
                }
              : {}),
          },
          select: {
            id: true,
            profile: { select: { username: true, displayName: true, avatarUrl: true } },
          },
        })
      : [],
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
    productCardsByIds(productRows.slice(0, limits.products).map((row) => row.id)),
    hydratePosts(
      postRows.slice(0, limits.posts).map((row) => row.id),
      viewerId,
    ),
  ]);

  return {
    people: await hydrateContacts(viewerId, inOrder(personIds, personRecords)),
    communities: inOrder(communityIds, communities),
    products,
    posts: scope === "videos" ? [] : posts,
    videos: scope === "videos" ? posts.filter((post) => Boolean(post.video)) : [],
    hasMore: {
      personas: personRows.length > limits.people,
      comunidades: communityRows.length > limits.communities,
      productos: productRows.length > limits.products,
      publicaciones: scope !== "videos" && postRows.length > limits.posts,
      videos: scope === "videos" && postRows.length > limits.posts,
    },
  };
}
