import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integración contra la base de desarrollo (`pnpm db:start`): ¿la cuenta ya hizo lo que pide el
 * registro (términos, aviso de privacidad y 18 años o más, ADR-076)? Si no, la bienvenida le pide
 * las casillas. Crea una cuenta `e2e.cln.*@example.com` propia y la borra al final.
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
const { hasLegalConsents } = await import("./service");

const tag = randomUUID().slice(0, 8);
let userId = "";

async function grant(...types: ("TERMS" | "PRIVACY_NOTICE" | "AGE_18")[]) {
  await db.userConsent.createMany({
    data: types.map((type) => ({ userId, type, version: "2026-10-08", granted: true })),
  });
}

describe.skipIf(!databaseUrl)("hasLegalConsents contra PostgreSQL", () => {
  beforeAll(async () => {
    const user = await db.user.create({
      data: { name: "Prueba Mayoría", email: `e2e.cln.edad${tag}@example.com` },
      select: { id: true },
    });
    userId = user.id;
  });

  beforeEach(async () => {
    await db.userConsent.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    if (userId) await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("una cuenta de Google recién creada no tiene nada: la bienvenida pide las casillas", async () => {
    await expect(hasLegalConsents(userId)).resolves.toBe(false);
  });

  it("términos y aviso sin la declaración de edad no bastan (registro anterior a la casilla)", async () => {
    await grant("TERMS", "PRIVACY_NOTICE");
    await expect(hasLegalConsents(userId)).resolves.toBe(false);
  });

  it("con términos, aviso y 18 años o más, ya no se piden", async () => {
    await grant("TERMS", "PRIVACY_NOTICE", "AGE_18");
    await expect(hasLegalConsents(userId)).resolves.toBe(true);
  });

  it("la edad sola tampoco basta", async () => {
    await grant("AGE_18");
    await expect(hasLegalConsents(userId)).resolves.toBe(false);
  });
});
