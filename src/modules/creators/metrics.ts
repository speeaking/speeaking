/**
 * Lo que logró una publicación que etiqueta un producto (ADR-063): visitas a la ficha, pruebas de
 * «Ver cómo me veo», veces al carrito y pedidos que llegaron DESDE esa publicación. Código puro
 * (P2): solo cuenta lo que coincide con el producto de la publicación, así una liga armada a mano
 * (`?from=<otra publicación>`) no le suma a nadie lo que no es suyo.
 */

export type PostMetrics = {
  /** Visitas a la ficha del producto desde la publicación (una por persona y hora). */
  views: number;
  /** Pruebas generadas y pruebas pedidas cuando la tienda no tenía pruebas activas. */
  tryOns: number;
  carts: number;
  /** Pedidos pagados (con cobro real o simulado), enviados o entregados. */
  orders: number;
  /** Piezas de esos pedidos. */
  units: number;
};

export const EMPTY_METRICS: PostMetrics = { views: 0, tryOns: 0, carts: 0, orders: 0, units: 0 };

/** Tipos de evento que cuentan, y a qué métrica suman. */
export const METRIC_EVENT_TYPES = [
  "PRODUCT_VIEW",
  "ADD_TO_CART",
  "TRY_ON_GENERATED",
  "TRY_ON_REQUESTED",
] as const;
export type MetricEventType = (typeof METRIC_EVENT_TYPES)[number];

const EVENT_METRIC: Record<MetricEventType, "views" | "tryOns" | "carts"> = {
  PRODUCT_VIEW: "views",
  ADD_TO_CART: "carts",
  TRY_ON_GENERATED: "tryOns",
  TRY_ON_REQUESTED: "tryOns",
};

export type EventCountRow = {
  sourcePostId: string | null;
  entityId: string | null;
  type: string;
  count: number;
};

export type OrderCountRow = {
  sourcePostId: string | null;
  productId: string;
  orders: number;
  units: number;
};

/** Métricas por publicación (todas las publicaciones pedidas aparecen, en ceros si no hubo nada). */
export function metricsByPost(
  posts: readonly { id: string; productId: string }[],
  events: readonly EventCountRow[],
  orders: readonly OrderCountRow[],
): Map<string, PostMetrics> {
  const productOf = new Map(posts.map((post) => [post.id, post.productId]));
  const result = new Map(posts.map((post) => [post.id, { ...EMPTY_METRICS }]));
  for (const row of events) {
    if (!row.sourcePostId || productOf.get(row.sourcePostId) !== row.entityId) continue;
    const metric = EVENT_METRIC[row.type as MetricEventType];
    if (metric) result.get(row.sourcePostId)![metric] += row.count;
  }
  for (const row of orders) {
    if (!row.sourcePostId || productOf.get(row.sourcePostId) !== row.productId) continue;
    const metrics = result.get(row.sourcePostId)!;
    metrics.orders += row.orders;
    metrics.units += row.units;
  }
  return result;
}

/** Suma de varias publicaciones (el resumen de arriba de cada panel). */
export function totalMetrics(all: Iterable<PostMetrics>): PostMetrics {
  const total = { ...EMPTY_METRICS };
  for (const metrics of all) {
    total.views += metrics.views;
    total.tryOns += metrics.tryOns;
    total.carts += metrics.carts;
    total.orders += metrics.orders;
    total.units += metrics.units;
  }
  return total;
}
