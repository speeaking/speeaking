import type { FeedItemDTO } from "./dto";

/**
 * Productos (por slug) que ya aparecen en una página del feed. La columna derecha los usa para no
 * repetir en «Lo que buscas» un producto que la persona ya tiene enfrente: cuenta dentro del mismo
 * presupuesto comercial (1 de cada 4), así que mostrarlo dos veces sería anunciar de más.
 */
export function productSlugsIn(items: readonly Pick<FeedItemDTO, "product">[]): Set<string> {
  return new Set(items.flatMap((item) => (item.product ? [item.product.slug] : [])));
}

/** ¿El producto elegido para la columna ya está en la primera página del feed? */
export function repeatsFeedProduct(
  product: { slug: string } | null | undefined,
  items: readonly Pick<FeedItemDTO, "product">[],
): boolean {
  return product ? productSlugsIn(items).has(product.slug) : false;
}
