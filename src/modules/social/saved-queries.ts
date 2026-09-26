import "server-only";
import { db } from "@/server/db";

/** Guardados que se muestran en /guardados por tipo. */
export const SAVED_LIMIT = 30;

/** Productos guardados que se muestran: los pausados vuelven a aparecer cuando se reactivan. */
export const SAVED_PRODUCT_STATUSES = ["ACTIVE", "SOLD_OUT"] as const;

/**
 * Lo que guardó una persona, lo más reciente primero: IDs de publicaciones visibles y de
 * productos activos o agotados (nunca borradores, pausados ni archivados). Solo lee los guardados
 * de `userId`: quien llama pasa el de la sesión.
 */
export async function listSavedItemIds(userId: string, limit: number = SAVED_LIMIT) {
  const [posts, products] = await Promise.all([
    db.savedItem.findMany({
      where: { userId, post: { status: "PUBLISHED" } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { postId: true },
    }),
    db.savedItem.findMany({
      where: { userId, product: { status: { in: [...SAVED_PRODUCT_STATUSES] } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { productId: true },
    }),
  ]);
  return {
    postIds: posts.flatMap((item) => (item.postId ? [item.postId] : [])),
    productIds: products.flatMap((item) => (item.productId ? [item.productId] : [])),
  };
}
