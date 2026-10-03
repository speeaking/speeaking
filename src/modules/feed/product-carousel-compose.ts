import { siteConfig } from "@/config/site";
import type { ProductCardDTO } from "@/modules/catalog/queries";

/**
 * Carrusel de productos intercalado en el feed (ADR-051). Lo que la persona ve se decide aquí, sin
 * base de datos: primero lo patrocinado (las tiendas pagan por destacar, siempre etiquetado), luego
 * lo personal (su búsqueda declarada o sus comunidades) y, si falta, los respaldos para quien aún
 * no nos ha dicho nada: lo más vendido, lo más visto y lo recién publicado. Cada tramo lleva su
 * razón escrita: nada de «para ti» sin decir por qué.
 */

/** Tamaño de un carrusel: cabe en una fila de scroll sin cansar. */
export const FEED_PRODUCTS_SIZE = 8;
/** Patrocinados por carrusel: la etiqueta pesa; dos ya se notan. */
export const FEED_SPONSORED_MAX = 2;
/** Un carrusel con menos piezas se ve pobre: mejor no pintarlo. */
export const FEED_PRODUCTS_MIN = 3;

export type ProductTierKind = "intent" | "communities" | "bestSellers" | "popular" | "newest";

export type ProductTier = {
  kind: ProductTierKind;
  /** Ids en el orden del tramo (más relevante primero). */
  ids: readonly string[];
  /** Solo la intención: la búsqueda tal como la escribió la persona, con su tope si lo dijo. */
  reason?: string;
};

export type FeedProductItemDTO = { product: ProductCardDTO; sponsored: boolean };

export type FeedProductsDTO = {
  /** «Según tu búsqueda», «De tus comunidades», «Lo más vendido», «Populares», «Nuevo en speeaking». */
  title: string;
  /** La razón, escrita: «“lentes de sol” hasta $800», «En los últimos 30 días»… */
  reason: string;
  /** A dónde lleva «Ver todo». */
  href: string;
  items: FeedProductItemDTO[];
};

const TIER_COPY: Record<ProductTierKind, { title: string; reason: string }> = {
  // Distinto de «Lo que buscas» (la columna derecha): dos bloques no deben llamarse igual.
  intent: { title: "Según tu búsqueda", reason: "" },
  communities: { title: "De tus comunidades", reason: "Lo que venden donde participas" },
  bestSellers: { title: "Lo más vendido", reason: "En los últimos 30 días" },
  popular: { title: "Populares", reason: "Lo más visto esta semana" },
  newest: { title: `Nuevo en ${siteConfig.name}`, reason: "Recién publicado" },
};

/** Orden fijo de los respaldos; cada página empieza en uno distinto para no repetir el mismo tramo. */
export const FALLBACK_ORDER: readonly ProductTierKind[] = ["bestSellers", "popular", "newest"];

/** Rota la lista `steps` lugares (0 = igual). */
export function rotate<T>(list: readonly T[], steps: number): T[] {
  if (list.length === 0) return [];
  const shift = ((steps % list.length) + list.length) % list.length;
  return [...list.slice(shift), ...list.slice(0, shift)];
}

/**
 * Arma el carrusel de una página: patrocinados primero (sin repetir), luego cada tramo en orden hasta
 * llenar `size`. Nunca repite un producto ni uno que ya está en esa página del feed (`exclude`, por
 * slug). El título lo da el primer tramo que aportó algo; con solo patrocinados, «Patrocinado».
 * Devuelve `null` si no se juntan `FEED_PRODUCTS_MIN`.
 */
export function composeFeedProducts({
  sponsored,
  tiers,
  cards,
  exclude,
  size = FEED_PRODUCTS_SIZE,
  minimumItems = FEED_PRODUCTS_MIN,
  searchHref = "/comprar",
}: {
  sponsored: readonly ProductCardDTO[];
  tiers: readonly ProductTier[];
  /** Tarjetas públicas por id (solo las visibles y activas: lo que no esté aquí se omite). */
  cards: ReadonlyMap<string, ProductCardDTO>;
  exclude: ReadonlySet<string>;
  size?: number;
  minimumItems?: number;
  /** «Ver todo» de la intención (p. ej. `/comprar?q=lentes`); los demás tramos van a Comprar. */
  searchHref?: string;
}): FeedProductsDTO | null {
  const items: FeedProductItemDTO[] = [];
  const seen = new Set<string>(exclude);
  const push = (product: ProductCardDTO, isSponsored: boolean) => {
    if (items.length >= size || seen.has(product.slug) || !product.inStock) return;
    seen.add(product.slug);
    items.push({ product, sponsored: isSponsored });
  };

  for (const product of sponsored.slice(0, FEED_SPONSORED_MAX)) push(product, true);

  let lead: ProductTier | null = null;
  for (const tier of tiers) {
    const before = items.length;
    for (const id of tier.ids) {
      const card = cards.get(id);
      if (card) push(card, false);
      if (items.length >= size) break;
    }
    if (!lead && items.length > before) lead = tier;
    if (items.length >= size) break;
  }

  if (items.length < minimumItems) return null;
  if (!lead) {
    return {
      title: "Patrocinado",
      reason: "Tiendas que destacan sus productos",
      href: "/comprar",
      items,
    };
  }
  const copy = TIER_COPY[lead.kind];
  return {
    title: copy.title,
    reason: lead.kind === "intent" ? (lead.reason ?? "") : copy.reason,
    href: lead.kind === "intent" ? searchHref : "/comprar",
    items,
  };
}
