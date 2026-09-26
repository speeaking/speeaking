import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integración contra la base de desarrollo (`pnpm db:start`): el desligado retroactivo (SEC-27) es un
 * UPDATE en SQL que debe dejar cada evento igual que `prepareEvent` sin personalización (SEC-16).
 * Crea una cuenta `e2e.fix.*@example.com` propia y la borra al final (con sus eventos).
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

const { db } = await import("@/server/db");
const { anonymizeUserActivity, clearSearchHistory, listSearchHistory, setPersonalization } =
  await import("./privacy");

const tag = randomUUID().slice(0, 8);
let userId = "";
let otherUserId = "";
const productId = randomUUID();
const postId = randomUUID();

async function createUser(suffix: string) {
  const user = await db.user.create({
    data: { name: "Prueba Privacidad", email: `e2e.fix.${tag}${suffix}@example.com` },
    select: { id: true },
  });
  await db.profile.create({
    data: {
      userId: user.id,
      username: `e2e.fix.${tag}${suffix}`,
      displayName: "Prueba Privacidad",
      onboardedAt: new Date(),
    },
  });
  return user.id;
}

describe.skipIf(!databaseUrl)("privacidad de la actividad contra PostgreSQL (SEC-27)", () => {
  beforeAll(async () => {
    userId = await createUser("a");
    otherUserId = await createUser("b");
  });

  afterAll(async () => {
    await db.analyticsEvent.deleteMany({
      where: { OR: [{ userId: { in: [userId, otherUserId] } }, { entityId: productId }] },
    });
    await db.analyticsEvent.deleteMany({ where: { sourcePostId: postId } });
    await db.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await db.$disconnect();
  });

  it("desliga toda la actividad previa con el estándar de un evento anónimo", async () => {
    const create = (data: Parameters<typeof db.analyticsEvent.create>[0]["data"]) =>
      db.analyticsEvent.create({ data, select: { id: true } });
    const checkout = await create({
      type: "CHECKOUT_STARTED",
      userId,
      anonymousId: "anon-1",
      entityType: "PRODUCT",
      entityId: productId,
      sourcePostId: postId,
      metadata: { checkoutId: randomUUID(), quantity: 2, channel: "copy", reason: "Ana López" },
      createdAt: new Date("2026-09-20T14:37:52.123Z"),
    });
    await create({ type: "SEARCH", userId, query: "prueba embarazo", metadata: { products: 0 } });
    const accepted = await create({
      type: "AI_PROPOSAL_ACCEPTED",
      userId,
      entityType: "PRODUCT",
      entityId: productId,
      metadata: { responseId: randomUUID() },
    });
    await create({
      type: "SEARCH",
      userId: otherUserId,
      query: "de otra persona",
      createdAt: new Date("2026-09-20T10:00:00.000Z"),
    });

    expect(await anonymizeUserActivity(userId)).toBe(3);

    expect(await db.analyticsEvent.count({ where: { userId } })).toBe(0);
    expect(await db.analyticsEvent.findUniqueOrThrow({ where: { id: checkout.id } })).toMatchObject(
      {
        userId: null,
        anonymousId: null,
        query: null,
        entityId: productId,
        sourcePostId: postId,
        // Sin el id del checkout ni el texto libre; los conteos y categorías se quedan.
        metadata: { quantity: 2, channel: "copy" },
        createdAt: new Date("2026-09-20T14:00:00.000Z"),
      },
    );
    // En las propuestas de IA la entidad es el producto de la persona: también se descarta.
    expect(await db.analyticsEvent.findUniqueOrThrow({ where: { id: accepted.id } })).toMatchObject(
      {
        entityType: null,
        entityId: null,
        metadata: null,
      },
    );
    // La actividad de otra persona no se toca.
    expect(await db.analyticsEvent.count({ where: { userId: otherUserId } })).toBe(1);
  });

  it("al desactivar la personalización desliga en la misma transacción y registra el consentimiento", async () => {
    await db.analyticsEvent.create({
      data: { type: "SEARCH", userId, query: "antes de desactivar" },
    });

    await setPersonalization(userId, false);

    const profile = await db.profile.findUniqueOrThrow({ where: { userId } });
    expect(profile.personalizationEnabled).toBe(false);
    expect(await db.analyticsEvent.count({ where: { userId } })).toBe(0);
    const consent = await db.userConsent.findFirstOrThrow({
      where: { userId, type: "PERSONALIZATION" },
      orderBy: { createdAt: "desc" },
    });
    expect(consent.granted).toBe(false);
  });

  it("lista el historial sin repetir y lo borra (solo el de la persona)", async () => {
    await db.analyticsEvent.createMany({
      data: [
        {
          type: "SEARCH",
          userId: otherUserId,
          query: "Audífonos",
          createdAt: new Date(Date.now() - 2_000),
        },
        {
          type: "SEARCH",
          userId: otherUserId,
          query: "audífonos",
          createdAt: new Date(Date.now() - 1_000),
        },
        { type: "PRODUCT_VIEW", userId: otherUserId, entityType: "PRODUCT", entityId: productId },
      ],
    });

    const history = await listSearchHistory(otherUserId);
    expect(history.map((item) => item.query)).toEqual(["audífonos", "de otra persona"]);

    expect(await clearSearchHistory(otherUserId)).toBe(3);
    expect(await listSearchHistory(otherUserId)).toEqual([]);
    // Las vistas de producto no son historial de búsqueda.
    expect(await db.analyticsEvent.count({ where: { userId: otherUserId } })).toBe(1);
  });
});
