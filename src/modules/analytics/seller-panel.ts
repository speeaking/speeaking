import { siteConfig } from "@/config/site";
import type { AuthenticityStatus, OrderStatus, ProductStatus } from "@/generated/prisma/enums";
import { conversionRate } from "./seller-metrics";

/**
 * Cálculos del panel del vendedor (ADR-056): tendencias, ventas por día, desempeño, embudo y
 * pendientes. Código puro y probado (P2): la IA no calcula nada aquí.
 */

/** Ventana de los mosaicos de arriba (y la anterior, para comparar). */
export const PANEL_WINDOW_DAYS = 7;
/** Ventana del desempeño, el embudo y la actividad por producto. */
export const PERFORMANCE_WINDOW_DAYS = 30;
/** Con menos pedidos con cobro real que estos, el desempeño no se califica. */
export const PERFORMANCE_MIN_ORDERS = 5;
export const DISPATCH_EXCELLENT_HOURS = 24;
export const DISPATCH_GOOD_HOURS = 72;
export const CANCEL_EXCELLENT_RATE = 0.02;
export const CANCEL_GOOD_RATE = 0.05;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const round1 = (value: number) => Math.round(value * 10) / 10;

export type Trend = { value: number; previous: number; changePct: number | null };

/** Valor contra el periodo anterior. Sin periodo anterior no hay porcentaje. */
export function trend(value: number, previous: number): Trend {
  return {
    value,
    previous,
    changePct: previous > 0 ? round1(((value - previous) / previous) * 100) : null,
  };
}

export type DayPoint = { day: string; label: string; value: number };

/** Suma por día de los últimos `days` días (terminando hoy), en la zona horaria del sitio. */
export function dailySeries(
  points: readonly { at: Date; value: number }[],
  days: number,
  now: Date,
  timeZone: string = siteConfig.timeZone,
): DayPoint[] {
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const weekday = new Intl.DateTimeFormat(siteConfig.locale, { timeZone, weekday: "short" });
  const series = new Map<string, DayPoint>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime() - offset * DAY_MS);
    const day = dayKey.format(date);
    if (!series.has(day)) {
      series.set(day, { day, label: weekday.format(date).replace(/\.$/, ""), value: 0 });
    }
  }
  for (const point of points) {
    const bucket = series.get(dayKey.format(point.at));
    if (bucket) bucket.value += point.value;
  }
  return [...series.values()];
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export type PerformanceLevel = "excelente" | "bien" | "por_mejorar";

export const PERFORMANCE_LEVEL_LABELS: Record<PerformanceLevel, string> = {
  excelente: "Excelente",
  bien: "Bien",
  por_mejorar: "Por mejorar",
};

export function dispatchLevel(medianHours: number): PerformanceLevel {
  if (medianHours <= DISPATCH_EXCELLENT_HOURS) return "excelente";
  if (medianHours <= DISPATCH_GOOD_HOURS) return "bien";
  return "por_mejorar";
}

export function cancellationLevel(rate: number): PerformanceLevel {
  if (rate < CANCEL_EXCELLENT_RATE) return "excelente";
  if (rate < CANCEL_GOOD_RATE) return "bien";
  return "por_mejorar";
}

export type PerformanceOrder = {
  paidAt: Date;
  /** Cuándo salió (enviado) o se entregó en persona; `null` si todavía no. */
  dispatchedAt: Date | null;
  /** La tienda lo canceló después de cobrado. */
  cancelled: boolean;
};

export type Performance =
  | { enough: false; orders: number; needed: number }
  | {
      enough: true;
      orders: number;
      dispatch: { medianHours: number | null; level: PerformanceLevel | null; overdue: number };
      cancellation: { rate: number; level: PerformanceLevel; cancelled: number };
    };

/**
 * Desempeño de los últimos 30 días con pedidos de cobro real (un pago simulado no se envía: se
 * cancela, y eso no cuenta en contra). Despacho: mediana de horas entre el pago y la salida;
 * atrasados: los que llevan más de 72 h sin salir. Cancelaciones: canceladas entre pagadas.
 */
export function sellerPerformance({
  paidOrders,
  now,
}: {
  paidOrders: readonly PerformanceOrder[];
  now: Date;
}): Performance {
  if (paidOrders.length < PERFORMANCE_MIN_ORDERS) {
    return { enough: false, orders: paidOrders.length, needed: PERFORMANCE_MIN_ORDERS };
  }
  const hours = paidOrders.flatMap((order) =>
    order.dispatchedAt && !order.cancelled
      ? [(order.dispatchedAt.getTime() - order.paidAt.getTime()) / HOUR_MS]
      : [],
  );
  const overdue = paidOrders.filter(
    (order) =>
      !order.cancelled &&
      order.dispatchedAt === null &&
      now.getTime() - order.paidAt.getTime() > DISPATCH_GOOD_HOURS * HOUR_MS,
  ).length;
  const medianHours = median(hours);
  const cancelled = paidOrders.filter((order) => order.cancelled).length;
  const rate = cancelled / paidOrders.length;
  return {
    enough: true,
    orders: paidOrders.length,
    dispatch: {
      medianHours: medianHours === null ? null : round1(medianHours),
      level: medianHours === null ? null : dispatchLevel(medianHours),
      overdue,
    },
    cancellation: { rate, level: cancellationLevel(rate), cancelled },
  };
}

export type FunnelStep = {
  id: "visits" | "saves" | "carts" | "orders";
  label: string;
  count: number;
  /** De cada 100 visitas, cuántas llegaron a este paso (`null` sin visitas). */
  per100: number | null;
};

export function funnel(counts: {
  visits: number;
  saves: number;
  carts: number;
  orders: number;
}): FunnelStep[] {
  const per100 = (count: number) =>
    counts.visits > 0 ? round1((count / counts.visits) * 100) : null;
  return [
    { id: "visits", label: "Visitas", count: counts.visits, per100: per100(counts.visits) },
    { id: "saves", label: "Guardados", count: counts.saves, per100: per100(counts.saves) },
    { id: "carts", label: "Al carrito", count: counts.carts, per100: per100(counts.carts) },
    { id: "orders", label: "Pedidos", count: counts.orders, per100: per100(counts.orders) },
  ];
}

export type ProductPendingInput = {
  status: ProductStatus;
  stock: number;
  hidden: boolean;
  hasImage: boolean;
  authenticityStatus: AuthenticityStatus | null;
};

export type ProductPendings = {
  hidden: number;
  soldOut: number;
  noPhoto: number;
  drafts: number;
  needsProof: number;
  total: number;
};

export type ProductPendingKey = Exclude<keyof ProductPendings, "total">;

/**
 * Pendientes del catálogo, cada uno con su filtro en Productos (`?filtro=`): el número del Resumen
 * y la lista filtrada salen de la misma regla. Lo archivado ya no pide nada.
 */
export const PRODUCT_PENDINGS: Record<
  ProductPendingKey,
  { slug: string; label: string; match: (product: ProductPendingInput) => boolean }
> = {
  hidden: { slug: "ocultos", label: "Ocultos por moderación", match: (product) => product.hidden },
  soldOut: {
    slug: "agotados",
    label: "Agotados",
    match: (product) =>
      !product.hidden &&
      (product.status === "SOLD_OUT" || (product.status === "ACTIVE" && product.stock <= 0)),
  },
  noPhoto: { slug: "sin-foto", label: "Sin foto", match: (product) => !product.hasImage },
  drafts: {
    slug: "borradores",
    label: "Borradores",
    match: (product) => product.status === "DRAFT",
  },
  needsProof: {
    slug: "comprobante",
    label: "Comprobante de autenticidad pendiente",
    match: (product) => product.authenticityStatus === "NEEDS_PROOF",
  },
};

export const PRODUCT_PENDING_KEYS = Object.keys(PRODUCT_PENDINGS) as ProductPendingKey[];

/** El pendiente de un `?filtro=` de Productos, o `null` si no es uno conocido. */
export function productPendingFromSlug(slug: unknown): ProductPendingKey | null {
  return PRODUCT_PENDING_KEYS.find((key) => PRODUCT_PENDINGS[key].slug === slug) ?? null;
}

/** ¿El producto está en ese pendiente? Lo archivado nunca. */
export function isProductPending(product: ProductPendingInput, key: ProductPendingKey): boolean {
  return product.status !== "ARCHIVED" && PRODUCT_PENDINGS[key].match(product);
}

/** Cuántos productos hay en cada pendiente del catálogo. */
export function productPendings(products: readonly ProductPendingInput[]): ProductPendings {
  const count = (key: ProductPendingKey) =>
    products.filter((product) => isProductPending(product, key)).length;
  const counts = {
    hidden: count("hidden"),
    soldOut: count("soldOut"),
    noPhoto: count("noPhoto"),
    drafts: count("drafts"),
    needsProof: count("needsProof"),
  };
  return { ...counts, total: Object.values(counts).reduce((sum, n) => sum + n, 0) };
}

export type SalesPendingInput = { status: OrderStatus; paidAt: Date | null; simulated: boolean };

export type SalesPendings = {
  /** Pagados con cobro real que todavía no salen (o no se entregan, si se recogen). */
  toDispatch: number;
  oldestToDispatchHours: number | null;
  /** Enviados que falta marcar como entregados. */
  inTransit: number;
  /** Pagos simulados: no se cobró dinero, se cancelan para devolver las piezas (SEC-01). */
  simulatedToCancel: number;
  total: number;
};

export function salesPendings(orders: readonly SalesPendingInput[], now: Date): SalesPendings {
  const real = orders.filter((order) => !order.simulated);
  const waiting = real.filter((order) => order.status === "PAID");
  const ages = waiting.flatMap((order) =>
    order.paidAt ? [(now.getTime() - order.paidAt.getTime()) / HOUR_MS] : [],
  );
  const toDispatch = waiting.length;
  const inTransit = real.filter((order) => order.status === "SHIPPED").length;
  const simulatedToCancel = orders.filter(
    (order) => order.simulated && order.status === "PAID",
  ).length;
  return {
    toDispatch,
    oldestToDispatchHours: ages.length > 0 ? Math.round(Math.max(...ages)) : null,
    inTransit,
    simulatedToCancel,
    total: toDispatch + inTransit + simulatedToCancel,
  };
}

export type ProductActivityInput = {
  productId: string;
  title: string;
  views: number;
  saves: number;
  carts: number;
  /** Veces que alguien se lo probó o quiso probárselo («Ver cómo me veo»). */
  tryOns: number;
  /** Piezas vendidas. */
  orders: number;
};

export type ProductActivity<T extends ProductActivityInput = ProductActivityInput> = T & {
  /** Pedidos por cada 100 visitas. */
  conversion: number;
};

/** Actividad por producto, de más vista a menos (y, empatados, la que más vendió). */
export function rankProductActivity<T extends ProductActivityInput>(
  rows: readonly T[],
): ProductActivity<T>[] {
  return rows
    .map((row) => ({
      ...row,
      conversion: round1(conversionRate({ orders: row.orders, visits: row.views })),
    }))
    .sort(
      (a, b) => b.views - a.views || b.orders - a.orders || a.title.localeCompare(b.title, "es"),
    );
}
