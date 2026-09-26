import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Integración contra la base de desarrollo (`pnpm db:start`): el conteo atómico solo se puede probar
 * con PostgreSQL real. Cada corrida usa un scope aleatorio y borra sus cubetas al final.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  // Sin tocar `process.env`: el resto de las pruebas no debe ver las variables de `.env`.
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

vi.mock("./db", async () => {
  const { createPrismaClient } = await import("./db-client");
  return { db: createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base") };
});
vi.mock("./env", () => ({ env: { NODE_ENV: "test", TRUSTED_PROXY_HOPS: 0 } }));

const { db } = await import("./db");
const { cleanupExpiredRateLimits, rateLimit, rateLimitKey, rateLimitMany } =
  await import("./rate-limit");

const SCOPE = `test.rl.${randomUUID().slice(0, 8)}`;

function userKey() {
  return rateLimitKey(SCOPE, "user", randomUUID())!;
}

async function storedCount(key: string) {
  const rows = await db.$queryRaw<{ count: number }[]>`
    SELECT "count" FROM "rate_limit_buckets" WHERE "key" = ${key}`;
  return rows[0]?.count ?? null;
}

/** Simula que la ventana ya venció sin esperar el reloj real. */
async function expire(key: string) {
  await db.$executeRaw`
    UPDATE "rate_limit_buckets" SET "expiresAt" = now() - interval '1 millisecond'
    WHERE "key" = ${key}`;
}

describe.skipIf(!databaseUrl)("rateLimit contra PostgreSQL", () => {
  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "rate_limit_buckets" WHERE "key" LIKE ${`${SCOPE}:%`}`;
    await db.$disconnect();
  });

  it("es atómico: con límite+5 peticiones simultáneas pasan exactamente `limit`", async () => {
    const key = userKey();
    const limit = 20;
    const results = await Promise.all(
      Array.from({ length: limit + 5 }, () => rateLimit({ key, limit, windowSeconds: 60 })),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(limit);
    expect(results.filter((result) => !result.ok)).toHaveLength(5);
    expect(await storedCount(key)).toBe(limit + 5);
  });

  it("bloquea al pasar el límite e informa cuánto falta para la siguiente ventana", async () => {
    const key = userKey();
    for (let i = 0; i < 3; i++) {
      await expect(rateLimit({ key, limit: 3, windowSeconds: 900 })).resolves.toEqual({ ok: true });
    }
    const blocked = await rateLimit({ key, limit: 3, windowSeconds: 900 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(890);
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(900);
    }
  });

  it("los intentos bloqueados no alargan la ventana", async () => {
    const key = userKey();
    await rateLimit({ key, limit: 1, windowSeconds: 900 });
    const [first] = await db.$queryRaw<{ expiresAt: Date }[]>`
      SELECT "expiresAt" FROM "rate_limit_buckets" WHERE "key" = ${key}`;
    await rateLimit({ key, limit: 1, windowSeconds: 900 });
    await rateLimit({ key, limit: 1, windowSeconds: 900 });
    const [after] = await db.$queryRaw<{ expiresAt: Date }[]>`
      SELECT "expiresAt" FROM "rate_limit_buckets" WHERE "key" = ${key}`;
    expect(after?.expiresAt.getTime()).toBe(first?.expiresAt.getTime());
  });

  it("al vencer la ventana el conteo vuelve a empezar", async () => {
    const key = userKey();
    await rateLimit({ key, limit: 2, windowSeconds: 900 });
    await rateLimit({ key, limit: 2, windowSeconds: 900 });
    expect((await rateLimit({ key, limit: 2, windowSeconds: 900 })).ok).toBe(false);

    await expire(key);
    await expect(rateLimit({ key, limit: 2, windowSeconds: 900 })).resolves.toEqual({ ok: true });
    expect(await storedCount(key)).toBe(1);
    await expect(rateLimit({ key, limit: 2, windowSeconds: 900 })).resolves.toEqual({ ok: true });
    expect((await rateLimit({ key, limit: 2, windowSeconds: 900 })).ok).toBe(false);
  });

  it("usa el reloj real de la base (ventana de 1 s)", async () => {
    const key = userKey();
    await expect(rateLimit({ key, limit: 1, windowSeconds: 1 })).resolves.toEqual({ ok: true });
    await expect(rateLimit({ key, limit: 1, windowSeconds: 1 })).resolves.toEqual({
      ok: false,
      retryAfterSeconds: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await expect(rateLimit({ key, limit: 1, windowSeconds: 1 })).resolves.toEqual({ ok: true });
  });

  it("cada llave lleva su propia cuenta", async () => {
    const a = userKey();
    const b = userKey();
    await rateLimit({ key: a, limit: 1, windowSeconds: 60 });
    expect((await rateLimit({ key: a, limit: 1, windowSeconds: 60 })).ok).toBe(false);
    await expect(rateLimit({ key: b, limit: 1, windowSeconds: 60 })).resolves.toEqual({ ok: true });
  });

  it("rateLimitMany: una IP bloqueada no gasta la cubeta del correo", async () => {
    const ip = rateLimitKey(SCOPE, "ip", `2001:db8:${randomUUID().slice(0, 4)}::1`)!;
    const email = rateLimitKey(SCOPE, "email", `e2e.fix.${randomUUID()}@example.com`)!;
    const rules = [
      { key: ip, limit: 1, windowSeconds: 60 },
      { key: email, limit: 5, windowSeconds: 60 },
    ];
    await expect(rateLimitMany(rules)).resolves.toEqual({ ok: true });
    expect((await rateLimitMany(rules)).ok).toBe(false);
    expect((await rateLimitMany(rules)).ok).toBe(false);
    expect(await storedCount(email)).toBe(1);
  });

  it("no guarda correos en claro", async () => {
    const address = `e2e.fix.${randomUUID()}@example.com`;
    const key = rateLimitKey(SCOPE, "email", address)!;
    await rateLimit({ key, limit: 5, windowSeconds: 60 });
    const rows = await db.$queryRaw<{ key: string }[]>`
      SELECT "key" FROM "rate_limit_buckets" WHERE "key" LIKE ${`${SCOPE}:email:%`}`;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.key).not.toContain("@");
      expect(row.key).not.toContain("e2e.fix");
    }
  });

  it("la limpieza borra solo cubetas vencidas", async () => {
    const expired = userKey();
    const active = userKey();
    await rateLimit({ key: expired, limit: 5, windowSeconds: 60 });
    await rateLimit({ key: active, limit: 5, windowSeconds: 60 });
    await expire(expired);

    // Puede haber otras cubetas vencidas en la base de desarrollo: se limpia hasta vaciar.
    while ((await cleanupExpiredRateLimits()) > 0);
    expect(await storedCount(expired)).toBeNull();
    expect(await storedCount(active)).toBe(1);
  });
});
