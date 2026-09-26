import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /carrito (P14): abrir el carrito borra las líneas de productos que el equipo ocultó y avisa una sola
 * vez (`listCartRemovingHidden`), contra la base de desarrollo (`pnpm db:start`). Usa cuentas
 * `e2e.fin.*@example.com` y una categoría temporal; borra todo al final.
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

const { db } = await import("@/server/db");
const cart = await import("@/modules/commerce/cart");
const { removedHiddenNotice } = await import("./notice");

const tag = randomUUID().slice(0, 8);
const emails = ["seller", "buyer", "other"].map((who) => `e2e.fin.cart${who}${tag}@example.com`);

type Ids = {
  categoryId: string;
  buyer: string;
  other: string;
  visible: string;
  hiddenA: string;
  hiddenB: string;
};
let ids: Ids;

async function cartOf(userId: string) {
  const { id } = await db.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });
  return id;
}

/** Deja el carrito con el visible y los dos ocultos (los agregó antes de que el equipo los ocultara). */
async function fillCart(userId: string) {
  const cartId = await cartOf(userId);
  await db.cartItem.deleteMany({ where: { cartId } });
  await db.cartItem.createMany({
    data: [ids.visible, ids.hiddenA, ids.hiddenB].map((productId) => ({
      cartId,
      productId,
      quantity: 1,
    })),
  });
}

async function productIdsInCart(userId: string) {
  const rows = await db.cartItem.findMany({
    where: { cart: { userId } },
    select: { productId: true },
  });
  return rows.map((row) => row.productId).sort();
}

describe.skipIf(!databaseUrl)("/carrito quita los productos ocultos (PostgreSQL)", () => {
  beforeAll(async () => {
    const category = await db.category.create({
      data: { slug: `cart-test-${tag}`, name: `Carrito ${tag}` },
      select: { id: true },
    });
    const account = (email: string, username: string, seller: boolean) =>
      db.user.create({
        data: {
          name: "Prueba carrito",
          email,
          profile: { create: { username, displayName: username, onboardedAt: new Date() } },
          ...(seller ? { sellerProfile: { create: { displayName: `Tienda ${username}` } } } : {}),
        },
        select: { id: true, sellerProfile: { select: { id: true } } },
      });
    const seller = await account(emails[0]!, `e2e.fin.cartseller${tag}`, true);
    const buyer = await account(emails[1]!, `e2e.fin.cartbuyer${tag}`, false);
    const other = await account(emails[2]!, `e2e.fin.cartother${tag}`, false);
    const product = (title: string, hidden: boolean) =>
      db.product.create({
        data: {
          sellerId: seller.sellerProfile!.id,
          categoryId: category.id,
          slug: `carrito-${randomUUID()}`,
          title,
          description: "Producto de prueba del carrito.",
          priceCents: 25_000,
          stock: 5,
          status: "ACTIVE",
          city: "Ciudad de México",
          state: "CDMX",
          publishedAt: new Date(),
          ...(hidden ? { moderationStatus: "HIDDEN" as const, moderatedAt: new Date() } : {}),
        },
        select: { id: true },
      });
    ids = {
      categoryId: category.id,
      buyer: buyer.id,
      other: other.id,
      visible: (await product(`Taza visible ${tag}`, false)).id,
      hiddenA: (await product(`Taza oculta A ${tag}`, true)).id,
      hiddenB: (await product(`Taza oculta B ${tag}`, true)).id,
    };
  });

  beforeEach(async () => {
    // Cada prueba empieza con los dos productos ocultos.
    await db.product.updateMany({
      where: { id: { in: [ids.hiddenA, ids.hiddenB] } },
      data: { moderationStatus: "HIDDEN" },
    });
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { in: emails } } });
    if (ids) await db.category.deleteMany({ where: { id: ids.categoryId } });
    await db.$disconnect();
  });

  it("borra las líneas ocultas al listar y el aviso sale una sola vez", async () => {
    await fillCart(ids.buyer);

    const first = await cart.listCartRemovingHidden(ids.buyer);
    expect(first.removedHidden).toBe(2);
    expect(first.lines.map((line) => line.product.id)).toEqual([ids.visible]);
    expect(removedHiddenNotice(first.removedHidden)).toBe(
      "Quitamos 2 productos que ya no están disponibles",
    );
    // Se borraron de verdad: ni el conteo de ocultos ni la base las tienen.
    await expect(cart.countHiddenCartLines(ids.buyer)).resolves.toBe(0);
    await expect(productIdsInCart(ids.buyer)).resolves.toEqual([ids.visible]);

    // La siguiente carga ya no avisa.
    const second = await cart.listCartRemovingHidden(ids.buyer);
    expect(second.removedHidden).toBe(0);
    expect(removedHiddenNotice(second.removedHidden)).toBeNull();
    expect(second.lines.map((line) => line.product.id)).toEqual([ids.visible]);

    // Si el equipo lo restaura después, ya no regresa al carrito.
    await db.product.update({ where: { id: ids.hiddenA }, data: { moderationStatus: "VISIBLE" } });
    const restored = await cart.listCartRemovingHidden(ids.buyer);
    expect(restored.lines.map((line) => line.product.id)).toEqual([ids.visible]);
  });

  it("solo toca el carrito de quien lo abre; el checkout (`getCartLines`) omite sin borrar", async () => {
    await fillCart(ids.buyer);
    await fillCart(ids.other);

    const lines = await cart.getCartLines(ids.other);
    expect(lines.map((line) => line.product.id)).toEqual([ids.visible]);
    await expect(cart.countHiddenCartLines(ids.other)).resolves.toBe(2);

    const listing = await cart.listCartRemovingHidden(ids.buyer);
    expect(listing.removedHidden).toBe(2);
    // El carrito de la otra persona sigue igual hasta que ella abra /carrito.
    await expect(productIdsInCart(ids.other)).resolves.toEqual(
      [ids.visible, ids.hiddenA, ids.hiddenB].sort(),
    );
  });

  it("dos cargas a la vez no cuentan la misma línea dos veces", async () => {
    await fillCart(ids.buyer);

    const results = await Promise.all([
      cart.listCartRemovingHidden(ids.buyer),
      cart.listCartRemovingHidden(ids.buyer),
      cart.listCartRemovingHidden(ids.buyer),
    ]);
    expect(results.reduce((sum, result) => sum + result.removedHidden, 0)).toBe(2);
    for (const result of results) {
      expect(result.lines.map((line) => line.product.id)).toEqual([ids.visible]);
    }
  });
});
