import type { CartLine } from "./cart";

/**
 * Lo que ve el panel del carrito al agregar algo (ADR-052): solo datos públicos del producto y la
 * cantidad; nunca el costo. El subtotal lo suma el código (P2); el envío se calcula al pagar.
 */
export type CartSheetLineDTO = {
  itemId: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  quantity: number;
  priceCents: number;
  currency: string;
  available: boolean;
};

export type CartSheetDTO = {
  /** Piezas en total (suma de cantidades). */
  count: number;
  subtotalCents: number;
  currency: string;
  lines: CartSheetLineDTO[];
};

export function toCartSheet(lines: readonly CartLine[], fallbackCurrency = "MXN"): CartSheetDTO {
  const mapped = lines.map((line) => ({
    itemId: line.itemId,
    slug: line.product.slug,
    title: line.product.title,
    imageUrl: line.product.imageUrl,
    quantity: line.quantity,
    priceCents: line.product.priceCents,
    currency: line.product.currency,
    available: line.product.available,
  }));
  return {
    count: mapped.reduce((sum, line) => sum + line.quantity, 0),
    // Solo lo que sí se puede comprar entra al subtotal (lo demás se avisa en la línea).
    subtotalCents: mapped
      .filter((line) => line.available)
      .reduce((sum, line) => sum + line.priceCents * line.quantity, 0),
    currency: mapped[0]?.currency ?? fallbackCurrency,
    lines: mapped,
  };
}
