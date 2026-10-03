"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { checkSocialLimit } from "@/modules/social/limits";
import { CONTENT_KINDS, type OwnContentKind } from "./content-removal-types";
import { getViewer } from "./session";

export async function removeOwnContentAction(
  kind: OwnContentKind,
  id: string | string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Inicia sesión para administrar tu contenido." };
  if (!z.enum(CONTENT_KINDS).safeParse(kind).success)
    return { ok: false, error: "Acción inválida." };
  const many = ["notifications", "saved", "cart"].includes(kind);
  const ids = z
    .array(z.uuid())
    .min(1)
    .max(80)
    .safeParse(Array.isArray(id) ? id : [id]);
  if ((many ? id !== "all" : !ids.success) || (kind !== "notification" && Array.isArray(id)))
    return { ok: false, error: "Contenido inválido." };
  const limited = await checkSocialLimit("deleteContent", viewer.userId);
  if (!limited.ok) return { ok: false, error: limited.error };
  const userId = viewer.userId;
  let count = 0;
  switch (kind) {
    case "post":
      count = (
        await db.post.updateMany({
          where: { id: id as string, authorId: userId, status: { not: "REMOVED" } },
          data: { status: "REMOVED" },
        })
      ).count;
      break;
    case "comment":
      count = await db.$transaction(async (tx) => {
        const row = await tx.comment.findFirst({
          where: { id: id as string, authorId: userId, status: { not: "REMOVED" } },
          select: { postId: true, status: true },
        });
        if (!row) return 0;
        const result = await tx.comment.updateMany({
          where: { id: id as string, authorId: userId, status: row.status },
          data: { status: "REMOVED" },
        });
        if (result.count && row.status === "PUBLISHED")
          await tx.post.updateMany({
            where: { id: row.postId, commentCount: { gt: 0 } },
            data: { commentCount: { decrement: 1 } },
          });
        return result.count;
      });
      break;
    case "product":
      count = await db.$transaction(async (tx) => {
        const result = await tx.product.updateMany({
          where: { id: id as string, seller: { userId }, status: { not: "ARCHIVED" } },
          data: { status: "ARCHIVED", featuredUntil: null },
        });
        if (result.count)
          await tx.post.updateMany({
            where: { productId: id as string, authorId: userId, status: { not: "REMOVED" } },
            data: { status: "REMOVED" },
          });
        return result.count;
      });
      break;
    case "purchase":
      count = (
        await db.checkout.updateMany({
          where: { id: id as string, buyerId: userId, buyerHiddenAt: null },
          data: { buyerHiddenAt: new Date() },
        })
      ).count;
      break;
    case "message":
      count = await db.$transaction(async (tx) => {
        const message = await tx.message.findFirst({
          where: { id: id as string, senderId: userId },
          select: { conversationId: true },
        });
        if (!message) return 0;
        // Serializa con otros borrados y con el envío para no dejar un último mensaje inexistente.
        const conversations = await tx.$queryRaw<
          { createdAt: Date }[]
        >`SELECT "createdAt" FROM "conversations" WHERE id = ${message.conversationId}::uuid FOR UPDATE`;
        if (!conversations[0]) return 0;
        const result = await tx.message.deleteMany({
          where: { id: id as string, senderId: userId },
        });
        if (!result.count) return 0;
        const last = await tx.message.findFirst({
          where: { conversationId: message.conversationId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        await tx.conversation.update({
          where: { id: message.conversationId },
          data: { lastMessageAt: last?.createdAt ?? conversations[0].createdAt },
        });
        return result.count;
      });
      break;
    case "conversation": {
      const now = new Date();
      const a = await db.conversation.updateMany({
        where: { id: id as string, userAId: userId },
        data: { aClearedAt: now, aReadAt: now },
      });
      count =
        a.count ||
        (
          await db.conversation.updateMany({
            where: { id: id as string, userBId: userId },
            data: { bClearedAt: now, bReadAt: now },
          })
        ).count;
      break;
    }
    case "notification":
      count = (
        await db.notification.deleteMany({
          where: { id: { in: ids.success ? ids.data : [] }, recipientId: userId },
        })
      ).count;
      break;
    case "notifications":
      await db.notification.deleteMany({ where: { recipientId: userId } });
      count = 1;
      break;
    case "saved":
      await db.$transaction(async (tx) => {
        // Solo se descuentan vínculos realmente borrados, también frente a toggles simultáneos.
        await tx.$queryRaw`
          WITH removed AS (
            DELETE FROM "saved_items" WHERE "userId" = ${userId}::uuid RETURNING "postId", "productId"
          ), posts_updated AS (
            UPDATE "posts" p SET "saveCount" = GREATEST(0, p."saveCount" - r.n::int)
            FROM (SELECT "postId", count(*) n FROM removed WHERE "postId" IS NOT NULL GROUP BY "postId") r
            WHERE p.id = r."postId" RETURNING p.id
          ), products_updated AS (
            UPDATE "products" p SET "saveCount" = GREATEST(0, p."saveCount" - r.n::int)
            FROM (SELECT "productId", count(*) n FROM removed WHERE "productId" IS NOT NULL GROUP BY "productId") r
            WHERE p.id = r."productId" RETURNING p.id
          ) SELECT count(*) FROM removed`;
      });
      count = 1;
      break;
    case "cart":
      await db.cartItem.deleteMany({ where: { cart: { userId } } });
      count = 1;
      break;
  }
  if (!count) return { ok: false, error: "El contenido ya no está disponible o no te pertenece." };
  revalidatePath("/", "layout");
  return { ok: true };
}
