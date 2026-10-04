import "server-only";
import type { NotificationType, ReactionKind } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { mentionedUsernames } from "@/modules/social/mentions";
import { postVisibleTo } from "@/modules/relationships/privacy";
import { POST_WITH_VISIBLE_PRODUCT } from "@/modules/trust/visibility";

/**
 * Crear y quitar avisos (ADR-059). Siempre «a lo mejor posible»: si el aviso falla, la acción que lo
 * causó (reaccionar, comentar, seguir, pagar) ya ocurrió y no se deshace; solo se registra el error.
 * Nadie recibe avisos de lo que hizo él mismo.
 */
async function safely(label: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    console.error(`[avisos] no se pudo ${label}`, error);
  }
}

const reactionKey = (actorId: string, postId: string) => `reaction:${actorId}:${postId}`;
const followKey = (actorId: string, recipientId: string) => `follow:${actorId}:${recipientId}`;

/** Solo avisa a cuentas existentes con acceso al contenido y sin bloqueos entre las personas. */
export function notifyMentions(input: {
  actorId: string;
  postId: string;
  body: string;
  commentId?: string;
  skipRecipientId?: string;
}) {
  const usernames = mentionedUsernames(input.body);
  if (!usernames.length) return Promise.resolve();
  return safely("avisar de una mención", async () => {
    const recipients = await db.profile.findMany({
      where: {
        username: { in: usernames },
        userId: {
          notIn: [input.actorId, ...(input.skipRecipientId ? [input.skipRecipientId] : [])],
        },
        onboardedAt: { not: null },
        isEditorial: false,
        user: {
          messageBlocksMade: { none: { blockedId: input.actorId } },
          messageBlocksReceived: { none: { blockerId: input.actorId } },
        },
      },
      select: { userId: true },
    });
    const readable = await Promise.all(
      recipients.map(async ({ userId }) => {
        const post = await db.post.findFirst({
          where: {
            id: input.postId,
            status: "PUBLISHED",
            AND: [POST_WITH_VISIBLE_PRODUCT, postVisibleTo(userId)],
          },
          select: { id: true },
        });
        return post ? userId : null;
      }),
    );
    const recipientIds = readable.filter((id): id is string => id !== null);
    if (!recipientIds.length) return;
    await db.notification.createMany({
      data: recipientIds.map((recipientId) => ({
        type: "MENTION" as const,
        actorId: input.actorId,
        postId: input.postId,
        commentId: input.commentId ?? null,
        recipientId,
        dedupeKey: `mention:${input.commentId ?? input.postId}:${recipientId}`,
      })),
      skipDuplicates: true,
    });
  });
}

/** Alguien reaccionó: un solo aviso por persona y publicación; cambiar de reacción no lo repite. */
export function notifyReaction(input: {
  recipientId: string;
  actorId: string;
  postId: string;
  reaction: ReactionKind;
}) {
  if (input.recipientId === input.actorId) return Promise.resolve();
  const dedupeKey = reactionKey(input.actorId, input.postId);
  return safely("avisar una reacción", () =>
    db.notification.upsert({
      where: { dedupeKey },
      create: { ...input, type: "REACTION", dedupeKey },
      update: { reaction: input.reaction },
    }),
  );
}

/** Quitar la reacción quita su aviso. */
export function removeReactionNotification(input: { actorId: string; postId: string }) {
  return safely("quitar el aviso de una reacción", () =>
    db.notification.deleteMany({ where: { dedupeKey: reactionKey(input.actorId, input.postId) } }),
  );
}

/** Un aviso por comentario (se agrupan al mostrarlos). */
export function notifyComment(input: {
  recipientId: string;
  actorId: string;
  postId: string;
  commentId: string;
}) {
  if (input.recipientId === input.actorId) return Promise.resolve();
  return safely("avisar un comentario", () =>
    db.notification.create({ data: { ...input, type: "COMMENT" } }),
  );
}

/** Alguien empezó a seguirte (uno por persona). */
export function notifyFollow(input: { recipientId: string; actorId: string }) {
  if (input.recipientId === input.actorId) return Promise.resolve();
  const dedupeKey = followKey(input.actorId, input.recipientId);
  return safely("avisar un seguidor nuevo", () =>
    db.notification.upsert({
      where: { dedupeKey },
      create: { ...input, type: "FOLLOW", dedupeKey },
      update: {},
    }),
  );
}

/** Dejar de seguir quita el aviso de «empezó a seguirte». */
export function removeFollowNotification(input: { recipientId: string; actorId: string }) {
  return safely("quitar el aviso de un seguidor", () =>
    db.notification.deleteMany({
      where: { dedupeKey: followKey(input.actorId, input.recipientId) },
    }),
  );
}

const tagKey = (postId: string) => `tag:${postId}`;

/**
 * A la tienda: alguien etiquetó uno de sus productos en una publicación (ADR-063). Uno por
 * publicación; con él la tienda llega a su panel, donde puede quitar la etiqueta.
 */
export function notifyProductTagged(input: {
  recipientId: string;
  actorId: string;
  postId: string;
}) {
  if (input.recipientId === input.actorId) return Promise.resolve();
  const dedupeKey = tagKey(input.postId);
  return safely("avisar de un producto etiquetado", () =>
    db.notification.upsert({
      where: { dedupeKey },
      create: { ...input, type: "PRODUCT_TAGGED", dedupeKey },
      update: {},
    }),
  );
}

/**
 * A quien publicó: la tienda quitó la etiqueta de su producto. El aviso de «etiquetó tu producto»
 * de esa publicación ya no aplica y se borra.
 */
export function notifyProductTagRemoved(input: {
  recipientId: string;
  actorId: string;
  postId: string;
}) {
  if (input.recipientId === input.actorId) return Promise.resolve();
  return safely("avisar de una etiqueta quitada", () =>
    db.$transaction([
      db.notification.deleteMany({ where: { dedupeKey: tagKey(input.postId) } }),
      db.notification.create({ data: { ...input, type: "PRODUCT_TAG_REMOVED" } }),
    ]),
  );
}

type OrderNotice = Extract<
  NotificationType,
  "ORDER_PAID" | "ORDER_SHIPPED" | "ORDER_DELIVERED" | "ORDER_CANCELLED"
>;

/**
 * Pedidos: pagado → a quien vende; enviado, entregado o cancelado → a quien compra. Uno por pedido y
 * estado, aunque el proveedor de pagos repita la notificación.
 */
export function notifyOrders(type: OrderNotice, orderIds: readonly string[]) {
  if (orderIds.length === 0) return Promise.resolve();
  return safely("avisar de un pedido", async () => {
    const orders = await db.order.findMany({
      where: { id: { in: [...orderIds] } },
      select: { id: true, buyerId: true, seller: { select: { userId: true } } },
    });
    await db.notification.createMany({
      data: orders.map((order) => ({
        recipientId: type === "ORDER_PAID" ? order.seller.userId : order.buyerId,
        type,
        orderId: order.id,
        dedupeKey: `order:${order.id}:${type}`,
      })),
      skipDuplicates: true,
    });
  });
}
