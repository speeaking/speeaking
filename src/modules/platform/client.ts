import type { Prisma } from "@/generated/prisma/client";
import type { Database } from "@/server/db-client";

/**
 * El motor de automejora (platform y ceo) recibe la base como parámetro (sin `server-only` ni `@/server/db`): así corre
 * igual en `/api/cron/daily`, en `scripts/ops-daily.ts` y en pruebas dentro de una transacción que se
 * deshace al final.
 */
export type Client = Database | Prisma.TransactionClient;

/**
 * ¿Es el cliente con pool? El de una transacción no tiene `$connect`. Ojo: en Prisma 7 el cliente de
 * una transacción SÍ expone `$transaction` (anida con un savepoint en la misma conexión), así que
 * `"$transaction" in client` no distingue uno de otro.
 */
export function isPoolClient(client: Client): client is Database {
  return "$connect" in client;
}

/** Corre `fn` en una transacción; si `client` ya es una, la reutiliza (sin anidar). */
export function inTransaction<T>(
  client: Client,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (isPoolClient(client)) {
    return client.$transaction(fn, { maxWait: 10_000, timeout: 60_000 });
  }
  return fn(client);
}

/** Candado de transacción por nombre (se libera al terminar la transacción). */
export async function lockName(tx: Prisma.TransactionClient, name: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${name}, 0))`;
}

/**
 * Corre consultas en paralelo con el pool, o una tras otra dentro de una transacción (una sola
 * conexión: node-postgres no admite consultas simultáneas en el mismo cliente).
 */
export async function parallel<T extends unknown[]>(
  client: Client,
  tasks: [...{ [K in keyof T]: () => Promise<T[K]> }],
): Promise<T> {
  if (isPoolClient(client)) {
    return Promise.all(tasks.map((task) => task())) as Promise<T>;
  }
  const results: unknown[] = [];
  for (const task of tasks) results.push(await task());
  return results as T;
}
