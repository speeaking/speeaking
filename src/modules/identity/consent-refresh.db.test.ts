import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integración contra la base de desarrollo (`pnpm db:start`): volver a aceptar los documentos
 * legales (`consent-refresh.ts`). El candado por persona (`pg_advisory_xact_lock`) y la transacción
 * solo se prueban de verdad con PostgreSQL: varios «Aceptar» simultáneos (varias pestañas) dejan una
 * sola fila por documento. Crea una cuenta `e2e.cln.*@example.com` propia y la borra al final.
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
const { acceptPendingLegalDocuments, getPendingLegalDocuments } = await import("./consent-refresh");
const { LEGAL_VERSIONS } = await import("./constants");

const tag = randomUUID().slice(0, 8);
let userId = "";

const CURRENT = [
  { type: "PRIVACY_NOTICE", version: LEGAL_VERSIONS.privacyNotice },
  { type: "TERMS", version: LEGAL_VERSIONS.terms },
] as const;

function consentRows() {
  return db.userConsent.findMany({
    where: { userId, type: { in: ["PRIVACY_NOTICE", "TERMS"] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { type: true, version: true, granted: true },
  });
}

describe.skipIf(!databaseUrl)("volver a aceptar los documentos legales contra PostgreSQL", () => {
  beforeAll(async () => {
    const user = await db.user.create({
      data: { name: "Prueba Consentimiento", email: `e2e.cln.${tag}@example.com` },
      select: { id: true },
    });
    userId = user.id;
  });

  beforeEach(async () => {
    // Como quien se registró con versiones anteriores.
    await db.userConsent.deleteMany({ where: { userId } });
    await db.userConsent.createMany({
      data: [
        { userId, type: "TERMS", version: "2020-01-01", granted: true },
        { userId, type: "PRIVACY_NOTICE", version: "2020-01-01", granted: true },
      ],
    });
  });

  afterAll(async () => {
    if (userId) await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("varios «Aceptar» simultáneos dejan una sola fila nueva por documento", async () => {
    expect(await getPendingLegalDocuments(userId)).toEqual(CURRENT);
    // Conexiones ya abiertas: sin esto la primera transacción termina mientras las demás esperan
    // conexión, y la carrera (leer «pendiente» a la vez y escribir dos veces) nunca se da.
    await Promise.all(Array.from({ length: 5 }, () => db.$executeRaw`SELECT pg_sleep(0.05)`));

    const results = await Promise.all(
      Array.from({ length: 5 }, () => acceptPendingLegalDocuments(userId, CURRENT)),
    );

    // Uno registró ambos; los demás llegaron con todo al día (esperaron el candado).
    expect(results.filter((result) => result.accepted.length > 0)).toHaveLength(1);
    expect(results.every((result) => result.stale.length === 0)).toBe(true);
    const expected = [
      { type: "TERMS", version: "2020-01-01", granted: true },
      { type: "PRIVACY_NOTICE", version: "2020-01-01", granted: true },
      ...CURRENT.map((document) => ({ ...document, granted: true })),
    ];
    expect((await consentRows()).sort(byTypeThenVersion)).toEqual(expected.sort(byTypeThenVersion));
    expect(await getPendingLegalDocuments(userId)).toEqual([]);
  });

  it("no registra una versión que el aviso no mostró", async () => {
    const result = await acceptPendingLegalDocuments(userId, [
      { type: "PRIVACY_NOTICE", version: "2020-06-01" },
      CURRENT[1],
    ]);

    expect(result).toEqual({ accepted: [CURRENT[1]], stale: [CURRENT[0]] });
    expect(await getPendingLegalDocuments(userId)).toEqual([CURRENT[0]]);
  });
});

function byTypeThenVersion(
  a: { type: string; version: string },
  b: { type: string; version: string },
) {
  return a.type.localeCompare(b.type) || a.version.localeCompare(b.version);
}
