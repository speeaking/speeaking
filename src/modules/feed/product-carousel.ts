import "server-only";
import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/format";
import { listFeaturedProducts, type ProductCardDTO } from "@/modules/catalog/queries";
import { scoreIntentMatch } from "@/modules/discovery/intent-match";
import { findActiveIntent, listIntentProductPool } from "@/modules/discovery/queries";
import { productCardsByIds } from "@/modules/search/queries";
import { VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import {
  composeFeedProducts,
  FALLBACK_ORDER,
  FEED_PRODUCTS_SIZE,
  FEED_SPONSORED_MAX,
  type FeedProductsDTO,
  type ProductTier,
  type ProductTierKind,
  rotate,
} from "./product-carousel-compose";
import { listJoinedCommunities } from "./queries";

/** Candidatos por tramo: de sobra para llenar un carrusel después de quitar repetidos. */
const TIER_POOL = 24;
/** «Lo más vendido» mira 30 días; «Populares», 7. */
const SOLD_WINDOW_DAYS = 30;
const POPULAR_WINDOW_DAYS = 7;
/** Páginas en las que vuelven los patrocinados (la 1.ª, la 4.ª, …): no en todas, para no cansar. */
const SPONSORED_EVERY_PAGES = 3;

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

/** Productos pagados en los últimos 30 días, por unidades vendidas (P4: pedidos reales). */
async function bestSellerIds(now: Date): Promise<string[]> {
  const rows = await db.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: {
        status: { in: ["PAID", "SHIPPED", "DELIVERED"] },
        createdAt: { gte: daysAgo(now, SOLD_WINDOW_DAYS) },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: TIER_POOL,
  });
  return rows.map((row) => row.productId);
}

/** Productos más vistos en la última semana (vistas de su ficha). */
async function popularIds(now: Date): Promise<string[]> {
  const rows = await db.analyticsEvent.groupBy({
    by: ["entityId"],
    where: {
      type: "PRODUCT_VIEW",
      entityType: "PRODUCT",
      entityId: { not: null },
      createdAt: { gte: daysAgo(now, POPULAR_WINDOW_DAYS) },
    },
    _count: { _all: true },
    orderBy: { _count: { entityId: "desc" } },
    take: TIER_POOL,
  });
  return rows.flatMap((row) => (row.entityId ? [row.entityId] : []));
}

/** Lo recién publicado con existencia (siempre hay algo: el respaldo de los respaldos). */
async function newestIds(): Promise<string[]> {
  const rows = await db.product.findMany({
    where: { status: "ACTIVE", stock: { gt: 0 }, ...VISIBLE_PRODUCT },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: TIER_POOL,
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/** Productos publicados en las comunidades de la persona (lo más reciente primero). */
async function communityProductIds(viewerId: string): Promise<string[]> {
  const joined = await listJoinedCommunities(viewerId);
  if (joined.length === 0) return [];
  const rows = await db.post.findMany({
    where: {
      communityId: { in: joined.map((community) => community.id) },
      type: "PRODUCT",
      status: "PUBLISHED",
      product: { status: "ACTIVE", stock: { gt: 0 }, ...VISIBLE_PRODUCT },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: TIER_POOL * 2,
    select: { productId: true },
  });
  return [...new Set(rows.flatMap((row) => (row.productId ? [row.productId] : [])))];
}

/** La búsqueda declarada vigente, convertida en tramo: lo que coincide, lo mejor primero. */
async function intentTier(viewerId: string, now: Date): Promise<ProductTier | null> {
  const intent = await findActiveIntent(viewerId, now);
  if (!intent) return null;
  const pool = await listIntentProductPool(viewerId, intent.budgetMaxCents);
  const query = {
    query: intent.query,
    categoryId: intent.categoryId,
    budgetMaxCents: intent.budgetMaxCents,
  };
  const ids = pool
    .map((product) => ({ id: product.id, score: scoreIntentMatch(query, product) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.id);
  if (ids.length === 0) return null;
  const budget =
    intent.budgetMaxCents !== null
      ? ` hasta ${formatMoney(intent.budgetMaxCents, siteConfig.currency)}`
      : "";
  return { kind: "intent", ids, reason: `“${intent.query}”${budget}` };
}

/**
 * El carrusel de una página del inicio (ADR-051). `pageIndex` 0 es la primera página: ahí (y cada
 * tres páginas) van los patrocinados; los respaldos rotan y se desplazan por página para que al
 * seguir bajando no se repita lo mismo. `exclude`: slugs de productos que ya están en esa página.
 * Excluye los productos propios salvo en la vitrina superior (`includeOwn`).
 */
export async function pickFeedProducts({
  viewerId,
  pageIndex,
  exclude,
  minimumItems,
  includeOwn = false,
  now = new Date(),
}: {
  viewerId: string | null;
  pageIndex: number;
  exclude: ReadonlySet<string>;
  minimumItems?: number;
  includeOwn?: boolean;
  now?: Date;
}): Promise<FeedProductsDTO | null> {
  const page = Math.max(0, Math.floor(pageIndex));
  const excludeUserId = includeOwn ? null : viewerId;
  const [sponsored, personal] = await Promise.all([
    page % SPONSORED_EVERY_PAGES === 0
      ? listFeaturedProducts({ limit: FEED_SPONSORED_MAX, excludeUserId, now }).catch(
          () => [] as ProductCardDTO[],
        )
      : Promise.resolve([] as ProductCardDTO[]),
    viewerId ? personalTier(viewerId, now, page) : Promise.resolve(null),
  ]);

  // Respaldos: cada página empieza en un tramo distinto y salta lo que ya pudo mostrar antes.
  const skip = Math.floor(page / FALLBACK_ORDER.length) * FEED_PRODUCTS_SIZE;
  const fallbackKinds = rotate(FALLBACK_ORDER, page);
  const fallbacks = await Promise.all(
    fallbackKinds.map(async (kind): Promise<ProductTier> => {
      const ids = await fallbackIds(kind, now);
      return { kind, ids: skip < ids.length ? ids.slice(skip) : ids };
    }),
  );
  const tiers = personal ? [personal, ...fallbacks] : fallbacks;

  const wanted = [...new Set(tiers.flatMap((tier) => tier.ids))].slice(0, TIER_POOL * 3);
  const cards = await productCardsByIds(wanted, ["ACTIVE"], { excludeUserId });
  const searchHref =
    personal?.kind === "intent" && personal.reason
      ? `/comprar?q=${encodeURIComponent(personal.reason.replace(/^“([^”]*)”.*$/, "$1"))}`
      : "/comprar";
  return composeFeedProducts({
    sponsored,
    tiers,
    cards: new Map(cards.map((card) => [card.id, card])),
    exclude,
    searchHref,
    minimumItems,
  });
}

/** Lo personal: la búsqueda declarada manda; si no hay (o no coincide nada), sus comunidades. */
async function personalTier(
  viewerId: string,
  now: Date,
  page: number,
): Promise<ProductTier | null> {
  const intent = await intentTier(viewerId, now);
  if (intent) return { ...intent, ids: rotate(intent.ids, page * FEED_PRODUCTS_SIZE) };
  const ids = await communityProductIds(viewerId);
  return ids.length > 0
    ? { kind: "communities", ids: rotate(ids, page * FEED_PRODUCTS_SIZE) }
    : null;
}

function fallbackIds(kind: ProductTierKind, now: Date): Promise<string[]> {
  if (kind === "bestSellers") return bestSellerIds(now);
  if (kind === "popular") return popularIds(now);
  return newestIds();
}
