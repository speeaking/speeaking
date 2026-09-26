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
/** Marca de los eventos de esta corrida (sobrevive al desligado). */
const MARK = `test.${tag}`;

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
    // Los eventos desligados ya no tienen persona: se encuentran por la marca de la prueba.
    await db.analyticsEvent.deleteMany({
      where: { OR: [{ algorithmVersion: MARK }, { userId: { in: [userId, otherUserId] } }] },
    });
    await db.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await db.$disconnect();
  });

  it("desliga toda la actividad previa con el estándar de un evento anónimo", async () => {
    const create = (data: Parameters<typeof db.analyticsEvent.create>[0]["data"]) =>
      db.analyticsEvent.create({ data, select: { id: true } });
    const checkout = await create({
      type: "CHECKOUT_STARTED",
      algorithmVersion: MARK,
      userId,
      anonymousId: "anon-1",
      entityType: "PRODUCT",
      entityId: productId,
      sourcePostId: postId,
      metadata: { checkoutId: randomUUID(), quantity: 2, channel: "copy", reason: "Ana López" },
      createdAt: new Date("2026-09-20T14:37:52.123Z"),
    });
    await create({
      type: "SEARCH",
      algorithmVersion: MARK,
      userId,
      query: "prueba embarazo",
      metadata: { products: 0 },
    });
    const accepted = await create({
      type: "AI_PROPOSAL_ACCEPTED",
      algorithmVersion: MARK,
      userId,
      entityType: "PRODUCT",
      entityId: productId,
      metadata: { responseId: randomUUID() },
    });
    await create({
      type: "SEARCH",
      algorithmVersion: MARK,
      userId: otherUserId,
      query: "de otra persona",
      createdAt: new Date("2026-09-20T10:00:00.000Z"),
    });

    expect(await anonymizeUserActivity(userId)).toBe(3);

    expect(await db.analyticsEvent.count({ where: { userId } })).toBe(0);
    // El id cambia: el UUIDv7 original guardaba la hora al milisegundo (se unía con `checkouts`).
    const anonymized = (type: "CHECKOUT_STARTED" | "AI_PROPOSAL_ACCEPTED") =>
      db.analyticsEvent.findFirstOrThrow({ where: { algorithmVersion: MARK, type } });
    const checkoutRow = await anonymized("CHECKOUT_STARTED");
    expect(checkoutRow.id).not.toBe(checkout.id);
    expect(checkoutRow.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4/);
    expect(
      await db.analyticsEvent.count({ where: { id: { in: [checkout.id, accepted.id] } } }),
    ).toBe(0);
    expect(checkoutRow).toMatchObject({
      userId: null,
      anonymousId: null,
      query: null,
      entityId: productId,
      sourcePostId: postId,
      // Sin el id del checkout ni el texto libre; los conteos y categorías se quedan.
      metadata: { quantity: 2, channel: "copy" },
      createdAt: new Date("2026-09-20T14:00:00.000Z"),
    });
    // En las propuestas de IA la entidad es el producto de la persona: también se descarta.
    expect(await anonymized("AI_PROPOSAL_ACCEPTED")).toMatchObject({
      entityType: null,
      entityId: null,
      metadata: null,
    });
    // La actividad de otra persona no se toca.
    expect(await db.analyticsEvent.count({ where: { userId: otherUserId } })).toBe(1);
  });

  it("al desactivar la personalización desliga en la misma transacción y registra el consentimiento", async () => {
    await db.analyticsEvent.create({
      data: { type: "SEARCH", algorithmVersion: MARK, userId, query: "antes de desactivar" },
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
          algorithmVersion: MARK,
          userId: otherUserId,
          query: "Audífonos",
          createdAt: new Date(Date.now() - 2_000),
        },
        {
          type: "SEARCH",
          algorithmVersion: MARK,
          userId: otherUserId,
          query: "audífonos",
          createdAt: new Date(Date.now() - 1_000),
        },
        {
          type: "PRODUCT_VIEW",
          algorithmVersion: MARK,
          userId: otherUserId,
          entityType: "PRODUCT",
          entityId: productId,
        },
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
