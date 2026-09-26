import "server-only";
import { cache } from "react";
import { siteConfig } from "@/config/site";
import { POST_WITH_VISIBLE_PRODUCT, VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { MIN_FOLLOW_INTERMEDIARIES } from "./suggestions";

/**
 * Acceso a datos de la columna «Para ti» y de «Gente de tus comunidades». Todas las consultas están
 * acotadas (LIMIT) y seleccionan solo campos públicos: el costo del producto nunca se consulta. Lo
 * oculto por moderación no cuenta ni se sugiere (`VISIBLE_PRODUCT`, `POST_WITH_VISIBLE_PRODUCT`).
 */

const DAY = 24 * 60 * 60 * 1000;

// ─────────────────────────────── Comunidades ───────────────────────────────

/** En caché por request: la usan la columna y «Gente de tus comunidades» en la misma página. */
export const listMembershipCommunityIds = cache(async (userId: string): Promise<string[]> => {
  const rows = await db.communityMembership.findMany({
    where: { userId },
    select: { communityId: true },
  });
  return rows.map((row) => row.communityId);
});

/**
 * Publicaciones visibles por comunidad desde `since`, en una sola consulta agrupada. Las de un
 * producto oculto por moderación no cuentan como actividad (P5: nada inflado).
 */
export async function countRecentPostsByCommunity(since: Date, until: Date) {
  const rows = await db.post.groupBy({
    by: ["communityId"],
    where: {
      status: "PUBLISHED",
      communityId: { not: null },
      publishedAt: { gte: since, lte: until },
      AND: [POST_WITH_VISIBLE_PRODUCT],
    },
    _count: { _all: true },
  });
  return rows.flatMap((row) =>
    row.communityId ? [{ communityId: row.communityId, posts: row._count._all }] : [],
  );
}

export function listCommunitiesById(ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return db.community.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, name: true, emoji: true, hue: true, sortOrder: true },
  });
}

// ───────────────────────────── Debates abiertos ─────────────────────────────

const DEBATE_WINDOW_DAYS = 30;
const DEBATE_POOL = 60;

/**
 * Publicaciones de texto (sin fotos ni producto) recientes que contienen «?». Lo que termina en
 * pregunta lo decide `selectDebates`; aquí solo se acota la búsqueda.
 */
export function listQuestionCandidates({
  communityIds,
  excludeAuthorId,
  now,
}: {
  /** `null` = todas las comunidades. */
  communityIds: string[] | null;
  excludeAuthorId: string | null;
  now: Date;
}) {
  return db.post.findMany({
    where: {
      status: "PUBLISHED",
      type: "POST",
      productId: null,
      media: { none: {} },
      body: { contains: "?" },
      publishedAt: { gte: new Date(now.getTime() - DEBATE_WINDOW_DAYS * DAY), lte: now },
      communityId: communityIds ? { in: communityIds } : { not: null },
      ...(excludeAuthorId ? { authorId: { not: excludeAuthorId } } : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: DEBATE_POOL,
    select: {
      id: true,
      body: true,
      communityId: true,
      commentCount: true,
      publishedAt: true,
      community: { select: { slug: true, name: true, emoji: true, hue: true } },
    },
  });
}

// ───────────────────────────── Lo que buscas ─────────────────────────────

/** La intención de compra activa y vigente más reciente. */
export function findActiveIntent(userId: string, now: Date) {
  return db.shoppingIntent.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      query: true,
      categoryId: true,
      budgetMaxCents: true,
      source: true,
      createdAt: true,
    },
  });
}

export function findIntentOwner(intentId: string) {
  return db.shoppingIntent.findUnique({
    where: { id: intentId },
    select: { userId: true, status: true },
  });
}

export async function markIntentDismissed(intentId: string) {
  await db.shoppingIntent.update({ where: { id: intentId }, data: { status: "DISMISSED" } });
}

/**
 * Productos que se evalúan contra la intención (los más recientes, con stock y en presupuesto).
 * Nunca los de la propia persona (no tiene sentido sugerirle lo que ella misma vende) ni los
 * ocultos por moderación.
 */
const INTENT_PRODUCT_POOL = 200;

export function listIntentProductPool(viewerId: string, budgetMaxCents: number | null) {
  return db.product.findMany({
    where: {
      status: "ACTIVE",
      stock: { gt: 0 },
      ...VISIBLE_PRODUCT,
      seller: { userId: { not: viewerId } },
      // El presupuesto se declara en la moneda local: solo se compara con precios en esa moneda.
      currency: siteConfig.currency,
      ...(budgetMaxCents !== null ? { priceCents: { lte: budgetMaxCents } } : {}),
    },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: INTENT_PRODUCT_POOL,
    select: {
      id: true,
      title: true,
      tags: true,
      categoryId: true,
      priceCents: true,
      publishedAt: true,
    },
  });
}

/**
 * Tarjeta pública del producto elegido (primera foto incluida; sin costo). `null` si ya no existe o
 * el equipo lo ocultó entre la elección y la tarjeta.
 */
export async function getIntentProductCard(productId: string) {
  const row = await db.product.findFirst({
    where: { id: productId, ...VISIBLE_PRODUCT },
    select: {
      slug: true,
      title: true,
      priceCents: true,
      currency: true,
      city: true,
      media: {
        orderBy: { position: "asc" },
        take: 1,
        select: {
          media: {
            select: { storageKey: true, width: true, height: true, blurDataUrl: true },
          },
        },
      },
    },
  });
  if (!row) return null;
  const media = row.media[0]?.media;
  return {
    slug: row.slug,
    title: row.title,
    priceCents: row.priceCents,
    currency: row.currency,
    city: row.city,
    image: media
      ? {
          url: getStorage().publicUrl(media.storageKey),
          width: media.width,
          height: media.height,
          blurDataUrl: media.blurDataUrl,
        }
      : null,
  };
}

// ─────────────────────────── Gente de tus comunidades ───────────────────────────

/** Cuántos candidatos trae cada señal antes de puntuar. */
const SIGNAL_POOL = 50;
const MAX_FOLLOWING_SCANNED = 1_000;

/** Solo cuentas reales visibles: con perfil completo, no editoriales y que aceptan aparecer. */
function eligibleTarget(viewerId: string) {
  return {
    profile: { is: { isEditorial: false, discoverable: true, onboardedAt: { not: null } } },
    dismissedBy: { none: { userId: viewerId } },
    followers: { none: { followerId: viewerId } },
  };
}

/**
 * Intermediarios de «La siguen personas que sigues» (SEC-17): solo seguidos MUTUOS (tú los sigues y
 * te siguen) que además participan en las sugerencias. Con un seguimiento unilateral bastaría
 * seguir a alguien para ver a quién sigue; y quien desactivó «Aparecer en sugerencias» tampoco
 * presta a quién sigue como señal.
 */
export async function listMutualFollowIds(viewerId: string) {
  const rows = await db.follow.findMany({
    where: {
      followerId: viewerId,
      following: {
        following: { some: { followingId: viewerId } },
        profile: { is: { discoverable: true, onboardedAt: { not: null } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_FOLLOWING_SCANNED,
    select: { followingId: true },
  });
  return rows.map((row) => row.followingId);
}

/**
 * Personas seguidas por tus seguidos mutuos, con cuántos de ellos las siguen. Solo las que siguen al
 * menos `MIN_FOLLOW_INTERMEDIARIES` distintos: con uno, la sugerencia delataría a quién sigue.
 */
export async function countFollowedByFollowing(viewerId: string, intermediaryIds: string[]) {
  if (intermediaryIds.length < MIN_FOLLOW_INTERMEDIARIES) return new Map<string, number>();
  const rows = await db.follow.groupBy({
    by: ["followingId"],
    where: {
      followerId: { in: intermediaryIds },
      followingId: { not: viewerId },
      following: eligibleTarget(viewerId),
    },
    having: { followingId: { _count: { gte: MIN_FOLLOW_INTERMEDIARIES } } },
    _count: { _all: true },
    orderBy: [{ _count: { followingId: "desc" } }, { followingId: "asc" }],
    take: SIGNAL_POOL,
  });
  return new Map(rows.map((row) => [row.followingId, row._count._all]));
}

/** Cuántas publicaciones y membresías recientes se revisan para encontrar gente activa. */
const PEER_ACTIVITY_SCAN = 200;

/**
 * Miembros de tus comunidades, del más activo al menos activo: primero quienes publicaron hace poco
 * en ellas y después quienes se unieron hace poco. Ambas consultas están acotadas (LIMIT) y
 * ordenadas por fecha, así que no salen siempre las mismas cuentas más antiguas. Devuelve a lo sumo
 * 50 ids, sin repetir.
 */
export async function listActiveCommunityPeers(viewerId: string, communityIds: string[]) {
  if (communityIds.length === 0) return [];
  const peer = {
    ...eligibleTarget(viewerId),
    memberships: { some: { communityId: { in: communityIds } } },
  };
  const [posters, joiners] = await Promise.all([
    db.post.findMany({
      where: {
        status: "PUBLISHED",
        communityId: { in: communityIds },
        authorId: { not: viewerId },
        author: peer,
        // Publicar un producto que el equipo ocultó no cuenta como actividad visible.
        AND: [POST_WITH_VISIBLE_PRODUCT],
      },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: PEER_ACTIVITY_SCAN,
      select: { authorId: true },
    }),
    db.communityMembership.findMany({
      where: {
        communityId: { in: communityIds },
        userId: { not: viewerId },
        user: eligibleTarget(viewerId),
      },
      orderBy: [{ createdAt: "desc" }, { userId: "desc" }],
      take: PEER_ACTIVITY_SCAN,
      select: { userId: true },
    }),
  ]);
  const ordered = new Set([
    ...posters.map((post) => post.authorId),
    ...joiners.map((membership) => membership.userId),
  ]);
  return [...ordered].slice(0, SIGNAL_POOL);
}

/**
 * Quién comentó tus publicaciones (solo comentarios publicados, que ya son públicos). Los «me gusta»
 * no se usan: la app no muestra quién dio «me gusta» y una sugerencia lo revelaría.
 */
export async function countCommentersOnPostsOf(viewerId: string) {
  const rows = await db.comment.groupBy({
    by: ["authorId"],
    where: {
      status: "PUBLISHED",
      authorId: { not: viewerId },
      post: { authorId: viewerId, status: "PUBLISHED" },
      author: eligibleTarget(viewerId),
    },
    _count: { _all: true },
    orderBy: [{ _count: { authorId: "desc" } }, { authorId: "asc" }],
    take: SIGNAL_POOL,
  });
  return new Map(rows.map((row) => [row.authorId, row._count._all]));
}

/** Nombres de las comunidades que cada candidato comparte contigo. */
export async function listSharedCommunityNames(userIds: string[], communityIds: string[]) {
  const shared = new Map<string, string[]>();
  if (userIds.length === 0 || communityIds.length === 0) return shared;
  const rows = await db.communityMembership.findMany({
    where: { userId: { in: userIds }, communityId: { in: communityIds } },
    // Acotado: a lo sumo una fila por candidato y comunidad tuya.
    take: userIds.length * communityIds.length,
    select: { userId: true, community: { select: { name: true } } },
  });
  for (const row of rows) {
    shared.set(row.userId, [...(shared.get(row.userId) ?? []), row.community.name]);
  }
  return shared;
}

/**
 * Perfiles públicos de los candidatos, filtrando otra vez las exclusiones por si cambiaron entre
 * consultas (editoriales, ocultos, descartados o ya seguidos).
 */
export function listSuggestionProfiles(viewerId: string, userIds: string[]) {
  if (userIds.length === 0) return Promise.resolve([]);
  return db.user.findMany({
    where: { id: { in: userIds, not: viewerId }, ...eligibleTarget(viewerId) },
    select: {
      id: true,
      profile: { select: { username: true, displayName: true, avatarUrl: true } },
      sellerProfile: { select: { status: true } },
    },
  });
}

/** Guarda que la persona quitó a alguien de sus sugerencias (idempotente). */
export async function createSuggestionDismissal(viewerId: string, targetUserId: string) {
  await db.suggestionDismissal.createMany({
    data: [{ userId: viewerId, targetUserId }],
    skipDuplicates: true,
  });
}

export async function userExists(userId: string) {
  return (await db.user.count({ where: { id: userId } })) > 0;
}

// ─────────────────────────────── Privacidad ───────────────────────────────

export async function findDiscoverable(userId: string) {
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { discoverable: true },
  });
  return profile?.discoverable ?? true;
}

/** Cambia «Aparecer en sugerencias» y lo registra en el historial de consentimientos. */
export async function updateDiscoverable(userId: string, enabled: boolean, version: string) {
  await db.$transaction([
    db.profile.update({ where: { userId }, data: { discoverable: enabled } }),
    db.userConsent.create({
      data: { userId, type: "DISCOVERABILITY", version, granted: enabled },
    }),
  ]);
}
