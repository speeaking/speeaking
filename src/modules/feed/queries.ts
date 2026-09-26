import "server-only";
import { db } from "@/server/db";
import type { Candidate, IntentQuery, IntentSignal, ViewerContext } from "./ranking";
import { categoryIntentScores } from "./ranking";

const DAY = 24 * 60 * 60 * 1000;
/** Días hacia atrás que considera el feed (también la ventana de «N nuevas», `social/unread.ts`). */
export const CANDIDATE_WINDOW_DAYS = 45;
const MAX_CANDIDATES = 400;
const SIGNAL_WINDOW_DAYS = 14;

export const EMPTY_CONTEXT: ViewerContext = {
  communityIds: new Set(),
  followingIds: new Set(),
  categoryIntent: new Map(),
  viewedCategoryIds: new Set(),
  intentQueries: [],
};

/** Filtros del feed: una comunidad (burbuja o página de la comunidad) o «Siguiendo». */
export type CandidateFilter = {
  communityId?: string;
  /** Solo publicaciones de estas personas («Siguiendo»). Una lista vacía no trae nada. */
  authorIds?: readonly string[];
};

/** Publicaciones candidatas publicadas hasta `asOf` (las de productos no disponibles se omiten). */
export async function loadCandidates(
  asOf: Date,
  filter: CandidateFilter = {},
): Promise<Candidate[]> {
  const rows = await db.post.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { lte: asOf, gte: new Date(asOf.getTime() - CANDIDATE_WINDOW_DAYS * DAY) },
      ...(filter.communityId ? { communityId: filter.communityId } : {}),
      ...(filter.authorIds ? { authorId: { in: [...filter.authorIds] } } : {}),
      OR: [{ productId: null }, { product: { status: "ACTIVE", stock: { gt: 0 } } }],
    },
    orderBy: { publishedAt: "desc" },
    take: MAX_CANDIDATES,
    select: {
      id: true,
      authorId: true,
      communityId: true,
      productId: true,
      publishedAt: true,
      likeCount: true,
      commentCount: true,
      saveCount: true,
      product: { select: { categoryId: true, title: true, tags: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    authorId: row.authorId,
    communityId: row.communityId,
    categoryId: row.product?.categoryId ?? null,
    isCommerce: row.productId !== null,
    productText: row.product ? `${row.product.title} ${row.product.tags.join(" ")}` : "",
    publishedAt: row.publishedAt,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    saveCount: row.saveCount,
  }));
}

/**
 * Contexto de la persona: comunidades, a quién sigue e intención de compra (Commerce Engine).
 * Si desactivó la personalización, no se usan sus señales de comportamiento.
 */
export async function loadViewerContext(viewerId: string, asOf: Date): Promise<ViewerContext> {
  const [profile, memberships, follows, intents] = await Promise.all([
    db.profile.findUnique({
      where: { userId: viewerId },
      select: { personalizationEnabled: true },
    }),
    db.communityMembership.findMany({ where: { userId: viewerId }, select: { communityId: true } }),
    db.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } }),
    db.shoppingIntent.findMany({
      where: {
        userId: viewerId,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: asOf } }],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { query: true, categoryId: true, budgetMaxCents: true, createdAt: true },
    }),
  ]);

  const hoursAgo = (date: Date) => Math.max(0, (asOf.getTime() - date.getTime()) / 3_600_000);
  const signals: IntentSignal[] = intents.flatMap((intent) =>
    intent.categoryId
      ? [
          {
            categoryId: intent.categoryId,
            type: "DECLARED" as const,
            ageHours: hoursAgo(intent.createdAt),
          },
        ]
      : [],
  );
  const intentQueries: IntentQuery[] = intents.map((intent) => ({
    query: intent.query,
    source: "declared",
    categoryId: intent.categoryId,
    budgetMaxCents: intent.budgetMaxCents,
  }));
  const viewedCategoryIds = new Set<string>();

  if (profile?.personalizationEnabled ?? true) {
    const events = await db.analyticsEvent.findMany({
      where: {
        userId: viewerId,
        createdAt: { gte: new Date(asOf.getTime() - SIGNAL_WINDOW_DAYS * DAY) },
        OR: [
          { entityType: "PRODUCT", type: { in: ["PRODUCT_VIEW", "SAVE", "ADD_TO_CART", "CLICK"] } },
          { type: "SEARCH" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { type: true, entityId: true, query: true, createdAt: true },
    });
    const productIds = [
      ...new Set(events.flatMap((event) => (event.entityId ? [event.entityId] : []))),
    ];
    const products = productIds.length
      ? await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, categoryId: true },
        })
      : [];
    const categoryOf = new Map(products.map((product) => [product.id, product.categoryId]));
    for (const event of events) {
      if (event.type === "SEARCH") {
        const query = event.query?.trim();
        const repeated = intentQueries.some(
          (known) => known.query.toLowerCase() === query?.toLowerCase(),
        );
        if (query && !repeated && intentQueries.length < 10) {
          intentQueries.push({ query, source: "search", categoryId: null, budgetMaxCents: null });
        }
        continue;
      }
      const categoryId = event.entityId ? categoryOf.get(event.entityId) : undefined;
      if (categoryId) {
        signals.push({
          categoryId,
          type: event.type as IntentSignal["type"],
          ageHours: hoursAgo(event.createdAt),
        });
        viewedCategoryIds.add(categoryId);
      }
    }
  }

  return {
    communityIds: new Set(memberships.map((membership) => membership.communityId)),
    followingIds: new Set(follows.map((follow) => follow.followingId)),
    categoryIntent: categoryIntentScores(signals),
    viewedCategoryIds,
    intentQueries,
  };
}

// ─────────────────────────────── Inicio ───────────────────────────────

const communityBubbleSelect = { id: true, slug: true, name: true, emoji: true, hue: true } as const;

/** Todas las comunidades en el orden curado (son una docena): burbujas y «Arma tu feed». */
export function listCommunitiesInOrder() {
  return db.community.findMany({ orderBy: { sortOrder: "asc" }, select: communityBubbleSelect });
}

/** Comunidades de la persona, las más recientes primero (como «Tus comunidades»). */
export async function listJoinedCommunities(userId: string) {
  const rows = await db.communityMembership.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { community: { select: communityBubbleSelect } },
  });
  return rows.map((row) => row.community);
}

/** La búsqueda que la persona declaró al registrarse, si sigue activa y vigente. */
export function findOnboardingIntentQuery(userId: string, now: Date) {
  return db.shoppingIntent.findFirst({
    where: {
      userId,
      source: "ONBOARDING",
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { query: true },
  });
}

/**
 * Publicaciones recientes de una comunidad («Más de Gaming» en la página de una publicación), con
 * las mismas reglas de visibilidad que el feed: publicadas y sin productos no disponibles.
 */
export async function listRecentCommunityPostIds(
  communityId: string,
  { excludePostId, limit, now }: { excludePostId: string; limit: number; now: Date },
): Promise<string[]> {
  const rows = await db.post.findMany({
    where: {
      status: "PUBLISHED",
      communityId,
      id: { not: excludePostId },
      publishedAt: { lte: now },
      OR: [{ productId: null }, { product: { status: "ACTIVE", stock: { gt: 0 } } }],
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/** Id de la comunidad y si la persona ya es miembro (para «Unirme» en «Más de Gaming»). */
export async function findCommunityJoinState(slug: string, viewerId: string | null) {
  const community = await db.community.findUnique({ where: { slug }, select: { id: true } });
  if (!community) return null;
  const membership = viewerId
    ? await db.communityMembership.findUnique({
        where: { userId_communityId: { userId: viewerId, communityId: community.id } },
        select: { userId: true },
      })
    : null;
  return { id: community.id, joined: membership !== null };
}
