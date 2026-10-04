import "server-only";
import { Prisma } from "@/generated/prisma/client";

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

/** Las publicaciones de productos y de la cuenta editorial son públicas; las personales, de amigos. */
export const PUBLIC_POST: Prisma.PostWhereInput = {
  OR: [{ productId: { not: null } }, { author: { profile: { isEditorial: true } } }],
};

export function postVisibleTo(viewerId: string | null): Prisma.PostWhereInput {
  return viewerId
    ? { OR: [PUBLIC_POST, { authorId: viewerId }, { author: friendsOf(viewerId) }] }
    : PUBLIC_POST;
}

/** Versión parametrizada para las búsquedas y los contadores que usan SQL. Alias fijos del código. */
export function postVisibleToSql(viewerId: string | null, alias: "p" | "r" = "p") {
  const author = Prisma.raw(`${alias}."authorId"`);
  const publicPost = Prisma.sql`(
    ${Prisma.raw(`${alias}."productId"`)} IS NOT NULL
    OR EXISTS (SELECT 1 FROM "profiles" privacy_profile
      WHERE privacy_profile."userId" = ${author} AND privacy_profile."isEditorial" = true)
  )`;
  if (!viewerId) return publicPost;
  return Prisma.sql`(${publicPost} OR ${author} = ${viewerId}::uuid OR (
    EXISTS (SELECT 1 FROM "friendships" friendship
      WHERE friendship."status" = 'ACCEPTED' AND (
        (friendship."userAId" = ${author} AND friendship."userBId" = ${viewerId}::uuid)
        OR (friendship."userBId" = ${author} AND friendship."userAId" = ${viewerId}::uuid)
      ))
    AND NOT EXISTS (SELECT 1 FROM "message_blocks" privacy_block
      WHERE (privacy_block."blockerId" = ${author} AND privacy_block."blockedId" = ${viewerId}::uuid)
        OR (privacy_block."blockedId" = ${author} AND privacy_block."blockerId" = ${viewerId}::uuid))
  ))`;
}
