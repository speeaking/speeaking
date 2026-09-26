/**
 * Borra los datos que crean las pruebas E2E (cuentas `e2e.*@example.com`) de la base de desarrollo,
 * para que el feed vuelva a mostrar solo contenido semilla y el tuyo. Uso: `pnpm db:clean-e2e`.
 */
import "dotenv/config";
import { createPrismaClient } from "../src/server/db-client";
import { LocalStorageProvider } from "../src/server/providers/storage/local-storage";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Falta DATABASE_URL.");
if (process.env.NODE_ENV === "production") throw new Error("No se ejecuta en producción.");

const db = createPrismaClient(databaseUrl);
const storage = new LocalStorageProvider(process.env.STORAGE_LOCAL_ROOT ?? ".data/uploads");

async function main() {
  const users = await db.user.findMany({
    where: { email: { startsWith: "e2e.", endsWith: "@example.com" } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) {
    console.warn("✓ No hay datos de pruebas E2E.");
    return;
  }

  // Pedidos primero (los productos no se pueden borrar mientras tengan órdenes).
  const checkouts = await db.checkout.deleteMany({ where: { buyerId: { in: userIds } } });
  await db.order.deleteMany({ where: { seller: { userId: { in: userIds } } } });

  // Archivos subidos por esas cuentas.
  const media = await db.media.findMany({
    where: { ownerId: { in: userIds } },
    select: { storageKey: true },
  });
  for (const { storageKey } of media) await storage.delete(storageKey);

  const events = await db.analyticsEvent.deleteMany({ where: { userId: { in: userIds } } });
  const deleted = await db.user.deleteMany({ where: { id: { in: userIds } } });

  // Los contadores de miembros se recalculan desde las membresías reales.
  const communities = await db.community.findMany({
    select: { id: true, _count: { select: { memberships: true } } },
  });
  for (const community of communities) {
    await db.community.update({
      where: { id: community.id },
      data: { memberCount: community._count.memberships },
    });
  }

  // Los "me gusta", comentarios y guardados de esas cuentas se borraron en cascada, pero los
  // contadores de publicaciones y productos no: se reconcilian con los conteos reales (solo las
  // filas que difieren). Los comentarios cuentan solo si están publicados.
  const posts = await db.$executeRaw`
    UPDATE "posts" AS p
    SET "likeCount" = COALESCE(l.n, 0),
        "commentCount" = COALESCE(c.n, 0),
        "saveCount" = COALESCE(s.n, 0)
    FROM "posts" AS base
    LEFT JOIN (SELECT "postId", COUNT(*)::int AS n FROM "likes" GROUP BY "postId") AS l
      ON l."postId" = base."id"
    LEFT JOIN (
      SELECT "postId", COUNT(*)::int AS n FROM "comments"
      WHERE "status" = 'PUBLISHED' GROUP BY "postId"
    ) AS c ON c."postId" = base."id"
    LEFT JOIN (
      SELECT "postId", COUNT(*)::int AS n FROM "saved_items"
      WHERE "postId" IS NOT NULL GROUP BY "postId"
    ) AS s ON s."postId" = base."id"
    WHERE p."id" = base."id"
      AND (p."likeCount", p."commentCount", p."saveCount")
        IS DISTINCT FROM (COALESCE(l.n, 0), COALESCE(c.n, 0), COALESCE(s.n, 0))`;
  const products = await db.$executeRaw`
    UPDATE "products" AS p
    SET "saveCount" = COALESCE(s.n, 0)
    FROM "products" AS base
    LEFT JOIN (
      SELECT "productId", COUNT(*)::int AS n FROM "saved_items"
      WHERE "productId" IS NOT NULL GROUP BY "productId"
    ) AS s ON s."productId" = base."id"
    WHERE p."id" = base."id" AND p."saveCount" <> COALESCE(s.n, 0)`;

  console.warn(
    `✓ Eliminadas ${deleted.count} cuentas de prueba, ${checkouts.count} compras, ${media.length} archivos y ${events.count} eventos.`,
  );
  console.warn(`✓ Contadores corregidos en ${posts} publicaciones y ${products} productos.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
