import { afterAll, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { createPrismaClient } from "@/server/db-client";
import { parseSearchQuery } from "./normalize";
import { communitySearchSql, postSearchSql, productSearchSql } from "./sql";

/**
 * SEC-32 contra la base de desarrollo (`pnpm db:start`): el planificador de PostgreSQL usa los
 * índices de trigramas con las consultas REALES (mismos builders y parámetros que la app). Con las
 * pocas filas del seed un recorrido secuencial siempre gana, así que se agregan copias (~5 mil
 * publicaciones y ~7 mil productos) dentro de una transacción que se revierte al final: la base
 * queda igual.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

const ROLLBACK = new Error("rollback");

describe.skipIf(!databaseUrl)("búsqueda con índices de trigramas (PostgreSQL)", () => {
  const db = createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base");

  afterAll(() => db.$disconnect());

  it("productos y publicaciones usan su índice GIN; las palabras cortas no lo impiden", async () => {
    const plans: Record<string, string> = {};
    try {
      await db.$transaction(
        async (tx) => {
          // Solo se copian filas de cuentas del seed: las `e2e.*` las borran otras pruebas en
          // paralelo, y copiar una fila de una cuenta que se está borrando falla por llave foránea.
          await tx.$executeRaw`
            INSERT INTO "posts" ("id", "authorId", "body", "status", "publishedAt", "createdAt", "updatedAt")
            SELECT gen_random_uuid(), p."authorId", p."body" || ' copia ' || g, p."status",
              now() - random() * interval '30 days', now(), now()
            FROM "posts" p JOIN "users" u ON u."id" = p."authorId", generate_series(1, 100) AS g
            WHERE u."email" NOT LIKE 'e2e.%'`;
          await tx.$executeRaw`
            INSERT INTO "products" ("id", "sellerId", "slug", "title", "description", "priceCents",
              "stock", "status", "categoryId", "tags", "city", "state", "updatedAt")
            SELECT gen_random_uuid(), p."sellerId", p."slug" || '-copia-' || g, p."title",
              p."description", p."priceCents", p."stock", p."status", p."categoryId", p."tags",
              p."city", p."state", now()
            FROM "products" p
              JOIN "seller_profiles" s ON s."id" = p."sellerId"
              JOIN "users" u ON u."id" = s."userId",
              generate_series(1, 800) AS g
            WHERE u."email" NOT LIKE 'e2e.%'`;
          // Lo recién insertado queda en la lista pendiente del GIN; en producción la vacía el autovacuum.
          for (const index of ["posts_search_trgm_idx", "products_search_trgm_idx"]) {
            await tx.$queryRawUnsafe(`SELECT gin_clean_pending_list('${index}'::regclass)`);
          }
          await tx.$executeRawUnsafe(`ANALYZE "posts"`);
          await tx.$executeRawUnsafe(`ANALYZE "products"`);

          const terms = parseSearchQuery("audífonos inalámbricos de xl")!.terms;
          // Sin trigramas (palabras cortas o letras no ASCII): antes recorrían la tabla completa.
          const unindexed = parseSearchQuery("жжж tv")!.terms;
          for (const [name, sql] of [
            ["products", productSearchSql(terms)],
            ["posts", postSearchSql(terms)],
            ["productsUnindexed", productSearchSql(unindexed)],
            ["postsUnindexed", postSearchSql(unindexed)],
          ] as const) {
            const rows = await tx.$queryRaw<{ "QUERY PLAN": string }[]>(Prisma.sql`EXPLAIN ${sql}`);
            plans[name] = rows.map((row) => row["QUERY PLAN"]).join("\n");
          }
          // Comunidades son una docena: basta con probar que la expresión coincide con el índice.
          await tx.$executeRawUnsafe(`SET LOCAL enable_seqscan = off`);
          const rows = await tx.$queryRaw<{ "QUERY PLAN": string }[]>(
            Prisma.sql`EXPLAIN ${communitySearchSql(terms)}`,
          );
          plans.communities = rows.map((row) => row["QUERY PLAN"]).join("\n");
          throw ROLLBACK;
        },
        { timeout: 60_000 },
      );
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }

    // El plan completo va en el mensaje: si falla, se ve qué eligió PostgreSQL.
    expect(plans.products, plans.products).toContain("Index Scan on products_search_trgm_idx");
    expect(plans.posts, plans.posts).toContain("Index Scan on posts_search_trgm_idx");
    expect(plans.communities, plans.communities).toContain(
      "Index Scan on communities_search_trgm_idx",
    );
    // Sin palabras indexables: el LIKE (lo caro) solo corre sobre la ventana de filas recientes, que
    // la tabla entrega sin evaluarlo; nunca sobre la tabla ni el índice de trigramas completos.
    for (const plan of [plans.productsUnindexed!, plans.postsUnindexed!]) {
      const window = plan.slice(plan.lastIndexOf("->  Limit"));
      expect(plan, plan).toContain("Subquery Scan on p");
      expect(window, plan).toMatch(/on (products|posts) r/);
      expect(window, plan).not.toContain("~~");
      expect(plan, plan).not.toContain("_search_trgm_idx");
    }
  }, 60_000);
});
