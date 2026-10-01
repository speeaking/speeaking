import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Panel del vendedor (ADR-056) contra la base de desarrollo (`pnpm db:start`): ventas de la semana
 * contra la anterior, visitas, pendientes de ventas y de catálogo, desempeño y actividad por
 * producto salen de pedidos y eventos reales. Crea cuentas `e2e.fix.panel*@example.com` y las borra
 * al final con sus pedidos y eventos.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

vi.mock("@/server/db", async () => {
  const { createPrismaClient } = await import("@/server/db-client");
  return { db: createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base") };
});
vi.mock("@/server/env", () => ({
  env: { NODE_ENV: "test", TRUSTED_PROXY_HOPS: 0, STORAGE_LOCAL_ROOT: ".data" },
}));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ publicUrl: (key: string) => `/media/${key}` }),
}));
// Las pruebas de «Ver cómo me veo» y los mensajes tienen sus propias pruebas; aquí, valores fijos.
vi.mock("@/modules/tryon/service", () => ({
  countTryOnsByProduct: async () => new Map<string, number>(),
}));
vi.mock("@/modules/messages/service", () => ({ countUnreadConversations: async () => 2 }));

const { db } = await import("@/server/db");
const { getSellerPanel, getProductAnalytics } = await import("./seller-panel-queries");

const RUN = randomUUID().slice(0, 8);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date();
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const ids = { seller: "", sellerUser: "", buyer: "", category: "", shirt: "", shoes: "" };
let createdCategory = false;

async function createUser(tag: string) {
  const user = await db.user.create({
    data: { name: `Panel ${tag}`, email: `e2e.fix.panel.${RUN}.${tag}@example.com` },
    select: { id: true },
  });
  return user.id;
}

async function createProduct(title: string, stock: number) {
  const product = await db.product.create({
    data: {
      sellerId: ids.seller,
      slug: `e2e-fix-panel-${RUN}-${randomUUID().slice(0, 8)}`,
      title,
      description: "Producto de prueba",
      priceCents: 64_900,
      stock,
      categoryId: ids.category,
      city: "Ciudad de México",
      state: "CDMX",
      pickupAvailable: true,
      cost: { create: { unitCostCents: 30_000 } },
    },
    select: { id: true },
  });
  return product.id;
}

/** Un pedido pagado con su checkout y su pago aprobado (real o simulado). */
async function createPaidOrder({
  productId,
  quantity,
  paidAt,
  provider,
  status = "PAID",
}: {
  productId: string;
  quantity: number;
  paidAt: Date;
  provider: string;
  status?: "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";
}) {
  const subtotal = 64_900 * quantity;
  const checkout = await db.checkout.create({
    data: {
      buyerId: ids.buyer,
      status: "PAID",
      totalCents: subtotal,
      paymentMethod: "CARD",
      expiresAt: new Date(NOW.getTime() + DAY),
      payments: {
        create: {
          provider,
          providerRef: `${provider}_${randomUUID()}`,
          status: "APPROVED",
          amountCents: subtotal,
          method: "CARD",
        },
      },
    },
    select: { id: true },
  });
  await db.order.create({
    data: {
      checkoutId: checkout.id,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      status,
      deliveryMethod: "PICKUP",
      subtotalCents: subtotal,
      shippingCents: 0,
      platformFeeCents: 0,
      totalCents: subtotal,
      paidAt,
      items: {
        create: {
          productId,
          titleSnapshot: "Producto de prueba",
          unitPriceCents: 64_900,
          unitCostCents: 30_000,
          quantity,
          commissionBps: 0,
        },
      },
    },
  });
}

describe.skipIf(!databaseUrl)("panel del vendedor contra PostgreSQL", () => {
  beforeAll(async () => {
    const existing = await db.category.findFirst({ select: { id: true } });
    if (existing) {
      ids.category = existing.id;
    } else {
      ids.category = (
        await db.category.create({
          data: { slug: `e2e-fix-panel-${RUN}`, name: "Prueba" },
          select: { id: true },
        })
      ).id;
      createdCategory = true;
    }
    ids.sellerUser = await createUser("vendedor");
    ids.buyer = await createUser("comprador");
    ids.seller = (
      await db.sellerProfile.create({
        data: { userId: ids.sellerUser, displayName: "Tienda panel", acceptedPaymentMethods: [] },
        select: { id: true },
      })
    ).id;
    ids.shirt = await createProduct("Camisa de prueba", 3);
    ids.shoes = await createProduct("Tenis de prueba", 0);

    const event = (
      type: "PRODUCT_VIEW" | "SAVE" | "ADD_TO_CART" | "TRY_ON_REQUESTED",
      entityId: string,
      createdAt: Date,
    ) => ({ type, userId: ids.buyer, entityType: "PRODUCT" as const, entityId, createdAt });
    await db.analyticsEvent.createMany({
      data: [
        event("PRODUCT_VIEW", ids.shirt, ago(1 * DAY)),
        event("PRODUCT_VIEW", ids.shirt, ago(2 * DAY)),
        event("PRODUCT_VIEW", ids.shirt, ago(3 * DAY)),
        event("PRODUCT_VIEW", ids.shirt, ago(10 * DAY)),
        event("PRODUCT_VIEW", ids.shirt, ago(20 * DAY)),
        event("PRODUCT_VIEW", ids.shoes, ago(1 * DAY)),
        event("SAVE", ids.shirt, ago(1 * DAY)),
        event("ADD_TO_CART", ids.shirt, ago(1 * DAY)),
        event("ADD_TO_CART", ids.shirt, ago(2 * DAY)),
        event("TRY_ON_REQUESTED", ids.shoes, ago(1 * DAY)),
        // Más de 30 días: no cuenta en nada.
        event("PRODUCT_VIEW", ids.shirt, ago(40 * DAY)),
      ],
    });
    await createPaidOrder({
      productId: ids.shirt,
      quantity: 1,
      paidAt: ago(30 * HOUR),
      provider: "testpay",
    });
    await createPaidOrder({
      productId: ids.shirt,
      quantity: 2,
      paidAt: ago(2 * HOUR),
      provider: "mock",
    });
  });

  afterAll(async () => {
    if (ids.sellerUser) {
      await db.analyticsEvent.deleteMany({
        where: { entityId: { in: [ids.shirt, ids.shoes].filter(Boolean) } },
      });
      await db.checkout.deleteMany({ where: { buyerId: ids.buyer } });
      await db.product.deleteMany({ where: { sellerId: ids.seller } });
      await db.user.deleteMany({ where: { id: { in: [ids.sellerUser, ids.buyer] } } });
    }
    if (createdCategory) await db.category.delete({ where: { id: ids.category } });
    await db.$disconnect();
  });

  it("ventas y visitas de 7 días contra los 7 anteriores, con ventas por día", async () => {
    const panel = await getSellerPanel(ids.seller, ids.sellerUser, NOW);

    expect(panel.sales.value).toBe(64_900 * 3);
    expect(panel.sales.changePct).toBeNull();
    expect(panel.sales.series).toHaveLength(7);
    expect(panel.sales.series.reduce((sum, day) => sum + day.value, 0)).toBe(64_900 * 3);
    expect(panel.visits).toEqual({ value: 4, previous: 1, changePct: 300 });
    expect(panel.unreadMessages).toBe(2);
    expect(panel.activeProducts).toBe(2);
  });

  it("pendientes: uno por despachar, uno simulado por cancelar y un producto agotado", async () => {
    const panel = await getSellerPanel(ids.seller, ids.sellerUser, NOW);

    expect(panel.salesPendings).toEqual({
      toDispatch: 1,
      oldestToDispatchHours: 30,
      inTransit: 0,
      simulatedToCancel: 1,
      total: 2,
    });
    expect(panel.productPendings).toMatchObject({ soldOut: 1, noPhoto: 2, hidden: 0, total: 3 });
    // Un solo pedido con cobro real: todavía no se califica el desempeño.
    expect(panel.performance).toEqual({ enough: false, orders: 1, needed: 5 });
  });

  it("embudo y actividad por producto de 30 días", async () => {
    const analytics = await getProductAnalytics(ids.seller, NOW);

    expect(analytics.funnel.map((step) => [step.id, step.count])).toEqual([
      ["visits", 6],
      ["saves", 1],
      ["carts", 2],
      ["orders", 2],
    ]);
    const [first, second] = analytics.products;
    expect(first).toMatchObject({
      productId: ids.shirt,
      views: 5,
      saves: 1,
      carts: 2,
      orders: 3,
      tryOns: 0,
      conversion: 60,
    });
    expect(second).toMatchObject({ productId: ids.shoes, views: 1, tryOns: 1, orders: 0 });
  });
});
