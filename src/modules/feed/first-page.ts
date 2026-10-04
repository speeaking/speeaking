import "server-only";
import { cache } from "react";
import type { FeedPageDTO } from "./dto";
import { recommendationEngine } from "./engine";
import { productSlugsIn } from "./dedupe";
import { pickFeedProducts } from "./product-carousel";
import { listHomeReelVideos } from "@/modules/social/video-queries";
import { composeHomeReels } from "./home-reels";

/**
 * Primera página de «Para ti», una sola vez por request. La usan la página de inicio y la columna
 * derecha («Lo que buscas»), que así no repite un producto que el feed ya muestra (regla del
 * presupuesto comercial del rediseño). El argumento es un primitivo a propósito: `cache` compara por
 * identidad, y un objeto nuevo en cada llamada nunca coincidiría.
 */
export const getHomeFirstPage = cache(async (viewerId: string | null): Promise<FeedPageDTO> => {
  const page = await recommendationEngine.getFeed({ viewerId });
  // El carrusel nunca tumba el feed: si falla, la página va sin él.
  const products = await pickFeedProducts({
    viewerId,
    pageIndex: 0,
    exclude: productSlugsIn(page.items),
  }).catch((error: unknown) => {
    console.error("[feed] carrusel de productos", error);
    return null;
  });
  return { ...page, products };
});

/** La vitrina superior también se muestra con un producto y puede repetir lo del feed. */
export const getHomeProductReels = cache(async (viewerId: string | null) => {
  return pickFeedProducts({
    viewerId,
    pageIndex: 0,
    exclude: new Set(),
    minimumItems: 1,
    includeOwn: true,
  }).catch((error: unknown) => {
    console.error("[feed] no se pudo cargar la vitrina de productos", error);
    return null;
  });
});

/** Productos y videos se consultan por separado: un catálogo vacío no oculta las actualizaciones. */
export const getHomeReels = cache(async (viewerId: string | null) => {
  const [products, videos] = await Promise.all([
    getHomeProductReels(viewerId),
    listHomeReelVideos(viewerId).catch((error: unknown) => {
      console.error("[feed] no se pudieron cargar los videos de la vitrina", error);
      return { items: [], platformUpdateId: null };
    }),
  ]);
  return composeHomeReels(products, videos.items, videos.platformUpdateId);
});
