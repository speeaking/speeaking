import { anonymizeUserActivity } from "@/modules/analytics/privacy";
import { deleteStoredMedia } from "@/modules/media/variant-keys";
import type { Prisma } from "@/generated/prisma/client";
import type { Database } from "@/server/db-client";
import type { StorageProvider } from "@/server/providers/storage/types";

/**
 * Borrar mi cuenta (ADR-048, derecho de cancelación). Dos caminos:
 *
 * - **Sin pedidos:** se borra la fila de la persona y todo cae en cascada (perfil, publicaciones,
 *   productos, fotos, mensajes, saldo, sesiones). Los archivos se borran después, uno a uno.
 * - **Con pedidos** (como quien compra o como tienda): los pedidos son registros de una operación y
 *   se conservan con los datos necesarios para atender la operación. La cuenta queda anonimizada: correo
 *   y nombre sustituidos, sin perfil (el usuario se libera), sin credenciales ni sesiones, tienda
 *   suspendida y productos archivados.
 *
 * En los dos casos la actividad analítica se anonimiza primero (`analytics/privacy.ts`). Sin
 * `server-only` ni `@/server/db`: recibe la base y el almacenamiento (se prueba contra la base).
 */
export type DeletionOutcome = { mode: "deleted" | "anonymized"; files: number };

export async function deleteAccount(
  client: Database,
  storage: Pick<StorageProvider, "delete">,
  userId: string,
  beforeDelete?: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<DeletionOutcome> {
  let media: { storageKey: string }[] = [];
  let keepOrders = false;

  await client.$transaction(async (tx) => {
    // La eliminación administrativa valida permisos y registra la acción en esta misma transacción.
    // El borrado propio no pasa este callback. Si falla, no se elimina ni se registra nada.
    await beforeDelete?.(tx);
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
    const [ownedMedia, asBuyer, asSeller, soldItems] = await Promise.all([
      tx.media.findMany({ where: { ownerId: userId }, select: { storageKey: true } }),
      tx.order.count({ where: { buyerId: userId } }),
      tx.order.count({ where: { seller: { userId } } }),
      tx.orderItem.count({ where: { product: { seller: { userId } } } }),
    ]);
    media = ownedMedia;
    keepOrders = asBuyer + asSeller + soldItems > 0;
    // Bloqueo ordenado: no deja grupos huérfanos ni roles pendientes al borrar/anonimizar la cuenta.
    await tx.$queryRaw`
      SELECT c.id FROM communities c
      WHERE c."ownerId" = ${userId}::uuid OR EXISTS (
        SELECT 1 FROM community_memberships m WHERE m."communityId" = c.id AND m."userId" = ${userId}::uuid
      ) ORDER BY c.id FOR UPDATE OF c
    `;
    const owned = await tx.community.findMany({ where: { ownerId: userId }, select: { id: true } });
    for (const community of owned) {
      const successor = await tx.communityMembership.findFirst({
        where: {
          communityId: community.id,
          userId: { not: userId },
          user: { profile: { onboardedAt: { not: null }, isEditorial: false } },
        },
        orderBy: [{ role: "desc" }, { createdAt: "asc" }, { userId: "asc" }],
        select: { userId: true },
      });
      if (successor) {
        await tx.community.update({
          where: { id: community.id },
          data: { ownerId: successor.userId },
        });
        await tx.communityMembership.update({
          where: { userId_communityId: { userId: successor.userId, communityId: community.id } },
          data: { role: "ADMIN" },
        });
      } else {
        await tx.community.delete({ where: { id: community.id } });
      }
    }
    await anonymizeUserActivity(userId, tx);
    // Las comunidades pierden a esta persona: el contador baja antes de que la membresía caiga.
    const memberships = await tx.communityMembership.findMany({
      where: { userId },
      select: { communityId: true },
    });
    if (memberships.length > 0) {
      await tx.community.updateMany({
        where: { id: { in: memberships.map((membership) => membership.communityId) } },
        data: { memberCount: { decrement: 1 } },
      });
    }
    if (!keepOrders) {
      await tx.user.delete({ where: { id: userId } });
      return;
    }
    // Conservar pedidos: se borra todo lo demás y la cuenta queda anonimizada.
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.post.deleteMany({ where: { authorId: userId } });
    await tx.comment.deleteMany({ where: { authorId: userId } });
    await tx.like.deleteMany({ where: { userId } });
    await tx.follow.deleteMany({
      where: { OR: [{ followerId: userId }, { followingId: userId }] },
    });
    await tx.friendship.deleteMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } });
    await tx.savedItem.deleteMany({ where: { userId } });
    await tx.communityMembership.deleteMany({ where: { userId } });
    await tx.communityInvitation.deleteMany({
      where: { OR: [{ userId }, { invitedById: userId }] },
    });
    await tx.communityRemoval.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({
      where: { OR: [{ recipientId: userId }, { actorId: userId }] },
    });
    await tx.userInterest.deleteMany({ where: { userId } });
    await tx.shoppingIntent.deleteMany({ where: { userId } });
    await tx.address.deleteMany({ where: { userId } });
    await tx.styleLook.deleteMany({ where: { userId } });
    await tx.suggestionDismissal.deleteMany({
      where: { OR: [{ userId }, { targetUserId: userId }] },
    });
    await tx.messageBlock.deleteMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    });
    await tx.tryOnPhoto.deleteMany({ where: { userId } });
    await tx.conversation.deleteMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } });
    await tx.cart.deleteMany({ where: { userId } });
    await tx.wallet.deleteMany({ where: { userId } });
    await tx.aIRequest.updateMany({ where: { userId }, data: { userId: null } });
    await tx.report.updateMany({ where: { reporterId: userId }, data: { reporterId: null } });
    await tx.product.updateMany({
      where: { seller: { userId } },
      data: { status: "ARCHIVED", featuredUntil: null },
    });
    await tx.sellerProfile.updateMany({
      where: { userId },
      data: {
        displayName: "Tienda eliminada",
        description: null,
        city: null,
        state: null,
        status: "SUSPENDED",
        sponsorsTryOn: false,
        tryOnDailyCapCents: 0,
      },
    });
    await tx.media.deleteMany({ where: { ownerId: userId } });
    await tx.profile.deleteMany({ where: { userId } });
    await tx.editorialAutomationToken.deleteMany({ where: { userId } });
    await tx.accountRestriction.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `eliminada-${userId}@speeaking.invalid`,
        name: "Cuenta eliminada",
        emailVerified: false,
        image: null,
      },
    });
  });

  let files = 0;
  for (const row of media) {
    try {
      await deleteStoredMedia(storage, row.storageKey);
      files += 1;
    } catch (error) {
      console.error("[identity] no se pudo borrar un archivo de la cuenta eliminada", error);
    }
  }
  return { mode: keepOrders ? "anonymized" : "deleted", files };
}
