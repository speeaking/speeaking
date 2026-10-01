import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Colaboraciones con creadores (ADR-063) contra la base de desarrollo (`pnpm db:start`): quién puede
 * etiquetar, qué ve cada quien en su panel (con métricas de eventos y pedidos reales) y que solo la
 * tienda dueña quita una etiqueta. Crea cuentas `e2e.fix.creadores*@example.com` y las borra al final.
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
vi.mock("@/server/env", () => ({ env: { NODE_ENV: "test", STORAGE_LOCAL_ROOT: ".data" } }));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ publicUrl: (key: string) => `/media/${key}` }),
}));

const { db } = await import("@/server/db");
const {
  findTaggableProduct,
  getAcceptsCollaborations,
  listCreatorPosts,
  listStoreCollaborations,
  markCollaboration,
  removeProductTag,
  setAcceptsCollaborations,
} = await import("./service");

const RUN = randomUUID().slice(0, 8);
const ids = {
  storeUser: "",
  seller: "",
  creator: "",
  stranger: "",
  buyer: "",
  category: "",
  shirt: "",
  shoes: "",
  creatorPost: "",
  secondPost: "",
  ownPost: "",
};
let createdCategory = false;
let slug = "";

async function createUser(tag: string) {
  const user = await db.user.create({
    data: { name: `Creadores ${tag}`, email: `e2e.fix.creadores.${RUN}.${tag}@example.com` },
    select: { id: true },
  });
  await db.profile.create({
    data: {
      userId: user.id,
      username: `e2e.fix.cre.${RUN}.${tag}`,
      displayName: `Persona ${tag}`,
      onboardedAt: new Date(),
    },
  });
  return user.id;
}

async function createProduct(title: string) {
  const product = await db.product.create({
    data: {
      sellerId: ids.seller,
      slug: `e2e-fix-creadores-${RUN}-${randomUUID().slice(0, 8)}`,
      title,
      description: "Producto de prueba",
      priceCents: 64_900,
      stock: 5,
      categoryId: ids.category,
      city: "Ciudad de México",
      state: "CDMX",
      pickupAvailable: true,
      cost: { create: { unitCostCents: 30_000 } },
    },
    select: { id: true, slug: true },
  });
  return product;
}

/** Un pedido pagado de `productId` que llegó desde `sourcePostId`. */
async function createPaidOrder(productId: string, sourcePostId: string, quantity: number) {
  const subtotal = 64_900 * quantity;
  const checkout = await db.checkout.create({
    data: {
      buyerId: ids.buyer,
      status: "PAID",
      totalCents: subtotal,
      paymentMethod: "CARD",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  await db.order.create({
    data: {
      checkoutId: checkout.id,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      status: "PAID",
      deliveryMethod: "PICKUP",
      subtotalCents: subtotal,
      shippingCents: 0,
      platformFeeCents: 0,
      totalCents: subtotal,
      paidAt: new Date(),
      items: {
        create: {
          productId,
          titleSnapshot: "Producto de prueba",
          unitPriceCents: 64_900,
          unitCostCents: 30_000,
          quantity,
          commissionBps: 0,
          sourcePostId,
        },
      },
    },
  });
}

const post = (authorId: string, productId: string, body: string) =>
  db.post.create({ data: { authorId, productId, body }, select: { id: true } });

describe.skipIf(!databaseUrl)("colaboraciones con creadores contra PostgreSQL", () => {
  beforeAll(async () => {
    const existing = await db.category.findFirst({ select: { id: true } });
    if (existing) {
      ids.category = existing.id;
    } else {
      ids.category = (
        await db.category.create({
          data: { slug: `e2e-fix-creadores-${RUN}`, name: "Prueba" },
          select: { id: true },
        })
      ).id;
      createdCategory = true;
    }
    ids.storeUser = await createUser("tienda");
    ids.creator = await createUser("creadora");
    ids.stranger = await createUser("extrana");
    ids.buyer = await createUser("compradora");
    ids.seller = (
      await db.sellerProfile.create({
        data: {
          userId: ids.storeUser,
          displayName: "Ropero de prueba",
          acceptedPaymentMethods: [],
        },
        select: { id: true },
      })
    ).id;
    const shirt = await createProduct("Camisa de prueba");
    ids.shirt = shirt.id;
    slug = shirt.slug;
    ids.shoes = (await createProduct("Tenis de prueba")).id;

    ids.creatorPost = (await post(ids.creator, ids.shirt, "Miren cómo combina esta camisa")).id;
    ids.secondPost = (await post(ids.creator, ids.shoes, "")).id;
    // La tienda también publica su propio producto: no es una colaboración.
    ids.ownPost = (await post(ids.storeUser, ids.shirt, "Ya llegaron")).id;

    const event = (
      type: "PRODUCT_VIEW" | "ADD_TO_CART" | "TRY_ON_GENERATED" | "TRY_ON_REQUESTED" | "IMPRESSION",
      sourcePostId: string,
      entityId: string,
    ) => ({ type, userId: ids.buyer, entityType: "PRODUCT" as const, entityId, sourcePostId });
    await db.analyticsEvent.createMany({
      data: [
        event("PRODUCT_VIEW", ids.creatorPost, ids.shirt),
        event("PRODUCT_VIEW", ids.creatorPost, ids.shirt),
        event("TRY_ON_GENERATED", ids.creatorPost, ids.shirt),
        event("TRY_ON_REQUESTED", ids.creatorPost, ids.shirt),
        event("ADD_TO_CART", ids.creatorPost, ids.shirt),
        // No cuentan: otro tipo de evento, y otro producto con el origen de esta publicación.
        event("IMPRESSION", ids.creatorPost, ids.shirt),
        event("PRODUCT_VIEW", ids.creatorPost, ids.shoes),
      ],
    });
    await createPaidOrder(ids.shirt, ids.creatorPost, 2);
  });

  afterAll(async () => {
    if (ids.storeUser) {
      await db.analyticsEvent.deleteMany({
        where: { entityId: { in: [ids.shirt, ids.shoes].filter(Boolean) } },
      });
      await db.checkout.deleteMany({ where: { buyerId: ids.buyer } });
      await db.product.deleteMany({ where: { sellerId: ids.seller } });
      await db.user.deleteMany({
        where: { id: { in: [ids.storeUser, ids.creator, ids.stranger, ids.buyer] } },
      });
    }
    if (createdCategory) await db.category.delete({ where: { id: ids.category } });
    await db.$disconnect();
  });

  it("la tienda decide: apagado por omisión, y sin tienda no hay ajuste", async () => {
    expect(await getAcceptsCollaborations(ids.storeUser)).toBe(false);
    expect(await getAcceptsCollaborations(ids.creator)).toBeNull();
    expect(await setAcceptsCollaborations(ids.creator, true)).toBe(false);

    // Sin aceptar, nadie más puede etiquetar el producto; su tienda sí (es suyo).
    expect(await findTaggableProduct(slug, ids.creator)).toBeNull();
    expect(await findTaggableProduct(slug, ids.storeUser)).toMatchObject({ own: true });

    expect(await setAcceptsCollaborations(ids.storeUser, true)).toBe(true);
    expect(await getAcceptsCollaborations(ids.storeUser)).toBe(true);
    expect(await findTaggableProduct(slug, ids.creator)).toMatchObject({
      id: ids.shirt,
      title: "Camisa de prueba",
      storeName: "Ropero de prueba",
      priceCents: 64_900,
      own: false,
    });
    expect(await findTaggableProduct("no-existe", ids.creator)).toBeNull();
  });

  it("quien publica ve lo que logró cada publicación con el producto de otra tienda", async () => {
    const posts = await listCreatorPosts(ids.creator);

    expect(posts.map((item) => item.postId)).toEqual(
      expect.arrayContaining([ids.creatorPost, ids.secondPost]),
    );
    expect(posts).toHaveLength(2);
    const first = posts.find((item) => item.postId === ids.creatorPost)!;
    expect(first).toMatchObject({
      excerpt: "Miren cómo combina esta camisa",
      collaboration: false,
      product: { title: "Camisa de prueba", storeName: "Ropero de prueba" },
      metrics: { views: 2, tryOns: 2, carts: 1, orders: 1, units: 2 },
    });
    expect(posts.find((item) => item.postId === ids.secondPost)).toMatchObject({
      excerpt: null,
      metrics: { views: 0, tryOns: 0, carts: 0, orders: 0, units: 0 },
    });
    // Las publicaciones de la tienda sobre SU producto no son colaboraciones.
    expect(await listCreatorPosts(ids.storeUser)).toEqual([]);
  });

  it("la tienda ve quién etiquetó sus productos, sin sus propias publicaciones", async () => {
    const posts = await listStoreCollaborations(ids.storeUser);

    expect(posts).toHaveLength(2);
    expect(posts.every((item) => item.postId !== ids.ownPost)).toBe(true);
    expect(posts.find((item) => item.postId === ids.creatorPost)).toMatchObject({
      author: { displayName: "Persona creadora" },
      product: { title: "Camisa de prueba" },
      metrics: { views: 2, orders: 1 },
    });
    expect(await listStoreCollaborations(ids.creator)).toEqual([]);
  });

  it("«Colaboración» la marcan quien publicó o la tienda; nadie más, y no sobre lo propio", async () => {
    expect(await markCollaboration(ids.stranger, ids.creatorPost)).toBe(false);
    expect(await markCollaboration(ids.storeUser, ids.ownPost)).toBe(false);

    expect(await markCollaboration(ids.creator, ids.creatorPost)).toBe(true);
    expect(await markCollaboration(ids.storeUser, ids.secondPost)).toBe(true);
    // Ya marcada: no hay nada que cambiar.
    expect(await markCollaboration(ids.creator, ids.creatorPost)).toBe(false);

    const marked = await db.post.findMany({
      where: { id: { in: [ids.creatorPost, ids.secondPost, ids.ownPost] }, collaboration: true },
      select: { id: true },
    });
    expect(marked.map((row) => row.id).sort()).toEqual([ids.creatorPost, ids.secondPost].sort());
  });

  it("solo la tienda dueña quita la etiqueta: la publicación sigue y quien publicó recibe un aviso", async () => {
    expect(await removeProductTag(ids.stranger, ids.creatorPost)).toBe(false);
    // Quien publicó no es la tienda; y la tienda no «quita» la etiqueta de su propia publicación.
    expect(await removeProductTag(ids.creator, ids.creatorPost)).toBe(false);
    expect(await removeProductTag(ids.storeUser, ids.ownPost)).toBe(false);

    expect(await removeProductTag(ids.storeUser, ids.creatorPost)).toBe(true);

    expect(
      await db.post.findUnique({
        where: { id: ids.creatorPost },
        select: { productId: true, collaboration: true, status: true },
      }),
    ).toEqual({ productId: null, collaboration: false, status: "PUBLISHED" });
    expect(
      await db.notification.findMany({
        where: { recipientId: ids.creator, postId: ids.creatorPost },
        select: { type: true, actorId: true },
      }),
    ).toEqual([{ type: "PRODUCT_TAG_REMOVED", actorId: ids.storeUser }]);
    expect((await listStoreCollaborations(ids.storeUser)).map((item) => item.postId)).toEqual([
      ids.secondPost,
    ]);
    // Ya sin etiqueta: no hay nada que quitar.
    expect(await removeProductTag(ids.storeUser, ids.creatorPost)).toBe(false);
  });
});
