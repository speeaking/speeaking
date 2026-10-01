import "server-only";
import { POST_WITH_VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";

export type ProfilePersonDTO = { username: string; displayName: string; avatarUrl: string | null };

export type PublicProfile = {
  userId: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  city: string | null;
  joinedAt: Date;
  isEditorial: boolean;
  isSeller: boolean;
  /** Id de la tienda, para la pestaña Tienda (ADR-055); `null` si no vende. */
  sellerId: string | null;
  /** Portada propia (ADR-058); sin ella el perfil arma una con su última foto. */
  cover: {
    url: string;
    width: number;
    height: number;
    blurDataUrl: string | null;
    alt: string | null;
    credit: null;
  } | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  viewerFollows: boolean;
  /** Gente que quien mira sigue y que sigue este perfil; vacío sin sesión o en el perfil propio. */
  followedByPeopleYouFollow: { count: number; people: ProfilePersonDTO[] };
  /** Comunidades en común con quien mira (hasta 3); vacío sin sesión o en el propio. */
  communitiesInCommon: { slug: string; name: string }[];
};

const IN_COMMON_SHOWN = 3;

/** Perfil público (DTO explícito: nada de correo ni datos privados). */
export async function getPublicProfile(
  username: string,
  viewerId: string | null,
): Promise<PublicProfile | null> {
  const profile = await db.profile.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      userId: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      city: true,
      createdAt: true,
      isEditorial: true,
      coverMedia: {
        select: { storageKey: true, width: true, height: true, blurDataUrl: true, altText: true },
      },
      user: {
        select: {
          sellerProfile: { select: { id: true } },
          _count: {
            select: {
              followers: true,
              following: true,
              posts: { where: { status: "PUBLISHED", AND: [POST_WITH_VISIBLE_PRODUCT] } },
            },
          },
        },
      },
    },
  });
  if (!profile) return null;

  // Lo «en común» (ADR-055) solo tiene sentido con sesión y en un perfil ajeno: gente que sigues
  // que también sigue este perfil, y comunidades donde están los dos. Datos propios (principio 6).
  const other = viewerId !== null && viewerId !== profile.userId ? viewerId : null;
  const followedByYours = other
    ? { followingId: profile.userId, follower: { followers: { some: { followerId: other } } } }
    : null;
  const [viewerFollows, people, peopleCount, communities] =
    other && followedByYours
      ? await Promise.all([
          db.follow
            .count({ where: { followerId: other, followingId: profile.userId } })
            .then((count) => count > 0),
          db.follow.findMany({
            where: followedByYours,
            orderBy: { createdAt: "desc" },
            take: IN_COMMON_SHOWN,
            select: {
              follower: {
                select: {
                  profile: { select: { username: true, displayName: true, avatarUrl: true } },
                },
              },
            },
          }),
          db.follow.count({ where: followedByYours }),
          db.communityMembership.findMany({
            where: {
              userId: profile.userId,
              community: { memberships: { some: { userId: other } } },
            },
            take: IN_COMMON_SHOWN,
            select: { community: { select: { slug: true, name: true } } },
          }),
        ])
      : [false, [], 0, []];

  return {
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    city: profile.city,
    joinedAt: profile.createdAt,
    isEditorial: profile.isEditorial,
    isSeller: profile.user.sellerProfile !== null,
    sellerId: profile.user.sellerProfile?.id ?? null,
    cover: profile.coverMedia
      ? {
          url: getStorage().publicUrl(profile.coverMedia.storageKey),
          width: profile.coverMedia.width,
          height: profile.coverMedia.height,
          blurDataUrl: profile.coverMedia.blurDataUrl,
          alt: profile.coverMedia.altText,
          credit: null,
        }
      : null,
    followerCount: profile.user._count.followers,
    followingCount: profile.user._count.following,
    postCount: profile.user._count.posts,
    viewerFollows,
    followedByPeopleYouFollow: {
      count: peopleCount,
      people: people.flatMap((row) => (row.follower.profile ? [row.follower.profile] : [])),
    },
    communitiesInCommon: communities.map((row) => row.community),
  };
}
