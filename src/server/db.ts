import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { createPrismaClient, type Database } from "./db-client";
import { env } from "./env";

// En desarrollo, la recarga en caliente crearía un pool nuevo en cada cambio; se reutiliza uno.
// La llave incluye modelos y campos del esquema: tras `prisma generate` con modelos o columnas nuevas,
// el cliente en caché se reemplaza en lugar de quedarse desactualizado (ADR-026).
const schemaKey = Object.entries(Prisma)
  .filter(([name]) => name.endsWith("ScalarFieldEnum"))
  .map(([name, fields]) => `${name}:${Object.keys(fields as object).join(",")}`)
  .concat(Object.values(Prisma.ModelName))
  .join("|");
const globalForDb = globalThis as unknown as { db?: Database; dbSchemaKey?: string };

function resolveClient(): Database {
  if (globalForDb.db && globalForDb.dbSchemaKey === schemaKey) return globalForDb.db;
  if (globalForDb.db) void globalForDb.db.$disconnect();
  return createPrismaClient(env.DATABASE_URL);
}

export const db = resolveClient();

if (env.NODE_ENV !== "production") {
  globalForDb.db = db;
  globalForDb.dbSchemaKey = schemaKey;
}
