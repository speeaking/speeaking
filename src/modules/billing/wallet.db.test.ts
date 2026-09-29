import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Integración contra la base de desarrollo (`pnpm db:start`): el saldo nunca baja de cero aunque
 * dos cargos lleguen a la vez, y cada movimiento guarda el saldo resultante. Usa cuentas
 * `e2e.fix.*` y las borra al final.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

const { createPrismaClient } = await import("@/server/db-client");
const db = createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base");
const { chargedTodayCents, creditWallet, debitWallet, walletSummary } = await import("./wallet");

const users: string[] = [];

async function createUser() {
  const user = await db.user.create({
    data: {
      name: "Prueba saldo",
      email: `e2e.fix.wallet${randomUUID().slice(0, 8)}@example.com`,
    },
    select: { id: true },
  });
  users.push(user.id);
  return user.id;
}

describe.skipIf(!databaseUrl)("saldo contra PostgreSQL (ADR-044)", () => {
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("abona, carga y guarda el saldo resultante de cada movimiento", async () => {
    const userId = await createUser();
    await db.$transaction((tx) =>
      creditWallet(tx, { userId, amountCents: 3_900, kind: "TOPUP", reference: "recarga-39" }),
    );
    const debit = await db.$transaction((tx) =>
      debitWallet(tx, { userId, amountCents: 350, kind: "TRY_ON", reference: "prueba-1" }),
    );
    expect(debit).toMatchObject({ ok: true, balanceCents: 3_550 });
    const summary = await walletSummary(db, userId);
    expect(summary.balanceCents).toBe(3_550);
    expect(
      summary.entries.map((entry) => [entry.kind, entry.amountCents, entry.balanceAfterCents]),
    ).toEqual([
      ["TRY_ON", -350, 3_550],
      ["TOPUP", 3_900, 3_900],
    ]);
    expect(await chargedTodayCents(db, userId, "TRY_ON")).toBe(350);
  });

  it("no cobra lo que no hay, ni con cargos simultáneos", async () => {
    const userId = await createUser();
    await db.$transaction((tx) => creditWallet(tx, { userId, amountCents: 700, kind: "TOPUP" }));
    const attempts = await Promise.all(
      Array.from({ length: 4 }, () =>
        db.$transaction((tx) => debitWallet(tx, { userId, amountCents: 350, kind: "TRY_ON" })),
      ),
    );
    expect(attempts.filter((result) => result.ok)).toHaveLength(2);
    expect(attempts.filter((result) => !result.ok)).toHaveLength(2);
    expect((await walletSummary(db, userId)).balanceCents).toBe(0);
  });

  it("el saldo simulado se distingue del real", async () => {
    const userId = await createUser();
    await db.$transaction((tx) =>
      creditWallet(tx, { userId, amountCents: 3_900, kind: "TOPUP", simulated: true }),
    );
    const summary = await walletSummary(db, userId);
    expect(summary.simulatedCents).toBe(3_900);
    expect(summary.entries[0]?.simulated).toBe(true);
  });
});
