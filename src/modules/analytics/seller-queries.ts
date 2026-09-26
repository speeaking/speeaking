import "server-only";
import { sellerProfitCents } from "@/modules/commerce/checkout-math";
import { getCommerceFees } from "@/modules/platform/settings";
import { db } from "@/server/db";
import { conversionRate } from "./seller-metrics";

const DAY = 24 * 60 * 60 * 1000;
const SOLD_STATUSES = ["PAID", "SHIPPED", "DELIVERED"] as const;

/** Métricas del Studio para los últimos `days` días. Todo calculado por código (P2). */
export async function getSellerDashboard(sellerId: string, days = 30) {
  const since = new Date(Date.now() - days * DAY);
  const [fees, orders, activeProducts, productIds] = await Promise.all([
    getCommerceFees(),
    db.order.findMany({
      where: { sellerId, status: { in: [...SOLD_STATUSES] }, paidAt: { gte: since } },
      select: {
        subtotalCents: true,
        platformFeeCents: true,
        items: {
          select: { unitPriceCents: true, unitCostCents: true, quantity: true, sourcePostId: true },
        },
      },
    }),
    db.product.count({ where: { sellerId, status: "ACTIVE" } }),
    db.product.findMany({ where: { sellerId }, select: { id: true } }),
  ]);
  const ids = productIds.map((product) => product.id);
  const productPostIds = ids.length
    ? (await db.post.findMany({ where: { productId: { in: ids } }, select: { id: true } })).map(
        (post) => post.id,
      )
    : [];

  const [visits, shares, viewsBySurface] = ids.length
    ? await Promise.all([
        db.analyticsEvent.count({
          where: { type: "PRODUCT_VIEW", entityId: { in: ids }, createdAt: { gte: since } },
        }),
        // Compartidos del producto o de sus publicaciones (P1).
        db.analyticsEvent.count({
          where: {
            type: "SHARE",
            OR: [{ entityId: { in: ids } }, { sourcePostId: { in: productPostIds } }],
          },
        }),
        db.analyticsEvent.groupBy({
          by: ["surface"],
          where: { type: "PRODUCT_VIEW", entityId: { in: ids }, createdAt: { gte: since } },
          _count: { _all: true },
        }),
      ])
    : [0, 0, []];

  const revenueCents = orders.reduce((sum, order) => sum + order.subtotalCents, 0);
  const profitCents = orders.reduce(
    (sum, order) =>
      sum +
      sellerProfitCents({
        lines: order.items,
        platformFeeCents: order.platformFeeCents,
        paymentFeeBps: fees.estimatedPaymentFeeBps,
      }),
    0,
  );
  const attributedOrders = orders.filter((order) =>
    order.items.some((item) => item.sourcePostId),
  ).length;

  return {
    days,
    revenueCents,
    profitCents,
    orders: orders.length,
    attributedOrders,
    activeProducts,
    totalProducts: ids.length,
    visits,
    shares,
    conversion: conversionRate({ orders: orders.length, visits }),
    visitsBySurface: viewsBySurface.map((row) => ({
      surface: row.surface,
      count: row._count._all,
    })),
    estimatedPaymentFeeBps: fees.estimatedPaymentFeeBps,
  };
}

/** Órdenes del vendedor (con datos de entrega; sin datos de pago del comprador). */
export function listSellerOrders(sellerId: string) {
  return db.order.findMany({
    where: { sellerId, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      deliveryMethod: true,
      totalCents: true,
      shippingAddress: true,
      createdAt: true,
      buyer: { select: { profile: { select: { displayName: true, username: true } } } },
      items: { select: { id: true, titleSnapshot: true, quantity: true } },
    },
  });
}
