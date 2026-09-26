/**
 * Métricas diarias del motor de automejora (`DailyMetric`). Cada una tiene su definición exacta aquí
 * (se muestra en /admin/resumen) y la calcula `aggregateDailyMetrics` (metrics.ts), nunca la IA (P2).
 *
 * Tipos:
 * - `count`: conteo o suma del día; `sampleSize` = el mismo conteo. En una ventana se suman.
 * - `rate`: cociente del día; `sampleSize` = su denominador. En una ventana se promedian ponderadas
 *   por `sampleSize` (= Σ numeradores ÷ Σ denominadores, exacto).
 */

export type MetricKind = "count" | "rate";
export type MetricFormat = "integer" | "percent" | "per1k" | "decimal" | "usd";

export type MetricDefinition = {
  key: string;
  label: string;
  kind: MetricKind;
  format: MetricFormat;
  /** Qué es mejor para la salud o la métrica norte (para colorear cambios); `null` = neutral. */
  better: "up" | "down" | null;
  definition: string;
};

/**
 * Impresiones: desde T5 (ADR-037) son VISIBLES: la pieza estuvo al menos a la mitad en pantalla
 * durante 1 segundo continuo, con la pestaña a la vista, y solo cuenta si se le sirvió a esa persona
 * (`analytics/visible-impressions.ts`). Y solo de PERSONAS CON SESIÓN (y personalización): las
 * métricas del feed con las que se decide (umbral, salvaguardas, analista, experimentos) cuentan a
 * quienes tuvieron al menos una impresión visible con persona ese día, y sus numeradores solo de
 * esas personas (`analytics/platform-aggregates.ts` → `signedInFeedTotals`). Un robot sin cuenta no
 * mueve ninguna. Las visibles anónimas (`feed.impressions.visible.anonymous`) y la pieza SERVIDA
 * (`feed.impressions.served`) se cuentan aparte, solo para describir: ninguna decisión se toma con
 * ellas.
 */
const IMPRESSIONS_NOTE =
  "Impresiones visibles de personas con sesión: piezas del feed o de una comunidad que estuvieron al menos a la mitad en pantalla durante 1 segundo seguido, solo si se le sirvieron a esa persona; una por persona, publicación y día. Sin las anónimas (sin sesión o sin personalización), que se cuentan aparte.";

/** Quiénes cuentan en los numeradores de las tasas del feed. */
const SIGNED_IN_NOTE =
  "Solo de personas con sesión que tuvieron al menos una impresión visible ese día.";

export const METRICS = [
  {
    key: "feed.impressions.visible",
    label: "Impresiones visibles del feed (con sesión)",
    kind: "count",
    format: "integer",
    better: null,
    definition: IMPRESSIONS_NOTE,
  },
  {
    key: "feed.impressions.visible.anonymous",
    label: "Impresiones visibles anónimas",
    kind: "count",
    format: "integer",
    better: null,
    definition:
      "Impresiones visibles sin persona (sin sesión o sin personalización), con los mismos filtros que las demás. Solo para describir el tráfico: ninguna decisión se toma con ella (un robot sin cuenta podría inflarla).",
  },
  {
    key: "feed.impressions.served",
    label: "Piezas servidas del feed",
    kind: "count",
    format: "integer",
    better: null,
    definition:
      "Piezas que el servidor mandó al feed o a una comunidad, una por persona (o IP), publicación y hora, se hayan visto o no. Solo para comparar: ninguna decisión se toma con ella.",
  },
  {
    key: "feed.impressions.commerce",
    label: "Impresiones comerciales",
    kind: "count",
    format: "integer",
    better: null,
    definition: "Impresiones visibles (con sesión) del feed que ocuparon un espacio comercial.",
  },
  {
    key: "feed.commerce.share",
    label: "Contenido comercial visto",
    kind: "rate",
    format: "percent",
    better: "down",
    definition:
      "Impresiones visibles comerciales ÷ impresiones visibles del feed, ambas de personas con sesión. Salvaguarda: nunca más de 30 %.",
  },
  {
    key: "feed.product_visits",
    label: "Visitas a producto desde el feed",
    kind: "count",
    format: "integer",
    better: "up",
    definition: `Vistas de la página de un producto que llegaron desde una tarjeta del feed (sin las del dueño). ${SIGNED_IN_NOTE}`,
  },
  {
    key: "feed.commerce.ctr",
    label: "Conversión comercial del feed",
    kind: "rate",
    format: "percent",
    better: "up",
    definition: `Visitas a producto desde el feed ÷ impresiones visibles comerciales. ${SIGNED_IN_NOTE}`,
  },
  {
    key: "feed.product_visits.rate",
    label: "Visitas a producto por impresión",
    kind: "rate",
    format: "percent",
    better: "up",
    definition: `Visitas a producto desde el feed ÷ impresiones visibles del feed (exposición de vendedores). ${SIGNED_IN_NOTE}`,
  },
  {
    key: "feed.engagement.rate",
    label: "Interacción por impresión",
    kind: "rate",
    format: "percent",
    better: "up",
    definition: `(Me gusta + guardados + comentarios + compartidos de publicaciones + visitas a producto desde el feed) ÷ impresiones visibles del feed. ${SIGNED_IN_NOTE}`,
  },
  {
    key: "feed.viewers",
    label: "Personas con sesión que vieron el feed",
    kind: "count",
    format: "integer",
    better: "up",
    definition:
      "Cuentas distintas con al menos una impresión visible (sin quienes desactivaron la personalización, cuya actividad es anónima).",
  },
  {
    key: "feed.impressions.per_viewer",
    label: "Impresiones por persona",
    kind: "rate",
    format: "decimal",
    better: null,
    definition:
      "Impresiones visibles con sesión ÷ personas con sesión que vieron el feed ese día (promedio diario; el efecto de diseño usa lo que junta una persona en toda la ventana).",
  },
  {
    key: "sellers.active",
    label: "Vendedores activos",
    kind: "count",
    format: "integer",
    better: "up",
    definition:
      "Vendedores activos con al menos un producto activo, visible, con existencias y publicado antes del fin del día (según el estado al calcular).",
  },
  {
    key: "product.visits",
    label: "Visitas a producto",
    kind: "count",
    format: "integer",
    better: "up",
    definition:
      "Vistas de páginas de producto desde cualquier origen, con y sin sesión, sin las del dueño. Solo para describir el tráfico.",
  },
  {
    key: "product.visits.per_active_seller",
    label: "Visitas a producto por vendedor activo",
    kind: "rate",
    format: "decimal",
    better: "up",
    definition:
      "Visitas a producto de personas con sesión y personalización (cualquier origen, sin las del dueño) ÷ vendedores activos. Sin las visitas anónimas (p. ej. de una liga compartida sin sesión), que solo cuentan en «Visitas a producto». Salvaguarda: no caer más de 15 %.",
  },
  {
    key: "sellers.first_sale.rate_30d",
    label: "Vendedores nuevos con primera venta",
    kind: "rate",
    format: "percent",
    better: "up",
    definition:
      "De los vendedores dados de alta en los 30 días previos, cuántos tienen al menos un pedido marcado como pagado (incluye pagos simulados mientras no exista el cobro directo).",
  },
  {
    key: "reports.count",
    label: "Reportes",
    kind: "count",
    format: "integer",
    better: "down",
    definition: "Reportes de moderación creados en el día.",
  },
  {
    key: "reports.per_1k_impressions",
    label: "Reportes por mil impresiones",
    kind: "rate",
    format: "per1k",
    better: "down",
    definition:
      "1,000 × reportes ÷ impresiones visibles del feed, ambos de personas con sesión que tuvieron al menos una impresión visible ese día. Salvaguarda: no subir más de 25 % (con significancia).",
  },
  {
    key: "not_interested.count",
    label: "«No me interesa»",
    kind: "count",
    format: "integer",
    better: "down",
    definition: "Veces que alguien marcó «No me interesa».",
  },
  {
    key: "not_interested.per_1k_impressions",
    label: "«No me interesa» por mil impresiones",
    kind: "rate",
    format: "per1k",
    better: "down",
    definition:
      "1,000 × «No me interesa» ÷ impresiones visibles del feed, ambos de personas con sesión que tuvieron al menos una impresión visible ese día. Salvaguarda: no subir más de 15 % (con significancia).",
  },
  {
    key: "retention.d1",
    label: "Regresan al día siguiente (D1)",
    kind: "rate",
    format: "percent",
    better: "up",
    definition:
      "De las cuentas creadas el día anterior, cuántas tuvieron actividad este día (eventos con persona o un inicio de sesión). Aproximación: cota inferior.",
  },
  {
    key: "retention.d7",
    label: "Regresan a los 7 días (D7)",
    kind: "rate",
    format: "percent",
    better: "up",
    definition:
      "De las cuentas creadas 7 días antes, cuántas tuvieron actividad este día. Aproximación: cota inferior.",
  },
  {
    key: "ai.requests",
    label: "Solicitudes de IA",
    kind: "count",
    format: "integer",
    better: null,
    definition:
      "Solicitudes a un modelo de IA de verdad registradas en el día (todas las funciones, con cualquier resultado). Sin las de la IA simulada.",
  },
  {
    key: "ai.requests.simulated",
    label: "Solicitudes a la IA simulada",
    kind: "count",
    format: "integer",
    better: null,
    definition:
      "Solicitudes registradas con la IA simulada (plantillas sin modelo: desarrollo, un piloto con ALLOW_SIMULATED_AI o una ruta al simulador), con cualquier resultado: también las que se negaron por no estar permitida. No cuentan como generaciones de IA.",
  },
  {
    key: "ai.cost.micros_usd",
    label: "Costo de IA del día",
    kind: "count",
    format: "usd",
    better: "down",
    definition: "Suma del costo registrado de las respuestas de IA del día.",
  },
  {
    key: "ai.cost.mtd.micros_usd",
    label: "Costo de IA del mes",
    kind: "count",
    format: "usd",
    better: "down",
    definition:
      "Costo registrado de IA desde el inicio del mes (UTC, como el guardián de presupuesto) hasta el fin del día.",
  },
  {
    key: "ai.budget.limit.micros_usd",
    label: "Tope de IA del mes",
    kind: "count",
    format: "usd",
    better: null,
    definition:
      "Semilla + porcentaje de los ingresos de plataforma del mes anterior, con tope duro (ajuste ai.budget).",
  },
  {
    key: "ai.budget.used.share",
    label: "Tope de IA usado",
    kind: "rate",
    format: "percent",
    better: "down",
    definition: "Costo de IA del mes ÷ tope de IA del mes.",
  },
] as const satisfies readonly MetricDefinition[];

export type MetricKey = (typeof METRICS)[number]["key"];

/**
 * Métricas que se redefinieron con T5: impresiones visibles y solo de personas con sesión. Sus filas
 * de días anteriores a `VISIBLE_IMPRESSIONS_SINCE` contaban piezas SERVIDAS y tráfico anónimo, y no
 * se comparan con las nuevas (`metric-rows.ts` las omite). `feed.impressions.served` y
 * `product.visits` no están: no cambiaron.
 */
export const VISIBLE_IMPRESSION_METRICS: ReadonlySet<string> = new Set<MetricKey>([
  "feed.impressions.visible",
  "feed.impressions.visible.anonymous",
  "feed.product_visits",
  "product.visits.per_active_seller",
  "feed.impressions.commerce",
  "feed.commerce.share",
  "feed.commerce.ctr",
  "feed.product_visits.rate",
  "feed.engagement.rate",
  "feed.viewers",
  "feed.impressions.per_viewer",
  "reports.per_1k_impressions",
  "not_interested.per_1k_impressions",
]);

/**
 * Métricas que existen como salvaguarda pero aún no se registran. `errors.5xx.rate` necesita un
 * registro de respuestas del servidor (observabilidad, plan §2.1): hasta entonces no se escribe
 * ninguna fila y la salvaguarda aparece como «sin datos» (nunca se inventa un 0).
 */
export const PENDING_METRICS = [
  {
    key: "errors.5xx.rate",
    label: "Errores 5xx",
    kind: "rate",
    format: "percent",
    better: "down",
    definition: "Respuestas 5xx ÷ respuestas. Aún no se registra: sin datos.",
  },
] as const satisfies readonly MetricDefinition[];

const ALL: readonly MetricDefinition[] = [...METRICS, ...PENDING_METRICS];
const BY_KEY = new Map(ALL.map((metric) => [metric.key, metric]));

export function getMetric(key: string): MetricDefinition | null {
  return BY_KEY.get(key) ?? null;
}

/** Llave de `DailyMetric.dimension` para una variante de un experimento. */
export function variantDimension(experimentKey: string, variant: "control" | "treatment") {
  return `variant:${experimentKey}:${variant}`;
}

const integer = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const usd = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "code",
  maximumFractionDigits: 2,
});

/** Valor legible de una métrica ("2.4 %", "1,250", "0.8 por mil", "USD 12.40"). */
export function formatMetricValue(key: string, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const metric = getMetric(key);
  switch (metric?.format) {
    case "percent":
      return `${percent.format(value * 100)} %`;
    case "per1k":
      return `${decimal.format(value)} por mil`;
    case "usd":
      return usd.format(value / 1_000_000).replace(/ /g, " ");
    case "decimal":
      return decimal.format(value);
    default:
      return integer.format(value);
  }
}
