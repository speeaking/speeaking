import "server-only";
import { POST_WITH_VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";

export type PublicProfile = {
  userId: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isEditorial: boolean;
  isSeller: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  viewerFollows: boolean;
};

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
      isEditorial: true,
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

  const viewerFollows = viewerId
    ? (await db.follow.count({
        where: { followerId: viewerId, followingId: profile.userId },
      })) > 0
    : false;

  return {
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    isEditorial: profile.isEditorial,
    isSeller: profile.user.sellerProfile !== null,
    followerCount: profile.user._count.followers,
    followingCount: profile.user._count.following,
    postCount: profile.user._count.posts,
    viewerFollows,
  };
}
