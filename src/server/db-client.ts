import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Fábrica del cliente de Prisma (sin `server-only` para poder usarla en scripts como el seed).
 *
 * La sesión siempre va en UTC: el adaptador envía y lee las fechas sin zona horaria, así que con una
 * base en otra zona (p. ej. America/Mexico_City) cada fecha quedaba desfasada frente a `now()` en SQL
 * (ADR-028).
 */
export function createPrismaClient(connectionString: string) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, options: "-c TimeZone=UTC" }),
  });
}

export type Database = ReturnType<typeof createPrismaClient>;
