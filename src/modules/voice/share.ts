import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { conversationPair } from "@/modules/messages/pair";
import { friendshipPair } from "@/modules/relationships/service";
import { friendsOf, postVisibleTo } from "@/modules/relationships/privacy";
import { POST_WITH_VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import { DEFAULT_SHARE_NOTE, type VoiceFriend } from "./commands";

const UNAVAILABLE =
  "No podemos compartir esta publicación con esa persona. Revisa la amistad y la audiencia.";
const FRIEND_SELECT = {
  id: true,
  profile: { select: { username: true, displayName: true, avatarUrl: true } },
} as const;

function friendWhere(viewerId: string, recipientId?: string): Prisma.UserWhereInput {
  return {
    ...(recipientId ? { id: recipientId } : {}),
    AND: [friendsOf(viewerId)],
    accountRestriction: null,
    profile: { onboardedAt: { not: null }, isEditorial: false },
  };
}

export async function voiceFriends(viewerId: string, query: string): Promise<VoiceFriend[]> {
  const rows = await db.user.findMany({
    where: {
      ...friendWhere(viewerId),
      ...(query
        ? {
            profile: {
              onboardedAt: { not: null },
              isEditorial: false,
              OR: [
                { username: { contains: query.replace(/^@/u, ""), mode: "insensitive" } },
                { displayName: { contains: query, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    select: FRIEND_SELECT,
    take: 6,
    orderBy: [{ profile: { displayName: "asc" } }, { id: "asc" }],
  });
  return rows.flatMap((row) => (row.profile ? [{ userId: row.id, ...row.profile }] : []));
}

/** Comprueba la amistad y la publicación para las DOS personas, incluso al preparar. */
export async function prepareVoiceShare(viewerId: string, postId: string, recipientId: string) {
  const [friend, post] = await Promise.all([
    db.user.findFirst({ where: friendWhere(viewerId, recipientId), select: FRIEND_SELECT }),
    db.post.findFirst({
      where: {
        id: postId,
        status: "PUBLISHED",
        AND: [POST_WITH_VISIBLE_PRODUCT, postVisibleTo(viewerId), postVisibleTo(recipientId)],
      },
      select: { id: true },
    }),
  ]);
  if (!friend?.profile || !post) return { ok: false as const, error: UNAVAILABLE };
  return {
    ok: true as const,
    friend: { userId: friend.id, ...friend.profile },
    url: new URL(`/p/${postId}`, env.APP_URL).href,
  };
}

/** Solo se guarda el enlace, nunca una copia del texto privado ni de sus fotos. */
export async function confirmVoiceShare(
  viewerId: string,
  input: {
    postId: string;
    recipientId: string;
    note: string;
    requestId: string;
  },
) {
  const prepared = await prepareVoiceShare(viewerId, input.postId, input.recipientId);
  if (!prepared.ok) return prepared;
  const pair = conversationPair(viewerId, input.recipientId);
  const body = `${input.note.trim() || DEFAULT_SHARE_NOTE}\n${prepared.url}`;
  const previous = await db.message.findUnique({
    where: { id: input.requestId },
    select: {
      senderId: true,
      body: true,
      conversationId: true,
      conversation: { select: { userAId: true, userBId: true } },
    },
  });
  if (previous) {
    if (
      previous.senderId !== viewerId ||
      previous.body !== body ||
      previous.conversation.userAId !== pair.userAId ||
      previous.conversation.userBId !== pair.userBId
    )
      return {
        ok: false as const,
        error: "Este envío ya no coincide con el borrador. Prepáralo de nuevo.",
      };
    return { ok: true as const, conversationId: previous.conversationId };
  }
  // Mismos límites que los mensajes escritos; la voz no abre una vía para saltarlos.
  const limited = limitOrError(
    await rateLimit({
      key: rateLimitKey("messages.send", "user", viewerId)!,
      limit: 30,
      windowSeconds: 600,
    }),
  );
  if (limited) return { ok: false as const, error: limited };
  if (
    !(await db.conversation.findUnique({ where: { userAId_userBId: pair }, select: { id: true } }))
  ) {
    const newLimited = limitOrError(
      await rateLimit({
        key: rateLimitKey("messages.new", "user", viewerId)!,
        limit: 20,
        windowSeconds: 86_400,
      }),
    );
    if (newLimited) return { ok: false as const, error: newLimited };
  }
  try {
    return await db.$transaction(async (tx) => {
      const friendship = friendshipPair(viewerId, input.recipientId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`friendship:${friendship.userAId}:${friendship.userBId}`}, 0))`;
      // Impide un cambio de audiencia o eliminación durante la comprobación y el envío.
      await tx.$queryRaw`SELECT "id" FROM "posts" WHERE "id" = ${input.postId}::uuid FOR SHARE`;
      const [friend, post] = await Promise.all([
        tx.user.findFirst({
          where: friendWhere(viewerId, input.recipientId),
          select: { id: true },
        }),
        tx.post.findFirst({
          where: {
            id: input.postId,
            status: "PUBLISHED",
            AND: [
              POST_WITH_VISIBLE_PRODUCT,
              postVisibleTo(viewerId),
              postVisibleTo(input.recipientId),
            ],
          },
          select: { id: true },
        }),
      ]);
      if (!friend || !post) return { ok: false as const, error: UNAVAILABLE };
      const conversation = await tx.conversation.upsert({
        where: { userAId_userBId: pair },
        create: pair,
        update: {},
        select: { id: true },
      });
      // Repetir la misma confirmación no duplica el mensaje (también entre peticiones simultáneas).
      const existing = await tx.message.findUnique({
        where: { id: input.requestId },
        select: { senderId: true, conversationId: true, body: true },
      });
      if (existing)
        return existing.senderId === viewerId &&
          existing.conversationId === conversation.id &&
          existing.body === body
          ? { ok: true as const, conversationId: conversation.id }
          : { ok: false as const, error: "Prepara un envío nuevo." };
      const now = new Date();
      await tx.message.create({
        data: {
          id: input.requestId,
          conversationId: conversation.id,
          senderId: viewerId,
          body,
          createdAt: now,
        },
      });
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: now,
          [pair.userAId === viewerId ? "aReadAt" : "bReadAt"]: now,
        },
      });
      return { ok: true as const, conversationId: conversation.id };
    });
  } catch {
    return {
      ok: false as const,
      error: "No pudimos confirmar el envío. Puedes reintentar; no se enviará dos veces.",
    };
  }
}
