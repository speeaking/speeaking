import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { excerpt, type NotificationRow } from "./group";
import { postVisibleTo } from "@/modules/relationships/privacy";
import { POST_WITH_VISIBLE_PRODUCT } from "@/modules/trust/visibility";

/** Avisos que se muestran (los más recientes); los grupos los vuelven menos. */
export const NOTIFICATIONS_SHOWN = 80;
/** Lo que pasa de aquí lo borra la operación diaria. */
export const NOTIFICATION_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Solo avisos de lo que sigue visible: una publicación o un comentario retirados por moderación
 * ya no avisan nada.
 */
const visible = (recipientId: string): Prisma.NotificationWhereInput => ({
  recipientId,
  AND: [
    {
      OR: [
        { postId: null },
        {
          post: {
            status: "PUBLISHED",
            AND: [POST_WITH_VISIBLE_PRODUCT, postVisibleTo(recipientId)],
          },
        },
      ],
    },
    { OR: [{ commentId: null }, { comment: { status: "PUBLISHED" } }] },
    {
      OR: [
        { type: { not: "COMMUNITY_INVITE" } },
        {
          community: { invitations: { some: { userId: recipientId } } },
          actor: {
            messageBlocksMade: { none: { blockedId: recipientId } },
            messageBlocksReceived: { none: { blockerId: recipientId } },
          },
        },
      ],
    },
  ],
});

/** El número de la campana: avisos sin leer de lo que sigue visible. */
export function countUnreadNotifications(userId: string) {
  return db.notification.count({ where: { ...visible(userId), readAt: null } });
}

/** Los avisos de la persona, con lo público de quién los causó y de qué (sin costos ni datos privados). */
export async function listNotifications(userId: string): Promise<NotificationRow[]> {
  const rows = await db.notification.findMany({
    where: visible(userId),
    orderBy: { createdAt: "desc" },
    take: NOTIFICATIONS_SHOWN,
    select: {
      id: true,
      type: true,
      createdAt: true,
      readAt: true,
      reaction: true,
      actor: {
        select: {
          id: true,
          profile: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      },
      post: { select: { id: true, body: true } },
      comment: { select: { body: true } },
      community: { select: { name: true, slug: true } },
      order: {
        select: {
          id: true,
          items: { take: 1, select: { titleSnapshot: true } },
          _count: { select: { items: true } },
        },
      },
    },
  });
  return rows.flatMap((row): NotificationRow[] => {
    const actor = row.actor?.profile ?? null;
    // Quien lo causó ya no tiene perfil: el aviso ya no dice nada.
    if (row.actor && !actor) return [];
    const firstItem = row.order?.items[0]?.titleSnapshot ?? null;
    const moreItems = (row.order?._count.items ?? 0) - 1;
    return [
      {
        id: row.id,
        type: row.type,
        createdAt: row.createdAt,
        readAt: row.readAt,
        actor: actor && row.actor ? { ...actor, userId: row.actor.id } : null,
        postId: row.post?.id ?? null,
        postExcerpt: excerpt(row.post?.body ?? null),
        commentExcerpt: excerpt(row.comment?.body ?? null),
        reaction: row.reaction,
        communityName: row.community?.name ?? null,
        communitySlug: row.community?.slug ?? null,
        orderId: row.order?.id ?? null,
        orderTitle: firstItem
          ? moreItems > 0
            ? `${firstItem} y ${moreItems} más`
            : firstItem
          : null,
      },
    ];
  });
}

/** Abrir la campana marca todo como leído. Devuelve cuántos cambiaron. */
export async function markNotificationsRead(
  userId: string,
  now = new Date(),
  ids?: readonly string[],
) {
  const { count } = await db.notification.updateMany({
    where: { recipientId: userId, readAt: null, ...(ids ? { id: { in: [...ids] } } : {}) },
    data: { readAt: now },
  });
  return count;
}

/** Operación diaria: borra los avisos de más de 90 días. */
export async function deleteOldNotifications(now = new Date()) {
  const { count } = await db.notification.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * DAY_MS) } },
  });
  return count;
}
