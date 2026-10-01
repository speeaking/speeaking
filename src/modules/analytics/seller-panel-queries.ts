import "server-only";
import type { MediaDTO } from "@/modules/catalog/dto";
import { listSellerProducts } from "@/modules/catalog/queries";
import { countUnreadConversations } from "@/modules/messages/service";
import { countTryOnsByProduct } from "@/modules/tryon/service";
import { db } from "@/server/db";
import { isSimulatedPayment } from "@/server/providers/payments/policy";
import {
  dailySeries,
  type DayPoint,
  funnel,
  type FunnelStep,
  PANEL_WINDOW_DAYS,
  PERFORMANCE_WINDOW_DAYS,
  type Performance,
  type ProductActivity,
  type ProductPendings,
  productPendings,
  rankProductActivity,
  type SalesPendings,
  salesPendings,
  sellerPerformance,
  type Trend,
  trend,
} from "./seller-panel";

const DAY_MS = 24 * 60 * 60 * 1000;
const SOLD = ["PAID", "SHIPPED", "DELIVERED"] as const;

export type ProductActivityRow = ProductActivity<{
  productId: string;
  title: string;
  slug: string;
  image: MediaDTO | null;
  views: number;
  saves: number;
  carts: number;
  tryOns: number;
  orders: number;
}>;

export type ProductAnalyticsDTO = {
  days: number;
  funnel: FunnelStep[];
  /** Pedidos que llegaron desde una publicación del feed (atribución P5). */
  ordersFromContent: number;
  products: ProductActivityRow[];
};

export type SellerPanelDTO = ProductAnalyticsDTO & {
  windowDays: number;
  sales: Trend & { series: DayPoint[] };
  visits: Trend;
  unreadMessages: number;
  activeProducts: number;
  salesPendings: SalesPendings;
  productPendings: ProductPendings;
  performance: Performance;
};

const sinceDays = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

function countBy(rows: readonly { entityId: string | null; _count: { _all: number } }[]) {
  return new Map(rows.flatMap((row) => (row.entityId ? [[row.entityId, row._count._all]] : [])));
}

/**
 * Actividad de los últimos 30 días por producto (visitas, guardados, al carrito, pruebas y piezas
 * vendidas) y el embudo de la tienda. Todo con consultas agrupadas: una por tipo de señal.
 */
async function loadProductAnalytics(
  sellerId: string,
  products: Awaited<ReturnType<typeof listSellerProducts>>,
  now: Date,
): Promise<ProductAnalyticsDTO> {
  const since = sinceDays(now, PERFORMANCE_WINDOW_DAYS);
  const ids = products.map((product) => product.id);
  const byType = (type: "PRODUCT_VIEW" | "SAVE" | "ADD_TO_CART" | "TRY_ON_REQUESTED") =>
    ids.length === 0
      ? Promise.resolve([])
      : db.analyticsEvent.groupBy({
          by: ["entityId"],
          where: { type, entityType: "PRODUCT", entityId: { in: ids }, createdAt: { gte: since } },
          _count: { _all: true },
        });
  const [views, saves, carts, requested, tryOns, sold, orders] = await Promise.all([
    // Las vistas antiguas no siempre traen `entityType`: se filtran solo por id.
    ids.length === 0
      ? Promise.resolve([])
      : db.analyticsEvent.groupBy({
          by: ["entityId"],
          where: { type: "PRODUCT_VIEW", entityId: { in: ids }, createdAt: { gte: since } },
          _count: { _all: true },
        }),
    byType("SAVE"),
    byType("ADD_TO_CART"),
    byType("TRY_ON_REQUESTED"),
    countTryOnsByProduct(sellerId, now),
    ids.length === 0
      ? Promise.resolve([])
      : db.orderItem.groupBy({
          by: ["productId"],
          where: {
            productId: { in: ids },
            order: { sellerId, status: { in: [...SOLD] }, paidAt: { gte: since } },
          },
          _sum: { quantity: true },
        }),
    db.order.findMany({
      where: { sellerId, status: { in: [...SOLD] }, paidAt: { gte: since } },
      select: { items: { select: { sourcePostId: true } } },
    }),
  ]);
  const viewsBy = countBy(views);
  const savesBy = countBy(saves);
  const cartsBy = countBy(carts);
  const requestedBy = countBy(requested);
  const soldBy = new Map(sold.map((row) => [row.productId, row._sum.quantity ?? 0]));

  const rows = rankProductActivity(
    products
      .filter((product) => product.status !== "ARCHIVED")
      .map((product) => ({
        productId: product.id,
        title: product.title,
        slug: product.slug,
        image: product.image,
        views: viewsBy.get(product.id) ?? 0,
        saves: savesBy.get(product.id) ?? 0,
        carts: cartsBy.get(product.id) ?? 0,
        tryOns: (tryOns.get(product.id) ?? 0) + (requestedBy.get(product.id) ?? 0),
        orders: soldBy.get(product.id) ?? 0,
      })),
  );
  const total = (map: Map<string, number>) => [...map.values()].reduce((sum, n) => sum + n, 0);
  return {
    days: PERFORMANCE_WINDOW_DAYS,
    funnel: funnel({
      visits: total(viewsBy),
      saves: total(savesBy),
      carts: total(cartsBy),
      orders: orders.length,
    }),
    ordersFromContent: orders.filter((order) => order.items.some((item) => item.sourcePostId))
      .length,
    products: rows,
  };
}

/** La pestaña Analítica: embudo y actividad de cada producto en los últimos 30 días. */
export async function getProductAnalytics(
  sellerId: string,
  now = new Date(),
): Promise<ProductAnalyticsDTO> {
  return loadProductAnalytics(sellerId, await listSellerProducts(sellerId), now);
}

/**
 * El Resumen del Studio (ADR-056): ventas y visitas de 7 días contra los 7 anteriores, ventas por
 * día, pendientes de ventas y de catálogo, mensajes sin leer, desempeño de 30 días, embudo y
 * actividad por producto. Sin costos ni datos de compradores: solo números de la tienda.
 */
export async function getSellerPanel(
  sellerId: string,
  userId: string,
  now = new Date(),
): Promise<SellerPanelDTO> {
  const week = sinceDays(now, PANEL_WINDOW_DAYS);
  const twoWeeks = sinceDays(now, PANEL_WINDOW_DAYS * 2);
  const month = sinceDays(now, PERFORMANCE_WINDOW_DAYS);
  const products = await listSellerProducts(sellerId);
  const ids = products.map((product) => product.id);
  const payments = {
    checkout: {
      select: { payments: { where: { status: "APPROVED" }, select: { provider: true } } },
    },
  } as const;

  const [analytics, recentOrders, openOrders, visitsWeek, visitsBefore, unreadMessages] =
    await Promise.all([
      loadProductAnalytics(sellerId, products, now),
      // Pagados en los últimos 30 días (también los que después se cancelaron).
      db.order.findMany({
        where: { sellerId, paidAt: { gte: month } },
        select: {
          status: true,
          subtotalCents: true,
          paidAt: true,
          shippedAt: true,
          deliveredAt: true,
          ...payments,
        },
      }),
      // Lo que sigue abierto, sin importar cuándo se pagó.
      db.order.findMany({
        where: { sellerId, status: { in: ["PAID", "SHIPPED"] }, paidAt: { not: null } },
        select: { status: true, paidAt: true, ...payments },
      }),
      ids.length === 0
        ? Promise.resolve(0)
        : db.analyticsEvent.count({
            where: { type: "PRODUCT_VIEW", entityId: { in: ids }, createdAt: { gte: week } },
          }),
      ids.length === 0
        ? Promise.resolve(0)
        : db.analyticsEvent.count({
            where: {
              type: "PRODUCT_VIEW",
              entityId: { in: ids },
              createdAt: { gte: twoWeeks, lt: week },
            },
          }),
      countUnreadConversations(userId).catch(() => 0),
    ]);

  const simulated = (order: { checkout: { payments: { provider: string }[] } }) =>
    order.checkout.payments.some((payment) => isSimulatedPayment(payment.provider));
  const sold = recentOrders.filter(
    (order): order is typeof order & { paidAt: Date } =>
      order.paidAt !== null && (SOLD as readonly string[]).includes(order.status),
  );
  const revenueIn = (from: Date, to: Date) =>
    sold
      .filter((order) => order.paidAt >= from && order.paidAt < to)
      .reduce((sum, order) => sum + order.subtotalCents, 0);

  return {
    ...analytics,
    windowDays: PANEL_WINDOW_DAYS,
    sales: {
      ...trend(revenueIn(week, now), revenueIn(twoWeeks, week)),
      series: dailySeries(
        sold
          .filter((order) => order.paidAt >= week)
          .map((order) => ({ at: order.paidAt, value: order.subtotalCents })),
        PANEL_WINDOW_DAYS,
        now,
      ),
    },
    visits: trend(visitsWeek, visitsBefore),
    unreadMessages,
    activeProducts: products.filter((product) => product.status === "ACTIVE").length,
    salesPendings: salesPendings(
      openOrders.map((order) => ({
        status: order.status,
        paidAt: order.paidAt,
        simulated: simulated(order),
      })),
      now,
    ),
    productPendings: productPendings(
      products.map((product) => ({
        status: product.status,
        stock: product.stock,
        hidden: product.hidden,
        hasImage: product.image !== null,
        authenticityStatus: product.authenticityStatus,
      })),
    ),
    // Desempeño solo con cobros reales: un pago simulado no se envía, se cancela (SEC-01).
    performance: sellerPerformance({
      paidOrders: recentOrders
        .filter((order) => order.paidAt !== null && !simulated(order))
        .map((order) => ({
          paidAt: order.paidAt!,
          dispatchedAt: order.shippedAt ?? order.deliveredAt,
          cancelled: order.status === "CANCELLED",
        })),
      now,
    }),
  };
}
