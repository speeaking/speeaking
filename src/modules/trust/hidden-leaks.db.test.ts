import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Regresión (P14): un producto oculto por moderación no se filtra por ninguna consulta pública, contra
 * la base de desarrollo (`pnpm db:start`). Una prueba por consulta: «Lo que buscas», actividad y
 * «Gente de tus comunidades» (discovery), «N nuevas» (social/unread), búsqueda y Comprar
 * (search/sql), el carrito y su número en la navegación (commerce/cart, identity/session) y los
 * conteos de publicaciones de comunidades nuevas (identity/service). Las demás (feed, Comprar sin
 * texto, similares, perfiles, tarjetas) están en `visibility.db.test.ts`.
 * Usa cuentas `e2e.int.*@example.com`, una categoría y una comunidad temporales; borra todo al final.
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
  env: {
    NODE_ENV: "test",
    TRUSTED_PROXY_HOPS: 0,
    AI_PROVIDER: "mock",
    STORAGE_LOCAL_ROOT: ".data",
  },
}));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ publicUrl: (key: string) => `/media/${key}` }),
}));
// Sesión de quien navega para `getViewerSummary` (el número del carrito en la navegación).
const sessionUser = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      getSession: async () =>
        sessionUser.id
          ? {
              session: { id: sessionUser.id, createdAt: new Date() },
              user: { id: sessionUser.id, name: "Prueba", email: "e2e.int@example.com" },
            }
          : null,
    },
  },
}));

const { db } = await import("@/server/db");
const { Prisma } = await import("@/generated/prisma/client");
const discovery = await import("@/modules/discovery/queries");
const { countUnread } = await import("@/modules/social/unread");
const { parseSearchQuery } = await import("@/modules/search/normalize");
const { postSearchSql, productSearchSql } = await import("@/modules/search/sql");
const cart = await import("@/modules/commerce/cart");
const { getViewerSummary } = await import("@/modules/identity/session");
const identity = await import("@/modules/identity/service");
const { removedFromOrderNotice } = await import("@/app/(social)/carrito/notice");

const tag = randomUUID().slice(0, 8);
const emails = ["seller", "buyer"].map((who) => `e2e.int.leak${who}${tag}@example.com`);
/** Dos letras: sin trigramas, la búsqueda usa la ventana de filas recientes (otra rama del SQL). */
const SHORT = "zq";

type Ids = {
  categoryId: string;
  communityId: string;
  seller: string;
  buyer: string;
  visible: string;
  hidden: string;
  postVisible: string;
  postHidden: string;
  postPlain: string;
};
let ids: Ids;

describe.skipIf(!databaseUrl)("un producto oculto no se filtra (PostgreSQL)", () => {
  beforeAll(async () => {
    const now = Date.now();
    const category = await db.category.create({
      data: { slug: `leaks-test-${tag}`, name: `Fugas ${tag}` },
      select: { id: true },
    });
    const community = await db.community.create({
      data: {
        slug: `fugas-${tag}`,
        name: `Fugas ${tag}`,
        description: "Comunidad de prueba",
        emoji: "🧪",
        isOfficial: false,
      },
      select: { id: true },
    });
    const account = (email: string, username: string, seller: boolean) =>
      db.user.create({
        data: {
          name: "Prueba fugas",
          email,
          profile: { create: { username, displayName: username, onboardedAt: new Date() } },
          ...(seller ? { sellerProfile: { create: { displayName: `Tienda ${username}` } } } : {}),
        },
        select: { id: true, sellerProfile: { select: { id: true } } },
      });
    const seller = await account(emails[0]!, `e2e.int.leakseller${tag}`, true);
    const buyer = await account(emails[1]!, `e2e.int.leakbuyer${tag}`, false);
    // Se unió hace una hora: lo publicado después cuenta como «nuevo».
    await db.communityMembership.create({
      data: { userId: buyer.id, communityId: community.id, createdAt: new Date(now - 3_600_000) },
    });

    const product = (title: string, hidden: boolean) =>
      db.product.create({
        data: {
          sellerId: seller.sellerProfile!.id,
          categoryId: category.id,
          slug: `fugas-${randomUUID()}`,
          title,
          description: "Producto de prueba de moderación.",
          priceCents: 50_000,
          stock: 5,
          status: "ACTIVE",
          city: "Ciudad de México",
          state: "CDMX",
          publishedAt: new Date(now - 600_000),
          ...(hidden ? { moderationStatus: "HIDDEN" as const, moderatedAt: new Date() } : {}),
        },
        select: { id: true },
      });
    const visible = await product(`Termo ${SHORT} visible ${tag}`, false);
    const hidden = await product(`Termo ${SHORT} oculto ${tag}`, true);
    const post = (productId: string | null, body: string) =>
      db.post.create({
        data: {
          authorId: seller.id,
          communityId: community.id,
          body,
          productId,
          type: productId ? "PRODUCT" : "POST",
          publishedAt: new Date(now - 600_000),
        },
        select: { id: true },
      });
    const postVisible = await post(visible.id, `Nuevo termo ${SHORT} visible ${tag}`);
    const postHidden = await post(hidden.id, `Nuevo termo ${SHORT} oculto ${tag}`);
    const postPlain = await post(null, `Sin producto ${SHORT} ${tag}`);

    ids = {
      categoryId: category.id,
      communityId: community.id,
      seller: seller.id,
      buyer: buyer.id,
      visible: visible.id,
      hidden: hidden.id,
      postVisible: postVisible.id,
      postHidden: postHidden.id,
      postPlain: postPlain.id,
    };
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { in: emails } } });
    if (ids) {
      await db.category.deleteMany({ where: { id: ids.categoryId } });
      await db.community.deleteMany({ where: { id: ids.communityId } });
    }
    await db.$disconnect();
  });

  it("«Lo que buscas»: el grupo de productos y la tarjeta nunca traen un oculto", async () => {
    const pool = await discovery.listIntentProductPool(ids.buyer, null);
    const poolIds = pool.map((product) => product.id);
    expect(poolIds).toContain(ids.visible);
    expect(poolIds).not.toContain(ids.hidden);

    await expect(discovery.getIntentProductCard(ids.hidden)).resolves.toBeNull();
    await expect(discovery.getIntentProductCard(ids.visible)).resolves.toMatchObject({
      title: `Termo ${SHORT} visible ${tag}`,
    });
  });

  it("actividad de comunidades: las publicaciones de un oculto no cuentan", async () => {
    const now = Date.now();
    const activity = await discovery.countRecentPostsByCommunity(
      new Date(now - 3_600_000),
      new Date(now),
    );
    expect(activity.find((row) => row.communityId === ids.communityId)?.posts).toBe(2);
  });

  it("«N nuevas»: las publicaciones de un oculto no cuentan", async () => {
    const counts = await countUnread(ids.buyer, new Date());
    expect(counts[ids.communityId]).toBe(2);
  });

  it("búsqueda y Comprar con texto: ni el producto oculto ni su publicación", async () => {
    const run = async (sql: ReturnType<typeof productSearchSql>) =>
      (await db.$queryRaw<{ id: string }[]>(sql)).map((row) => row.id);
    const terms = parseSearchQuery(`termo ${tag}`)!.terms;
    // Con palabras indexables (índice de trigramas) y sin ellas (ventana de lo más reciente).
    for (const products of [
      await run(productSearchSql(terms, 50)),
      await run(productSearchSql([SHORT], 2_000)),
      await run(productSearchSql(terms, 50, { categorySlug: `leaks-test-${tag}` })),
    ]) {
      expect(products).toContain(ids.visible);
      expect(products).not.toContain(ids.hidden);
    }
    for (const posts of [
      await run(postSearchSql(parseSearchQuery(`${SHORT} ${tag}`)!.terms, 50)),
      await run(postSearchSql([SHORT], 2_000)),
    ]) {
      expect(posts).toEqual(expect.arrayContaining([ids.postVisible, ids.postPlain]));
      expect(posts).not.toContain(ids.postHidden);
    }
    // Sanidad: sin el filtro de moderación, el oculto sí coincidiría con la búsqueda.
    const raw = await db.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT "id" FROM "products" WHERE "categoryId" = ${ids.categoryId}::uuid`,
    );
    expect(raw.map((row) => row.id)).toContain(ids.hidden);
  });

  it("carrito: no se puede agregar un oculto; si ya estaba, se omite con un aviso", async () => {
    await expect(cart.addToCart(ids.buyer, ids.hidden, 1, null)).rejects.toMatchObject({
      name: "CartError",
      code: "NOT_AVAILABLE",
    });
    await expect(cart.addToCart(ids.buyer, ids.visible, 2, null)).resolves.toBe(2);

    // Lo agregó antes de que el equipo lo ocultara.
    const { id: cartId } = await db.cart.findUniqueOrThrow({
      where: { userId: ids.buyer },
      select: { id: true },
    });
    await db.cartItem.create({ data: { cartId, productId: ids.hidden, quantity: 1 } });

    const lines = await cart.getCartLines(ids.buyer);
    expect(lines.map((line) => line.product.id)).toEqual([ids.visible]);
    await expect(cart.cartCount(ids.buyer)).resolves.toBe(2);
    const hiddenLines = await cart.countHiddenCartLines(ids.buyer);
    expect(hiddenLines).toBe(1);
    expect(cart.unavailableCartNotice(hiddenLines)).toBe("Un producto ya no está disponible");
    // /carrito lo dice completo, y el número de la navegación ya no cuenta la pieza oculta.
    expect(removedFromOrderNotice(hiddenLines)).toBe(
      "Un producto ya no está disponible y lo quitamos de tu pedido.",
    );
    sessionUser.id = ids.buyer;
    try {
      await expect(getViewerSummary()).resolves.toMatchObject({ cartCount: 2 });
    } finally {
      sessionUser.id = null;
    }

    // Si el equipo lo restaura, vuelve a aparecer (la fila nunca se borró).
    await db.product.update({ where: { id: ids.hidden }, data: { moderationStatus: "VISIBLE" } });
    try {
      const restored = await cart.getCartLines(ids.buyer);
      expect(restored.map((line) => line.product.id).sort()).toEqual(
        [ids.visible, ids.hidden].sort(),
      );
      await expect(cart.countHiddenCartLines(ids.buyer)).resolves.toBe(0);
    } finally {
      await db.product.update({ where: { id: ids.hidden }, data: { moderationStatus: "HIDDEN" } });
    }
  });

  it("aviso del carrito: singular, plural y nada sin ocultos", () => {
    expect(cart.unavailableCartNotice(0)).toBeNull();
    expect(cart.unavailableCartNotice(1)).toBe("Un producto ya no está disponible");
    expect(cart.unavailableCartNotice(3)).toBe("3 productos ya no están disponibles");
    expect(removedFromOrderNotice(0)).toBeNull();
    expect(removedFromOrderNotice(3)).toBe(
      "3 productos ya no están disponibles y los quitamos de tu pedido.",
    );
  });

  it("comunidades nuevas: las publicaciones de un oculto no cuentan", async () => {
    // Menos de 10 miembros: se muestra cuántas publicaciones tiene (visible + sin producto).
    const counts = await identity.countPostsOfNewCommunities();
    expect(counts.get(ids.communityId)).toBe(2);
    await expect(identity.countCommunityPosts(ids.communityId)).resolves.toBe(2);
  });

  it("«Gente de tus comunidades»: publicar un oculto no cuenta como actividad", async () => {
    const now = Date.now();
    const peerEmails = ["peera", "peerb"].map((who) => `e2e.int.leak${who}${tag}@example.com`);
    try {
      const peer = async (who: string, email: string, joinedAgoMs: number) => {
        const user = await db.user.create({
          data: {
            name: "Prueba gente",
            email,
            profile: {
              create: {
                username: `e2e.int.leak${who}${tag}`,
                displayName: who,
                onboardedAt: new Date(),
              },
            },
          },
          select: { id: true },
        });
        await db.communityMembership.create({
          data: {
            userId: user.id,
            communityId: ids.communityId,
            createdAt: new Date(now - joinedAgoMs),
          },
        });
        return user.id;
      };
      // A se unió hace 3 días y acaba de publicar, pero solo el producto oculto; B se unió hace 2 h.
      const peerA = await peer("peera", peerEmails[0]!, 3 * 86_400_000);
      const peerB = await peer("peerb", peerEmails[1]!, 2 * 3_600_000);
      await db.post.create({
        data: {
          authorId: peerA,
          communityId: ids.communityId,
          body: "Lo vendo",
          productId: ids.hidden,
          type: "PRODUCT",
          publishedAt: new Date(now - 60_000),
        },
      });

      // Sin actividad visible, A queda por su fecha de ingreso (después de B), no como quien publicó.
      await expect(
        discovery.listActiveCommunityPeers(ids.buyer, [ids.communityId]),
      ).resolves.toEqual([peerB, peerA]);
    } finally {
      await db.user.deleteMany({ where: { email: { in: peerEmails } } });
    }
  });
});
