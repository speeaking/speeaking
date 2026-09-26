import { Prisma } from "@/generated/prisma/client";
import { FOLD_FROM, FOLD_TO, likePattern } from "./normalize";

/**
 * Consultas de búsqueda como SQL parametrizado. Lo que escribe la persona SOLO viaja en
 * `values` (parámetros $n), nunca dentro del texto SQL: los nombres de tablas y columnas son
 * constantes de este archivo. Las pruebas lo verifican.
 */

/** Límites por sección de resultados. */
export const SEARCH_LIMITS = { communities: 6, products: 6, posts: 10 } as const;

/** Columna (o expresión fija) en minúsculas y sin acentos, con la tabla de `normalize.ts`. */
function folded(expression: Prisma.Sql) {
  return Prisma.sql`translate(lower(${expression}), ${FOLD_FROM}, ${FOLD_TO})`;
}

/** Todas las palabras aparecen en el documento (en cualquier orden y posición). */
function matchesAll(document: Prisma.Sql, terms: string[]) {
  if (terms.length === 0) throw new Error("Una búsqueda necesita al menos una palabra.");
  return Prisma.join(
    terms.map((term) => Prisma.sql`${document} LIKE ${likePattern(term)}`),
    " AND ",
  );
}

/** Comunidades por nombre o descripción; primero las que coinciden en el nombre. */
export function communitySearchSql(terms: string[], limit: number = SEARCH_LIMITS.communities) {
  const name = folded(Prisma.sql`c."name"`);
  const document = folded(Prisma.sql`c."name" || ' ' || c."description"`);
  return Prisma.sql`
    SELECT c."id" FROM "communities" c
    WHERE ${matchesAll(document, terms)}
    ORDER BY (${matchesAll(name, terms)}) DESC, c."sortOrder" ASC
    LIMIT ${limit}`;
}

/** Solo productos de una categoría o de sus subcategorías (el slug también viaja como parámetro). */
function inCategory(categorySlug: string) {
  return Prisma.sql`
    AND p."categoryId" IN (
      SELECT c."id" FROM "categories" c
      LEFT JOIN "categories" parent ON parent."id" = c."parentId"
      WHERE c."slug" = ${categorySlug} OR parent."slug" = ${categorySlug}
    )`;
}

/**
 * Productos ACTIVOS con existencias, por título o etiquetas; primero los que coinciden en el título.
 * La usan la búsqueda global (/buscar) y Comprar (/comprar, con categoría opcional), así que ambas
 * encuentran lo mismo con la misma palabra.
 */
export function productSearchSql(
  terms: string[],
  limit: number = SEARCH_LIMITS.products,
  { categorySlug }: { categorySlug?: string } = {},
) {
  const title = folded(Prisma.sql`p."title"`);
  const document = folded(Prisma.sql`p."title" || ' ' || array_to_string(p."tags", ' ')`);
  return Prisma.sql`
    SELECT p."id" FROM "products" p
    WHERE p."status" = 'ACTIVE' AND p."stock" > 0 AND ${matchesAll(document, terms)}
    ${categorySlug ? inCategory(categorySlug) : Prisma.empty}
    ORDER BY (${matchesAll(title, terms)}) DESC, p."publishedAt" DESC NULLS LAST, p."id" DESC
    LIMIT ${limit}`;
}

/** Publicaciones visibles por su texto, las más recientes primero. */
export function postSearchSql(terms: string[], limit: number = SEARCH_LIMITS.posts) {
  const body = folded(Prisma.sql`p."body"`);
  return Prisma.sql`
    SELECT p."id" FROM "posts" p
    WHERE p."status" = 'PUBLISHED' AND ${matchesAll(body, terms)}
    ORDER BY p."publishedAt" DESC, p."id" DESC
    LIMIT ${limit}`;
}
