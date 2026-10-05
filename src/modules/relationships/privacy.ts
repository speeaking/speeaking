import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { PLATFORM_ADMIN_EMAIL } from "@/modules/identity/platform-account";

/** Seguir o comprar no concede acceso. Un bloqueo también corta el acceso entre amigos. */
export function friendsOf(viewerId: string): Prisma.UserWhereInput {
  return {
    OR: [
      { friendshipsAsA: { some: { userBId: viewerId, status: "ACCEPTED" } } },
      { friendshipsAsB: { some: { userAId: viewerId, status: "ACCEPTED" } } },
    ],
    messageBlocksMade: { none: { blockedId: viewerId } },
    messageBlocksReceived: { none: { blockerId: viewerId } },
  };
}

/** Perfiles que publican para toda la plataforma. Ser ADMIN de otra cuenta no la hace pública. */
export const PUBLIC_PROFILE: Prisma.ProfileWhereInput = {
  OR: [
    { isEditorial: true },
    {
      role: "ADMIN",
      user: { email: { equals: PLATFORM_ADMIN_EMAIL, mode: "insensitive" } },
    },
  ],
};

/** La audiencia de la publicación se aplica también a productos, editorial y administradores. */
export const PUBLIC_POST: Prisma.PostWhereInput = { audience: "PUBLIC" };

export function postVisibleTo(viewerId: string | null): Prisma.PostWhereInput {
  return viewerId
    ? {
        OR: [
          PUBLIC_POST,
          { authorId: viewerId },
          { audience: "FRIENDS", author: friendsOf(viewerId) },
        ],
      }
    : PUBLIC_POST;
}

/** SQL parametrizado con la misma audiencia que Prisma. Los alias son constantes del código. */
export function postVisibleToSql(viewerId: string | null, alias: "p" | "r" = "p") {
  const author = Prisma.raw(`${alias}."authorId"`);
  const audience = Prisma.raw(`${alias}."audience"`);
  const publicPost = Prisma.sql`(${audience} = 'PUBLIC')`;
  if (!viewerId) return publicPost;
  return Prisma.sql`(${publicPost} OR ${author} = ${viewerId}::uuid OR (
    ${audience} = 'FRIENDS'
    AND EXISTS (SELECT 1 FROM "friendships" friendship
      WHERE friendship."status" = 'ACCEPTED' AND (
        (friendship."userAId" = ${author} AND friendship."userBId" = ${viewerId}::uuid)
        OR (friendship."userBId" = ${author} AND friendship."userAId" = ${viewerId}::uuid)
      ))
    AND NOT EXISTS (SELECT 1 FROM "message_blocks" privacy_block
      WHERE (privacy_block."blockerId" = ${author} AND privacy_block."blockedId" = ${viewerId}::uuid)
        OR (privacy_block."blockedId" = ${author} AND privacy_block."blockerId" = ${viewerId}::uuid))
  ))`;
}
