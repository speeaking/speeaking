import type { Prisma } from "@/generated/prisma/client";
import type { WalletEntryKind } from "@/generated/prisma/enums";
import type { Database } from "@/server/db-client";

/**
 * Saldo (ADR-044): una cartera por cuenta, en centavos MXN, con libro de movimientos. Cada cargo o
 * abono toma un candado de fila (`FOR UPDATE`) y guarda el saldo resultante; el CHECK de la base
 * (`balanceCents >= 0`) es la última defensa. Sin `server-only` ni `@/server/db`: recibe el cliente
 * (la base o la transacción en curso), como el presupuesto de IA.
 */
export type WalletClient = Prisma.TransactionClient | Database;

export type WalletEntryInput = {
  userId: string;
  /** Centavos, siempre positivos: el signo lo pone el tipo de movimiento. */
  amountCents: number;
  kind: WalletEntryKind;
  reference?: string | null;
  simulated?: boolean;
};

export type DebitResult =
  | { ok: true; entryId: string; balanceCents: number }
  | { ok: false; reason: "insufficient"; balanceCents: number };

function assertAmount(amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error(`[billing] monto inválido: ${amountCents}`);
  }
}

/** La cartera de la persona (se crea al primer uso). */
export async function getOrCreateWallet(client: WalletClient, userId: string) {
  return client.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true, balanceCents: true },
  });
}

/** Bloquea la fila de la cartera dentro de la transacción y devuelve el saldo vigente. */
async function lockWallet(tx: Prisma.TransactionClient, walletId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ balanceCents: number }[]>`
    SELECT "balanceCents" FROM "wallets" WHERE "id" = ${walletId}::uuid FOR UPDATE`;
  const row = rows[0];
  if (!row) throw new Error("[billing] cartera inexistente");
  return row.balanceCents;
}

/** Abona (recarga, bono, devolución o ajuste positivo). Dentro de una transacción. */
export async function creditWallet(
  tx: Prisma.TransactionClient,
  { userId, amountCents, kind, reference = null, simulated = false }: WalletEntryInput,
) {
  assertAmount(amountCents);
  const wallet = await getOrCreateWallet(tx, userId);
  const current = await lockWallet(tx, wallet.id);
  const balanceCents = current + amountCents;
  await tx.wallet.update({ where: { id: wallet.id }, data: { balanceCents } });
  const entry = await tx.walletEntry.create({
    data: {
      walletId: wallet.id,
      kind,
      amountCents,
      balanceAfterCents: balanceCents,
      reference,
      simulated,
    },
    select: { id: true },
  });
  return { entryId: entry.id, balanceCents };
}

/**
 * Carga (prueba pagada, patrocinio). Dentro de una transacción; si no alcanza, no cambia nada y lo
 * dice: quien llama decide qué ofrecer (recargar, esperar las gratis…).
 */
export async function debitWallet(
  tx: Prisma.TransactionClient,
  { userId, amountCents, kind, reference = null }: WalletEntryInput,
): Promise<DebitResult> {
  assertAmount(amountCents);
  const wallet = await getOrCreateWallet(tx, userId);
  const current = await lockWallet(tx, wallet.id);
  if (current < amountCents) return { ok: false, reason: "insufficient", balanceCents: current };
  const balanceCents = current - amountCents;
  await tx.wallet.update({ where: { id: wallet.id }, data: { balanceCents } });
  const entry = await tx.walletEntry.create({
    data: {
      walletId: wallet.id,
      kind,
      amountCents: -amountCents,
      balanceAfterCents: balanceCents,
      reference,
    },
    select: { id: true },
  });
  return { ok: true, entryId: entry.id, balanceCents };
}

export type WalletSummary = {
  balanceCents: number;
  currency: string;
  /** Parte del saldo que vino de recargas simuladas (piloto): se muestra como tal. */
  simulatedCents: number;
  entries: {
    id: string;
    kind: WalletEntryKind;
    amountCents: number;
    balanceAfterCents: number;
    reference: string | null;
    simulated: boolean;
    createdAt: string;
  }[];
};

/** Saldo y últimos movimientos de una persona (solo para ella). */
export async function walletSummary(
  client: WalletClient,
  userId: string,
  limit = 30,
): Promise<WalletSummary> {
  const wallet = await client.wallet.findUnique({
    where: { userId },
    select: { balanceCents: true, currency: true },
  });
  if (!wallet) return { balanceCents: 0, currency: "MXN", simulatedCents: 0, entries: [] };
  const [entries, simulated] = await Promise.all([
    client.walletEntry.findMany({
      where: { wallet: { userId } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        kind: true,
        amountCents: true,
        balanceAfterCents: true,
        reference: true,
        simulated: true,
        createdAt: true,
      },
    }),
    client.walletEntry.aggregate({
      _sum: { amountCents: true },
      where: { wallet: { userId }, simulated: true, amountCents: { gt: 0 } },
    }),
  ]);
  return {
    balanceCents: wallet.balanceCents,
    currency: wallet.currency,
    simulatedCents: Math.min(wallet.balanceCents, simulated._sum.amountCents ?? 0),
    entries: entries.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
  };
}

/** Lo cargado hoy (UTC) a una cartera por un tipo de movimiento: el tope diario del patrocinio. */
export async function chargedTodayCents(
  client: WalletClient,
  userId: string,
  kind: WalletEntryKind,
  now = new Date(),
): Promise<number> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sum = await client.walletEntry.aggregate({
    _sum: { amountCents: true },
    where: { wallet: { userId }, kind, amountCents: { lt: 0 }, createdAt: { gte: start } },
  });
  return -(sum._sum.amountCents ?? 0);
}
