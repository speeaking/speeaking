import "server-only";
import { z } from "zod";
import { db } from "@/server/db";

/** Personas por página de seguidores o seguidos (ADR-058). */
export const FOLLOW_PAGE_SIZE = 30;

export type FollowDirection = "followers" | "following";

export type FollowPersonDTO = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isSeller: boolean;
  isEditorial: boolean;
  /** Quien mira ya sigue a esta persona (para el botón). */
  viewerFollows: boolean;
  /** Es quien mira: sin botón de seguir. */
  isViewer: boolean;
};

export type FollowPage = { people: FollowPersonDTO[]; nextCursor: string | null };

const personSelect = {
  id: true,
  profile: { select: { username: true, displayName: true, avatarUrl: true, isEditorial: true } },
  sellerProfile: { select: { id: true } },
} as const;

/**
 * Seguidores o seguidos de un perfil, del más reciente al más antiguo, de 30 en 30 (ADR-058). El
 * cursor es el id de la última persona de la página anterior (la llave compuesta de `follows` lo
 * vuelve único). Solo perfiles públicos: nada de correo ni datos privados.
 */
export async function listFollowPeople({
  profileUserId,
  direction,
  viewerId,
  after,
}: {
  profileUserId: string;
  direction: FollowDirection;
  viewerId: string | null;
  after?: string | null;
}): Promise<FollowPage> {
  const validAfter = after && z.uuid().safeParse(after).success ? after : null;
  const followers = direction === "followers";
  const rows = await db.follow.findMany({
    where: followers ? { followingId: profileUserId } : { followerId: profileUserId },
    orderBy: [{ createdAt: "desc" }, followers ? { followerId: "desc" } : { followingId: "desc" }],
    take: FOLLOW_PAGE_SIZE + 1,
    ...(validAfter
      ? {
          cursor: {
            followerId_followingId: followers
              ? { followerId: validAfter, followingId: profileUserId }
              : { followerId: profileUserId, followingId: validAfter },
          },
          skip: 1,
        }
      : {}),
    // Las dos personas de la relación: se usa la que no es el perfil.
    select: { follower: { select: personSelect }, following: { select: personSelect } },
  });
  const people = rows
    .slice(0, FOLLOW_PAGE_SIZE)
    .map((row) => (followers ? row.follower : row.following))
    .filter((person): person is NonNullable<typeof person> => Boolean(person?.profile));

  const followed = viewerId
    ? new Set(
        (
          await db.follow.findMany({
            where: { followerId: viewerId, followingId: { in: people.map((person) => person.id) } },
            select: { followingId: true },
          })
        ).map((row) => row.followingId),
      )
    : new Set<string>();

  return {
    people: people.map((person) => ({
      userId: person.id,
      username: person.profile!.username,
      displayName: person.profile!.displayName,
      avatarUrl: person.profile!.avatarUrl,
      isEditorial: person.profile!.isEditorial,
      isSeller: person.sellerProfile !== null,
      viewerFollows: followed.has(person.id),
      isViewer: person.id === viewerId,
    })),
    nextCursor: rows.length > FOLLOW_PAGE_SIZE ? (people.at(-1)?.id ?? null) : null,
  };
}
