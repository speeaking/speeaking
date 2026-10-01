/**
 * Borra los datos que crean las pruebas E2E (cuentas `e2e.*@example.com`) de la base de desarrollo,
 * para que el feed vuelva a mostrar solo contenido semilla y el tuyo. Uso: `pnpm db:clean-e2e`.
 */
import "dotenv/config";
import { parseEnv } from "../src/lib/env/parse-env";
import { createPrismaClient } from "../src/server/db-client";
import { serverEnvSchema } from "../src/server/env-schema";
import { createStorage } from "../src/server/providers/storage/factory";

const env = parseEnv(serverEnvSchema, process.env);
if (env.NODE_ENV === "production") throw new Error("No se ejecuta en producción.");

const db = createPrismaClient(env.DATABASE_URL);
const storage = createStorage(env);

/**
 * Rastro de moderación que apunta a contenido de prueba ya borrado: reportes, decisiones del equipo
 * y propuestas de prueba («E2E …»), más las métricas diarias derivadas. Así /admin empieza limpio.
 */
async function cleanOrphanTrail() {
  const reports = await db.$executeRaw`
    DELETE FROM reports r WHERE
      (r."targetType" = 'PRODUCT' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = r."targetId"))
      OR (r."targetType" = 'POST' AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.id = r."targetId"))
      OR (r."targetType" = 'COMMENT' AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.id = r."targetId"))
      OR (r."targetType" = 'USER' AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r."targetId"))`;
  const decisions = await db.$executeRaw`
    DELETE FROM platform_decisions d WHERE d.title LIKE 'E2E %'
      OR (d.kind LIKE 'authenticity.%'
        AND (d."newValue"->>'productId') IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id::text = d."newValue"->>'productId'))
      OR ((d.kind LIKE 'moderation.%' OR d.kind LIKE 'authenticity.%')
        AND (d."newValue"->>'targetId') IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id::text = d."newValue"->>'targetId')
        AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.id::text = d."newValue"->>'targetId')
        AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.id::text = d."newValue"->>'targetId')
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id::text = d."newValue"->>'targetId'))`;
  // Las métricas diarias son derivadas: con los eventos de prueba borrados quedarían infladas. La
  // siguiente `pnpm ops:daily` las vuelve a calcular.
  const metrics = await db.dailyMetric.deleteMany({});
  // Borradores de la redacción que crean las pruebas («E2E …», ADR-066) y lo que se publicó con
  // ellos: lo publica la cuenta editorial de la comunidad, que no es una cuenta de prueba.
  const editorial = await db.$executeRaw`
    WITH gone AS (DELETE FROM editorial_drafts WHERE body LIKE 'E2E %' RETURNING "postId")
    DELETE FROM posts WHERE id IN (SELECT "postId" FROM gone WHERE "postId" IS NOT NULL)`;

  return { reports, decisions, metrics: metrics.count, editorial };
}

async function main() {
  const users = await db.user.findMany({
    where: { email: { startsWith: "e2e.", endsWith: "@example.com" } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) {
    const trail = await cleanOrphanTrail();
    console.warn(
      `✓ No hay cuentas de prueba; rastro limpio: ${trail.reports} reportes, ${trail.decisions} decisiones y ${trail.editorial} publicaciones de la redacción.`,
    );
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
  // Cambios de modelo que las pruebas aprobaron desde /admin/ia (antes de borrar a quien los aprobó).
  const routing = await db.platformDecision.deleteMany({
    where: { kind: "ai.routing", approvedById: { in: userIds } },
  });
  const deleted = await db.user.deleteMany({ where: { id: { in: userIds } } });

  const trail = await cleanOrphanTrail();

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
  console.warn(
    `✓ Rastro de prueba: ${trail.reports} reportes, ${trail.decisions + routing.count} decisiones, ${trail.metrics} métricas diarias y ${trail.editorial} publicaciones de la redacción.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
