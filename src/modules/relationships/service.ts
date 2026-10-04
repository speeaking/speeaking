import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { FriendshipCommand, FriendshipState } from "./types";

export function friendshipPair(a: string, b: string) {
  const ids = [a.toLowerCase(), b.toLowerCase()].sort();
  return { userAId: ids[0]!, userBId: ids[1]! };
}

export async function friendshipWith(
  viewerId: string | null,
  targetId: string,
): Promise<FriendshipState> {
  if (!viewerId) return "none";
  if (viewerId === targetId) return "self";
  const pair = friendshipPair(viewerId, targetId);
  const [friendship, blocked] = await Promise.all([
    db.friendship.findUnique({
      where: { userAId_userBId: pair },
      select: { status: true, requesterId: true },
    }),
    db.messageBlock.findFirst({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: targetId },
          { blockerId: targetId, blockedId: viewerId },
        ],
      },
      select: { blockerId: true },
    }),
  ]);
  if (blocked) return "unavailable";
  if (!friendship) return "none";
  if (friendship.status === "ACCEPTED") return "friends";
  return friendship.requesterId === viewerId ? "outgoing" : "incoming";
}

/** Las transiciones y sus avisos se guardan juntos; solo el destinatario puede aceptar. */
export async function changeFriendship(
  viewerId: string,
  targetId: string,
  command: FriendshipCommand,
) {
  if (viewerId === targetId) return;
  const pair = friendshipPair(viewerId, targetId);
  const requestKey = (sender: string, recipient: string) => `friend-request:${sender}:${recipient}`;
  const acceptedKey = `friend-accepted:${pair.userAId}:${pair.userBId}`;
  await db.$transaction(async (tx) => {
    // Serializa los cambios de este par, incluidos los bloqueos hechos desde mensajes.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`friendship:${pair.userAId}:${pair.userBId}`}, 0))`;
    const target = await tx.profile.findUnique({
      where: { userId: targetId },
      select: { onboardedAt: true, isEditorial: true },
    });
    if (!target?.onboardedAt || target.isEditorial) throw new Error("TARGET_UNAVAILABLE");
    if (command === "request" || command === "accept") {
      const blocked = await tx.messageBlock.findFirst({
        where: {
          OR: [
            { blockerId: viewerId, blockedId: targetId },
            { blockerId: targetId, blockedId: viewerId },
          ],
        },
        select: { blockerId: true },
      });
      if (blocked) return;
    }
    if (command === "request") {
      const created = await tx.friendship.createMany({
        data: [{ ...pair, requesterId: viewerId }],
        skipDuplicates: true,
      });
      if (created.count)
        await tx.notification.upsert({
          where: { dedupeKey: requestKey(viewerId, targetId) },
          create: {
            actorId: viewerId,
            recipientId: targetId,
            type: "FRIEND_REQUEST",
            dedupeKey: requestKey(viewerId, targetId),
          },
          update: { readAt: null, createdAt: new Date() },
        });
      return;
    }
    if (command === "accept") {
      const accepted = await tx.friendship.updateMany({
        where: { ...pair, requesterId: targetId, status: "PENDING" },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      if (accepted.count) {
        await tx.notification.deleteMany({ where: { dedupeKey: requestKey(targetId, viewerId) } });
        await tx.notification.upsert({
          where: { dedupeKey: acceptedKey },
          create: {
            actorId: viewerId,
            recipientId: targetId,
            type: "FRIEND_ACCEPTED",
            dedupeKey: acceptedKey,
          },
          update: { actorId: viewerId, recipientId: targetId, readAt: null, createdAt: new Date() },
        });
      }
      return;
    }
    const where: Prisma.FriendshipWhereInput = {
      ...pair,
      ...(command === "remove"
        ? { status: "ACCEPTED" }
        : {
            status: "PENDING",
            requesterId: command === "cancel" ? viewerId : targetId,
          }),
    };
    const removed = await tx.friendship.deleteMany({ where });
    if (removed.count)
      await tx.notification.deleteMany({
        where: {
          dedupeKey: {
            in: [requestKey(viewerId, targetId), requestKey(targetId, viewerId), acceptedKey],
          },
        },
      });
  });
}
