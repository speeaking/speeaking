import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integración contra la base de desarrollo (`pnpm db:start`): la reserva atómica del presupuesto de
 * IA (SEC-19) y la retención de entradas (SEC-29) solo se prueban con PostgreSQL real. Usa una cuenta
 * `e2e.fix.*@example.com` propia y un modelo con precio; borra sus filas y cubetas al final.
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
vi.mock("@/server/env", () => ({ env: { NODE_ENV: "test", TRUSTED_PROXY_HOPS: 0 } }));
vi.mock("@/modules/platform/settings", () => ({ getAiBudget: vi.fn() }));

const { db } = await import("@/server/db");
const { AIError } = await import("./errors");
const { committedSpendMicros, reserveAiRequest } = await import("./reservation");
const { redactExpiredAiInputs } = await import("./retention");
const { DEFAULT_AI_BUDGET } = await import("./budget");
const { maxCallCostMicrosUsd } = await import("./cost");

const tag = randomUUID().slice(0, 8);
const users: string[] = [];
/** Modelo con precio: cada reserva compromete su costo máximo. */
const priced = { id: "test", model: "claude-haiku-4-5", promptVersion: `test@${tag}` };
const estimate = maxCallCostMicrosUsd(priced.model)!;

async function createUser() {
  const user = await db.user.create({
    data: { name: "Prueba IA", email: `e2e.fix.ai${tag}${randomUUID().slice(0, 8)}@example.com` },
    select: { id: true },
  });
  users.push(user.id);
  return user.id;
}

/** Presupuesto del mes = lo ya comprometido en la base + exactamente `slots` llamadas más. */
async function budgetWithRoomFor(slots: number, perHour = 500, perDay = 2_000, perMonth = 5_000) {
  const committed = await committedSpendMicros(db, new Date(), estimate);
  // Medio micro-dólar de holgura: el límite se redondea hacia abajo tras pasar por dólares.
  const usd = (committed + slots * estimate + 0.5) / 1_000_000;
  return {
    ...DEFAULT_AI_BUDGET,
    seedMonthlyUsd: usd,
    hardCapMonthlyUsd: usd,
    revenueSharePercent: 0,
    maxRequestsPerUserPerHour: perHour,
    maxRequestsPerUserPerDay: perDay,
    maxRequestsPerUserPerMonth: perMonth,
  };
}

function reserve(userId: string | null, budget: Awaited<ReturnType<typeof budgetWithRoomFor>>) {
  return reserveAiRequest({
    userId,
    feature: "SALE_PROPOSAL",
    provider: priced,
    input: { productName: "Prueba" },
    budget,
  }).then(
    () => "reservada",
    (error: unknown) => (error instanceof AIError ? error.code : "otro"),
  );
}

describe.skipIf(!databaseUrl)("reserva del presupuesto de IA contra PostgreSQL (SEC-19)", () => {
  beforeAll(() => {
    expect(estimate).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await db.aIRequest.deleteMany({ where: { promptVersion: priced.promptVersion } });
    await db.$executeRaw`
      DELETE FROM "rate_limit_buckets"
      WHERE "key" LIKE ANY (${users.flatMap((id) => [`ai:user:${id}`, `ai.day:user:${id}`])}::text[])`;
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("es atómica: con lugar para 3, de 12 llamadas simultáneas pasan exactamente 3", async () => {
    const budget = await budgetWithRoomFor(3);
    const results = await Promise.all(
      Array.from({ length: 12 }, async () => reserve(await createUser(), budget)),
    );

    expect(results.filter((result) => result === "reservada")).toHaveLength(3);
    expect(results.filter((result) => result === "BUDGET_EXCEEDED")).toHaveLength(9);
    const rows = await db.aIRequest.groupBy({
      by: ["status"],
      where: { promptVersion: priced.promptVersion },
      _count: { _all: true },
    });
    expect(Object.fromEntries(rows.map((row) => [row.status, row._count._all]))).toEqual({
      PENDING: 3,
      BLOCKED_BUDGET: 9,
    });
  });

  it("las llamadas fallidas siguen contando su costo máximo (no liberan presupuesto)", async () => {
    const budget = await budgetWithRoomFor(1);
    const userId = await createUser();
    expect(await reserve(userId, budget)).toBe("reservada");
    await db.aIRequest.updateMany({
      where: { promptVersion: priced.promptVersion, status: "PENDING", userId },
      data: { status: "FAILED", errorCode: "INVALID_OUTPUT" },
    });

    expect(await reserve(userId, budget)).toBe("BUDGET_EXCEEDED");
  });

  it("la cuota por persona es atómica y cuenta cada intento", async () => {
    const budget = await budgetWithRoomFor(50, 4);
    const userId = await createUser();
    const results = await Promise.all(Array.from({ length: 10 }, () => reserve(userId, budget)));

    expect(results.filter((result) => result === "reservada")).toHaveLength(4);
    expect(results.filter((result) => result === "RATE_LIMITED")).toHaveLength(6);
  });

  it("la cuota diaria corta aunque la horaria tenga lugar", async () => {
    const budget = await budgetWithRoomFor(50, 100, 2);
    const userId = await createUser();
    const results = [];
    for (let attempt = 0; attempt < 3; attempt += 1) results.push(await reserve(userId, budget));

    expect(results).toEqual(["reservada", "reservada", "QUOTA_EXCEEDED"]);
  });

  it("la cuota mensual (ADR-033: 30) cuenta lo que llegó al proveedor, no lo bloqueado", async () => {
    const budget = await budgetWithRoomFor(50, 100, 100, 2);
    const userId = await createUser();
    await db.aIRequest.create({
      data: {
        userId,
        feature: "SALE_PROPOSAL",
        provider: "test",
        model: priced.model,
        promptVersion: priced.promptVersion,
        input: {},
        status: "BLOCKED_BUDGET",
      },
    });
    const results = [];
    for (let attempt = 0; attempt < 3; attempt += 1) results.push(await reserve(userId, budget));

    expect(results).toEqual(["reservada", "reservada", "QUOTA_EXCEEDED"]);
    const error = await reserveAiRequest({
      userId,
      feature: "CONTENT_GENERATION",
      provider: priced,
      input: {},
      budget,
    }).catch((caught: unknown) => caught);
    // Suma todas las funciones de IA y dice cuánto falta para el mes siguiente.
    expect(error).toMatchObject({ code: "QUOTA_EXCEEDED", scope: "month" });
    expect((error as InstanceType<typeof AIError>).retryAfterSeconds).toBeGreaterThan(0);
  });

  it("las tareas del sistema (sin persona) no tienen cuota por persona, pero sí presupuesto", async () => {
    const budget = await budgetWithRoomFor(2, 1, 1, 1);
    const results = [];
    for (let attempt = 0; attempt < 3; attempt += 1) results.push(await reserve(null, budget));

    expect(results).toEqual(["reservada", "reservada", "BUDGET_EXCEEDED"]);
  });

  it("un modelo sin precio no se llama ni se registra (fallaría después de gastar)", async () => {
    const userId = await createUser();
    const before = await db.aIRequest.count({ where: { userId } });
    const result = await reserveAiRequest({
      userId,
      feature: "SALE_PROPOSAL",
      provider: { ...priced, model: "modelo-sin-precio" },
      input: {},
      budget: await budgetWithRoomFor(5),
    }).catch((error: unknown) => (error instanceof AIError ? error.code : "otro"));

    expect(result).toBe("PROVIDER_ERROR");
    expect(await db.aIRequest.count({ where: { userId } })).toBe(before);
  });
});

describe.skipIf(!databaseUrl)("retención de la entrada de IA contra PostgreSQL (SEC-29)", () => {
  it("a los 90 días reemplaza la entrada por { redacted: true } y conserva la fila", async () => {
    const userId = await createUser();
    const base = { userId, feature: "SALE_PROPOSAL" as const, provider: "test", model: "mock" };
    const old = await db.aIRequest.create({
      data: {
        ...base,
        promptVersion: priced.promptVersion,
        input: { text: "Tengo 3 tenis", costCents: 90_000 },
        createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    const recent = await db.aIRequest.create({
      data: {
        ...base,
        promptVersion: priced.promptVersion,
        input: { text: "Tengo 5 gorras" },
        createdAt: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    });

    expect(await redactExpiredAiInputs()).toBeGreaterThanOrEqual(1);

    const rows = await db.aIRequest.findMany({
      where: { id: { in: [old.id, recent.id] } },
      select: { id: true, input: true },
    });
    const input = new Map(rows.map((row) => [row.id, row.input]));
    expect(input.get(old.id)).toEqual({ redacted: true });
    expect(input.get(recent.id)).toEqual({ text: "Tengo 5 gorras" });
  });
});
