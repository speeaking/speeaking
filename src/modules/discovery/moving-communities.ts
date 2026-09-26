/**
 * «Comunidades en movimiento»: comunidades ordenadas por publicaciones de los últimos 7 días.
 * Solo aparecen las que tuvieron actividad real (sin ceros, principio 5).
 */

export const MOVING_WINDOW_DAYS = 7;
export const MAX_MOVING_COMMUNITIES = 5;

export type CommunityActivity = { communityId: string; posts: number };

export type MovingCommunity<T> = {
  community: T;
  posts: number;
  /** Proporción respecto a la más activa (0–1], para la barra. */
  share: number;
};

/**
 * Une la actividad con los datos de cada comunidad y ordena: más publicaciones primero; empata por
 * el orden editorial (`sortOrder`) y luego por id, para que sea estable.
 */
export function rankMovingCommunities<T extends { id: string; sortOrder: number }>(
  activity: readonly CommunityActivity[],
  communities: readonly T[],
  limit: number = MAX_MOVING_COMMUNITIES,
): MovingCommunity<T>[] {
  const byId = new Map(communities.map((community) => [community.id, community]));
  const ranked = activity
    .flatMap((entry) => {
      const community = byId.get(entry.communityId);
      return community && entry.posts > 0 ? [{ community, posts: entry.posts }] : [];
    })
    .sort(
      (a, b) =>
        b.posts - a.posts ||
        a.community.sortOrder - b.community.sortOrder ||
        a.community.id.localeCompare(b.community.id),
    )
    .slice(0, limit);
  const max = ranked[0]?.posts ?? 0;
  return ranked.map((entry) => ({ ...entry, share: max > 0 ? entry.posts / max : 0 }));
}
