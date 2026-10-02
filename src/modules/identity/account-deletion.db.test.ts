import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Integración contra la base de desarrollo (`pnpm db:start`): borrar la cuenta de verdad, y
 * anonimizarla cuando hay pedidos que conservar. Usa cuentas `e2e.fix.*` y las borra al final.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  // El servicio anonimiza la actividad con `analytics/privacy`, que valida el entorno al cargarse.
  process.env.DATABASE_URL ??= local.DATABASE_URL;
  process.env.BETTER_AUTH_SECRET ??= local.BETTER_AUTH_SECRET;
  return { databaseUrl: process.env.DATABASE_URL };
});

const { createPrismaClient } = await import("@/server/db-client");
const db = createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base");
const { deleteAccount } = await import("./account-deletion");

const users: string[] = [];
const deleted: string[] = [];
const storage = { delete: vi.fn(async (key: string) => void deleted.push(key)) };

async function createPerson(prefix: string) {
  const suffix = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: {
      name: "Prueba borrado",
      email: `e2e.fix.${prefix}${suffix}@example.com`,
      profile: {
        create: {
          username: `e2e.fix.${prefix}${suffix}`,
          displayName: "Prueba borrado",
          onboardedAt: new Date(),
        },
      },
    },
    select: { id: true },
  });
  users.push(user.id);
  return user.id;
}

describe.skipIf(!databaseUrl)("borrar mi cuenta contra PostgreSQL (ADR-048)", () => {
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("sin pedidos: la cuenta desaparece con su perfil, sus fotos y su conversación", async () => {
    const me = await createPerson("del");
    const other = await createPerson("del");
    const community = await db.community.findFirstOrThrow({
      select: { id: true, memberCount: true },
    });
    await db.communityMembership.create({ data: { userId: me, communityId: community.id } });
    await db.community.update({
      where: { id: community.id },
      data: { memberCount: { increment: 1 } },
    });
    const media = await db.media.create({
      data: {
        ownerId: me,
        storageKey: `images/2026/09/${randomUUID()}.webp`,
        mimeType: "image/webp",
        width: 10,
        height: 10,
        sizeBytes: 100,
        status: "READY",
      },
      select: { id: true, storageKey: true },
    });
    await db.conversation.create({
      data: {
        userAId: me < other ? me : other,
        userBId: me < other ? other : me,
        messages: { create: { senderId: me, body: "hola" } },
      },
    });

    const outcome = await deleteAccount(db, storage, me);

    expect(outcome.mode).toBe("deleted");
    expect(deleted).toContain(media.storageKey);
    expect(await db.user.findUnique({ where: { id: me } })).toBeNull();
    expect(await db.media.findUnique({ where: { id: media.id } })).toBeNull();
    expect(await db.conversation.count({ where: { OR: [{ userAId: me }, { userBId: me }] } })).toBe(
      0,
    );
    const after = await db.community.findUniqueOrThrow({
      where: { id: community.id },
      select: { memberCount: true },
    });
    expect(after.memberCount).toBe(community.memberCount);
  });

  it("con pedidos: se conservan sin datos personales y la cuenta queda anonimizada", async () => {
    const buyer = await createPerson("anon");
    const sellerUser = await createPerson("anon");
    const category = await db.category.findFirstOrThrow({ select: { id: true } });
    const seller = await db.sellerProfile.create({
      data: { userId: sellerUser, displayName: "Tienda de prueba" },
      select: { id: true },
    });
    const product = await db.product.create({
      data: {
        sellerId: seller.id,
        slug: `e2e-fix-anon-${randomUUID().slice(0, 8)}`,
        title: "Producto de prueba",
        description: "x",
        priceCents: 1_000,
        stock: 1,
        categoryId: category.id,
        city: "CDMX",
        state: "CDMX",
      },
      select: { id: true },
    });
    const checkout = await db.checkout.create({
      data: {
        buyerId: buyer,
        status: "PAID",
        totalCents: 1_000,
        paymentMethod: "CARD",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      select: { id: true },
    });
    await db.order.create({
      data: {
        checkoutId: checkout.id,
        buyerId: buyer,
        sellerId: seller.id,
        status: "PAID",
        deliveryMethod: "PICKUP",
        subtotalCents: 1_000,
        shippingCents: 0,
        platformFeeCents: 0,
        totalCents: 1_000,
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPriceCents: 1_000,
            unitCostCents: 500,
            commissionBps: 0,
            titleSnapshot: "x",
          },
        },
      },
    });

    const outcome = await deleteAccount(db, storage, sellerUser);

    expect(outcome.mode).toBe("anonymized");
    const user = await db.user.findUniqueOrThrow({
      where: { id: sellerUser },
      select: { email: true, name: true, profile: true, sellerProfile: true },
    });
    expect(user.email).toBe(`eliminada-${sellerUser}@speeaking.invalid`);
    expect(user.name).toBe("Cuenta eliminada");
    expect(user.profile).toBeNull();
    expect(user.sellerProfile).toMatchObject({
      displayName: "Tienda eliminada",
      status: "SUSPENDED",
    });
    expect(await db.order.count({ where: { sellerId: seller.id } })).toBe(1);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: product.id }, select: { status: true } }))
        .status,
    ).toBe("ARCHIVED");
  });
});
