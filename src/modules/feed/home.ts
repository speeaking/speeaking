import "server-only";
import { cache } from "react";
import { hydratePosts } from "@/modules/social/post-queries";
import type { FeedItemDTO, HomeBubblesDTO, HomeCommunityDTO, WelcomeMomentDTO } from "./dto";
import * as queries from "./queries";

/** Sugerencias con «+» en la fila de burbujas (F5). */
export const MAX_SUGGESTED_BUBBLES = 4;

const allCommunities = cache(() => queries.listCommunitiesInOrder());
const joinedCommunities = cache((userId: string) => queries.listJoinedCommunities(userId));

/** Burbujas del inicio: filtros (tus comunidades o todas) y sugerencias en el orden curado. */
export async function getHomeBubbles(viewerId: string | null): Promise<HomeBubblesDTO> {
  if (!viewerId) return { filters: await allCommunities(), suggested: [] };
  const [all, joined] = await Promise.all([allCommunities(), joinedCommunities(viewerId)]);
  const joinedIds = new Set(joined.map((community) => community.id));
  return {
    filters: joined,
    suggested: all
      .filter((community) => !joinedIds.has(community.id))
      .slice(0, MAX_SUGGESTED_BUBBLES),
  };
}

/** Todas las comunidades: los chips de «Arma tu feed» para visitantes. */
export function getJoinableCommunities(): Promise<HomeCommunityDTO[]> {
  return allCommunities();
}

/** Primer nombre para el saludo («Sofía Ramírez» → «Sofía»). */
export function firstNameOf(displayName: string) {
  return displayName.trim().split(/\s+/)[0] ?? "";
}

/** «¡Listo, Sofía!»: lo que eligió en el onboarding, con datos reales. */
export async function getWelcomeMoment(
  viewerId: string,
  displayName: string,
  now: Date = new Date(),
): Promise<WelcomeMomentDTO> {
  const [communities, intent] = await Promise.all([
    joinedCommunities(viewerId),
    queries.findOnboardingIntentQuery(viewerId, now),
  ]);
  return { firstName: firstNameOf(displayName), communities, query: intent?.query ?? null };
}

/** «Más de Gaming» en la página de una publicación. */
export const MORE_FROM_COMMUNITY = 5;

export type MoreFromCommunity = {
  communityId: string;
  /** Si quien ve ya es miembro («Miembro» en lugar de «Unirme»). */
  joined: boolean;
  /** Hasta 5 publicaciones recientes de la comunidad, sin la que se está viendo. */
  posts: FeedItemDTO[];
};

/** Publicaciones recientes de la comunidad de una publicación, listas para pintar. */
export async function getMoreFromCommunity(
  communitySlug: string,
  excludePostId: string,
  viewerId: string | null,
  now: Date = new Date(),
): Promise<MoreFromCommunity | null> {
  const community = await queries.findCommunityJoinState(communitySlug, viewerId);
  if (!community) return null;
  const ids = await queries.listRecentCommunityPostIds(community.id, {
    excludePostId,
    limit: MORE_FROM_COMMUNITY,
    now,
  });
  return {
    communityId: community.id,
    joined: community.joined,
    posts: await hydratePosts(ids, viewerId),
  };
}
