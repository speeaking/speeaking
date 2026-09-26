import "server-only";
import { cache } from "react";
import { LEGAL_VERSIONS } from "@/modules/identity/constants";
import { siteConfig } from "@/config/site";
import { debateExcerpt, MAX_DEBATES, selectDebates, selectDebatesPreferring } from "./debates";
import type {
  IntentHighlightDTO,
  MovingCommunityDTO,
  OpenDebatesDTO,
  PersonSuggestionDTO,
  SocialRailDTO,
} from "./dto";
import { pickIntentProduct } from "./intent-match";
import { MOVING_WINDOW_DAYS, rankMovingCommunities } from "./moving-communities";
import * as queries from "./queries";
import { MIN_SUGGESTIONS, rankSuggestions, suggestionReasonText } from "./suggestions";

/**
 * Reglas de la columna «Para ti» (F4) y de «Gente de tus comunidades» (F6b). Sin dependencias de
 * Next: la autorización vive aquí y las acciones solo validan la entrada y obtienen la sesión.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Versión del texto del ajuste «Aparecer en sugerencias» (historial de consentimientos). */
export const DISCOVERABILITY_TEXT_VERSION = LEGAL_VERSIONS.discoverability;

/** Cuántas personas se calculan como máximo (el carrusel del feed; la columna muestra 3). */
export const MAX_PEOPLE_SUGGESTIONS = 10;

// ───────────────────────────── Lo que buscas ─────────────────────────────

/**
 * La intención activa y el mejor producto que cabe en su presupuesto.
 *
 * Presupuesto comercial: este producto cuenta como pieza comercial, así que solo aparece cuando la
 * persona declaró una intención activa y vigente (es la respuesta a lo que ella misma pidió, no un
 * anuncio). La columna no conoce la primera página del feed, por eso no puede excluir un producto
 * que el feed también muestre; ver src/modules/discovery/README.md.
 */
export async function getIntentHighlight(
  viewerId: string,
  now: Date = new Date(),
): Promise<IntentHighlightDTO | null> {
  const intent = await queries.findActiveIntent(viewerId, now);
  if (!intent) return null;

  const pool = await queries.listIntentProductPool(viewerId, intent.budgetMaxCents);
  const best = pickIntentProduct(intent, pool);
  const product = best ? await queries.getIntentProductCard(best.id) : null;

  return {
    id: intent.id,
    query: intent.query,
    budgetMaxCents: intent.budgetMaxCents,
    currency: siteConfig.currency,
    source: intent.source,
    createdAt: intent.createdAt.toISOString(),
    product: product
      ? {
          slug: product.slug,
          title: product.title,
          priceCents: product.priceCents,
          currency: product.currency,
          city: product.city,
          image: product.image,
        }
      : null,
  };
}

export type DismissIntentResult = "dismissed" | "not-found";

/**
 * «Ya no busco esto»: solo la dueña puede descartar su intención. A cualquier otra persona se le
 * responde igual que si no existiera, para no revelar intenciones ajenas. Es idempotente.
 */
export async function dismissIntent(
  viewerId: string,
  intentId: string,
): Promise<DismissIntentResult> {
  const intent = await queries.findIntentOwner(intentId);
  if (!intent || intent.userId !== viewerId) return "not-found";
  if (intent.status === "ACTIVE") await queries.markIntentDismissed(intentId);
  return "dismissed";
}

// ───────────────────────────── Debates abiertos ─────────────────────────────

/**
 * Preguntas de tus comunidades; si no llegan a 4, se completan con las de otras (sin sesión, de
 * todas). Nunca las tuyas: esperan la opinión de otras personas.
 */
export async function getOpenDebates(
  viewerId: string | null,
  communityIds: string[],
  now: Date = new Date(),
): Promise<OpenDebatesDTO> {
  const load = (ids: string[] | null) =>
    queries.listQuestionCandidates({ communityIds: ids, excludeAuthorId: viewerId, now });

  const yours = viewerId && communityIds.length > 0 ? await load(communityIds) : [];
  const enough = selectDebates(yours).items.length >= MAX_DEBATES;
  const selection = selectDebatesPreferring(yours, enough ? [] : await load(null));

  return {
    scope: selection.fromOthers === 0 && selection.items.length > 0 ? "yours" : "all",
    anyAnswered: selection.anyAnswered,
    items: selection.items.flatMap((item) =>
      item.community
        ? [
            {
              id: item.id,
              text: debateExcerpt(item.body),
              comments: item.commentCount,
              community: item.community,
            },
          ]
        : [],
    ),
  };
}

// ───────────────────────── Comunidades en movimiento ─────────────────────────

export async function getMovingCommunities(
  joinedIds: ReadonlySet<string>,
  now: Date = new Date(),
): Promise<MovingCommunityDTO[]> {
  const activity = await queries.countRecentPostsByCommunity(
    new Date(now.getTime() - MOVING_WINDOW_DAYS * DAY),
    now,
  );
  const communities = await queries.listCommunitiesById(activity.map((entry) => entry.communityId));
  return rankMovingCommunities(activity, communities).map(({ community, posts, share }) => ({
    id: community.id,
    slug: community.slug,
    name: community.name,
    emoji: community.emoji,
    hue: community.hue,
    posts,
    share,
    joined: joinedIds.has(community.id),
  }));
}

/** Todo lo de la columna en una llamada (comparte las comunidades de la persona). */
export async function getSocialRail(
  viewerId: string | null,
  now: Date = new Date(),
): Promise<SocialRailDTO> {
  const [communityIds, intent] = await Promise.all([
    viewerId ? queries.listMembershipCommunityIds(viewerId) : Promise.resolve([]),
    viewerId ? getIntentHighlight(viewerId, now) : Promise.resolve(null),
  ]);
  const [debates, moving] = await Promise.all([
    getOpenDebates(viewerId, communityIds, now),
    getMovingCommunities(new Set(communityIds), now),
  ]);
  return { intent, debates, moving };
}

// ─────────────────────────── Gente de tus comunidades ───────────────────────────

/**
 * Hasta 10 personas para seguir, con su razón visible. Lista vacía si hay menos de 3 candidatos
 * reales (principio 5). Se calcula una vez por request aunque la usen la columna y el feed.
 *
 * Exclusiones (en las consultas): tú, cuentas editoriales, perfiles sin terminar, quienes ya sigues,
 * quienes descartaste y quienes desactivaron «Aparecer en sugerencias».
 */
export const getPeopleSuggestions = cache(
  async (viewerId: string): Promise<PersonSuggestionDTO[]> => {
    // Sin «me gusta»: la app no revela quién los dio, y una sugerencia lo delataría.
    const [mutualIds, communityIds, commenters] = await Promise.all([
      queries.listMutualFollowIds(viewerId),
      queries.listMembershipCommunityIds(viewerId),
      queries.countCommentersOnPostsOf(viewerId),
    ]);
    const [followedByFollowing, peers] = await Promise.all([
      queries.countFollowedByFollowing(viewerId, mutualIds),
      queries.listActiveCommunityPeers(viewerId, communityIds),
    ]);
    // Del más activo al menos activo en tus comunidades: desempata la puntuación.
    const activityRank = new Map(peers.map((userId, index) => [userId, index]));

    const candidateIds = [
      ...new Set([...followedByFollowing.keys(), ...peers, ...commenters.keys()]),
    ];
    if (candidateIds.length < MIN_SUGGESTIONS) return [];

    const [sharedNames, users] = await Promise.all([
      queries.listSharedCommunityNames(candidateIds, communityIds),
      queries.listSuggestionProfiles(viewerId, candidateIds),
    ]);
    const profiles = new Map(
      users.flatMap((user) =>
        user.profile
          ? [[user.id, { ...user.profile, isStore: user.sellerProfile?.status === "ACTIVE" }]]
          : [],
      ),
    );

    const ranked = rankSuggestions(
      [...profiles.keys()].map((userId) => ({
        userId,
        followedByFollowing: followedByFollowing.get(userId) ?? 0,
        sharedCommunities: sharedNames.get(userId) ?? [],
        commentsOnYourPosts: commenters.get(userId) ?? 0,
        activityRank: activityRank.get(userId),
      })),
      MAX_PEOPLE_SUGGESTIONS,
    );
    if (ranked.length < MIN_SUGGESTIONS) return [];

    return ranked.flatMap(({ userId, reason }) => {
      const profile = profiles.get(userId);
      return profile
        ? [
            {
              userId,
              username: profile.username,
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              isStore: profile.isStore,
              reason: suggestionReasonText(reason),
            },
          ]
        : [];
    });
  },
);

export type DismissSuggestionResult = "dismissed" | "invalid";

/** «Quitar»: esa persona ya no se te vuelve a sugerir (idempotente). */
export async function dismissSuggestion(
  viewerId: string,
  targetUserId: string,
): Promise<DismissSuggestionResult> {
  if (targetUserId === viewerId) return "invalid";
  if (!(await queries.userExists(targetUserId))) return "invalid";
  await queries.createSuggestionDismissal(viewerId, targetUserId);
  return "dismissed";
}

// ─────────────────────────────── Privacidad ───────────────────────────────

export function isDiscoverable(userId: string) {
  return queries.findDiscoverable(userId);
}

/** Aparecer (o no) en «Gente de tus comunidades»; el cambio queda en el historial de consentimientos. */
export async function setDiscoverable(userId: string, enabled: boolean) {
  await queries.updateDiscoverable(userId, enabled, DISCOVERABILITY_TEXT_VERSION);
}
