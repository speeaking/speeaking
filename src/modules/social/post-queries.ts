import "server-only";
import { type FeedItemDTO, toFeedItem } from "@/modules/feed/dto";
import { POST_WITH_VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { MAX_POST_IMAGES } from "./schemas";

/** UUID nulo: permite filtrar "lo del espectador" sin cambiar la forma de la consulta. */
const NO_VIEWER = "00000000-0000-0000-0000-000000000000";

/** Fotos en orden, hasta el máximo que muestra una publicación (feed y carrusel), con su crédito. */
const mediaLinks = {
  orderBy: { position: "asc" },
  take: MAX_POST_IMAGES,
  select: {
    media: {
      select: {
        storageKey: true,
        width: true,
        height: true,
        blurDataUrl: true,
        altText: true,
        creditName: true,
        creditUrl: true,
        license: true,
      },
    },
  },
} as const;

/**
 * Convierte publicaciones en DTOs públicos, en el mismo orden que `ids`.
 * Solo selecciona campos públicos del producto: el costo nunca se consulta aquí, y `toFeedItem`
 * arma el DTO campo por campo.
 */
export async function hydratePosts(ids: string[], viewerId: string | null): Promise<FeedItemDTO[]> {
  if (ids.length === 0) return [];
  const viewer = viewerId ?? NO_VIEWER;
  const rows = await db.post.findMany({
    // Una publicación de un producto oculto por moderación desaparece con él (feed, perfil,
    // búsqueda, Guardados y su propia página).
    where: { id: { in: ids }, status: "PUBLISHED", AND: [POST_WITH_VISIBLE_PRODUCT] },
    select: {
      id: true,
      type: true,
      body: true,
      publishedAt: true,
      isAiGenerated: true,
      likeCount: true,
      commentCount: true,
      saveCount: true,
      author: {
        select: {
          id: true,
          profile: {
            select: { username: true, displayName: true, avatarUrl: true, isEditorial: true },
          },
          sellerProfile: { select: { status: true } },
        },
      },
      community: { select: { slug: true, name: true, emoji: true, hue: true } },
      media: mediaLinks,
      product: {
        select: {
          slug: true,
          title: true,
          priceCents: true,
          currency: true,
          stock: true,
          status: true,
          city: true,
          state: true,
          pickupAvailable: true,
          localDeliveryAvailable: true,
          localDeliveryZones: true,
          nationalShippingAvailable: true,
          shippingPriceCents: true,
          deliveryMinDays: true,
          deliveryMaxDays: true,
          warrantyType: true,
          warrantyDays: true,
          returnWindowDays: true,
          authenticity: true,
          category: { select: { name: true } },
          seller: { select: { acceptedPaymentMethods: true } },
          media: mediaLinks,
        },
      },
      likes: { where: { userId: viewer }, select: { userId: true } },
      saves: { where: { userId: viewer }, select: { id: true } },
    },
  });

  const storage = getStorage();
  const publicUrl = (storageKey: string) => storage.publicUrl(storageKey);
  const byId = new Map(
    rows.flatMap((row): [string, FeedItemDTO][] => {
      const item = toFeedItem(row, publicUrl);
      return item ? [[row.id, item]] : [];
    }),
  );
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}
