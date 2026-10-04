import { Prisma } from "@/generated/prisma/client";
import { FOLD_FROM, FOLD_TO, likePattern } from "./normalize";
import { postVisibleToSql } from "@/modules/relationships/privacy";

/**
 * Consultas de búsqueda como SQL parametrizado. Lo que escribe la persona SOLO viaja en
 * `values` (parámetros $n), nunca dentro del texto SQL: los nombres de tablas y columnas son
 * constantes de este archivo. Las pruebas lo verifican.
 *
 * Índices (SEC-32): cada documento plegado tiene un índice GIN de trigramas sobre la MISMA
 * expresión (migración `20260926110000_search_trigram_indexes`), que `LIKE '%palabra%'` usa con
 * palabras de 3+ letras. Por eso la tabla de plegado va como literal en el SQL y no como parámetro:
 * un plan genérico con `$n` no coincidiría con la expresión del índice. Si cambias una expresión o la
 * tabla, cambia también el índice (`sql.test.ts` compara ambos). Una búsqueda sin ninguna palabra
 * indexable solo revisa las `UNINDEXED_SEARCH_WINDOW` filas más recientes.
 */

/** Límites por sección de resultados. */
export const SEARCH_LIMITS = { people: 6, communities: 6, products: 6, posts: 10 } as const;
export const SEARCH_CATEGORY_PAGE_SIZE = 20;

/** Literal de SQL para una constante de este código (nunca para lo que escribe la persona). */
function constantLiteral(value: string) {
  return Prisma.raw(`'${value.replaceAll("'", "''")}'`);
}

/** Columna (o expresión fija) en minúsculas y sin acentos, con la tabla de `normalize.ts`. */
function folded(expression: Prisma.Sql) {
  return Prisma.sql`translate(lower(${expression}), ${constantLiteral(FOLD_FROM)}, ${constantLiteral(FOLD_TO)})`;
}

/** Una palabra más corta no tiene trigramas: con ella el índice tendría que recorrerse completo. */
export const MIN_INDEXED_TERM_LENGTH = 3;
/**
 * `pg_trgm` solo arma trigramas con letras y dígitos ASCII (la base usa `LC_CTYPE` "C"; el plegado ya
 * convirtió «ñ» y los acentos). «жжж» o «ßßß» miden 3 pero no tienen trigramas: el índice se
 * recorría completo y la consulta tardaba lo mismo que sin índice.
 */
const INDEXABLE_TERM = new RegExp(`[a-z0-9]{${MIN_INDEXED_TERM_LENGTH}}`);
/**
 * Filas más recientes que revisa una búsqueda sin ninguna palabra indexable («tv», «xl de»): sin
 * trigramas, el costo crecía con la tabla (~0.7 s con 20 mil publicaciones y 37 mil productos, sin
 * sesión ni límite). Con la ventana queda acotado sin importar el volumen; a cambio, esas búsquedas
 * solo encuentran lo reciente.
 */
export const UNINDEXED_SEARCH_WINDOW = 2000;

/** La palabra tiene al menos un trigrama que el índice puede usar. */
export function isIndexableTerm(term: string) {
  return INDEXABLE_TERM.test(term);
}

/**
 * Todas las palabras aparecen en el documento (en cualquier orden y posición). Las que no tienen
 * trigramas («de», «xl», «жжж») se comparan contra `(documento || '')`, una expresión que el índice
 * no cubre: así se filtran sobre las filas que el índice ya encontró con las demás, en lugar de hacer
 * que PostgreSQL recorra el índice o la tabla completos.
 */
function matchesAll(document: Prisma.Sql, terms: string[]) {
  if (terms.length === 0) throw new Error("Una búsqueda necesita al menos una palabra.");
  return Prisma.join(
    terms.map((term) => {
      const target = isIndexableTerm(term) ? document : Prisma.sql`(${document} || '')`;
      return Prisma.sql`${target} LIKE ${likePattern(term)}`;
    }),
    " AND ",
  );
}

/** Comunidades por nombre o descripción; primero las que coinciden en el nombre. */
export function communitySearchSql(
  terms: string[],
  limit: number = SEARCH_LIMITS.communities,
  offset = 0,
) {
  const name = folded(Prisma.sql`c."name"`);
  const document = folded(Prisma.sql`c."name" || ' ' || c."description"`);
  return Prisma.sql`
    SELECT c."id" FROM "communities" c
    WHERE ${matchesAll(document, terms)}
    ORDER BY (${matchesAll(name, terms)}) DESC, c."sortOrder" ASC, c."id" ASC
    LIMIT ${limit}${offset > 0 ? Prisma.sql` OFFSET ${offset}` : Prisma.empty}`;
}

/** Nombres y usuarios públicos; incluye la propia cuenta y excluye bloqueos en ambos sentidos. */
export function personSearchSql(
  terms: string[],
  limit: number = SEARCH_LIMITS.people,
  viewerId: string | null = null,
  offset = 0,
) {
  const document = folded(Prisma.sql`p."displayName" || ' ' || p."username"`);
  const username = folded(Prisma.sql`p."username"`);
  const name = folded(Prisma.sql`p."displayName"`);
  const unblocked = (alias: "p" | "r") =>
    viewerId
      ? Prisma.sql`AND NOT EXISTS (
    SELECT 1 FROM "message_blocks" b
    WHERE (b."blockerId" = ${viewerId}::uuid AND b."blockedId" = ${Prisma.raw(alias)}."userId")
      OR (b."blockedId" = ${viewerId}::uuid AND b."blockerId" = ${Prisma.raw(alias)}."userId")
  )`
      : Prisma.empty;
  const people = terms.some(isIndexableTerm)
    ? Prisma.sql`"profiles" p`
    : Prisma.sql`(
    SELECT r."userId", r."username", r."displayName", r."onboardedAt", r."isEditorial"
    FROM "profiles" r WHERE r."onboardedAt" IS NOT NULL AND r."isEditorial" = false
      ${unblocked("r")}
    ORDER BY r."id" DESC LIMIT ${UNINDEXED_SEARCH_WINDOW}
  ) p`;
  return Prisma.sql`
    SELECT p."userId" AS id FROM ${people}
    WHERE p."onboardedAt" IS NOT NULL AND p."isEditorial" = false
      ${unblocked("p")} AND ${matchesAll(document, terms)}
    ORDER BY (${username} = ${terms.join(" ")}) DESC,
      (${name} = ${terms.join(" ")}) DESC, (${matchesAll(username, terms)}) DESC,
      ${name} ASC, p."userId" ASC
    LIMIT ${limit}${offset > 0 ? Prisma.sql` OFFSET ${offset}` : Prisma.empty}`;
}

/**
 * Solo productos de una categoría o de sus subcategorías (el slug también viaja como parámetro).
 * `alias` es una constante de este archivo.
 */
function inCategory(alias: "p" | "r", categorySlug: string) {
  return Prisma.sql`
    AND ${Prisma.raw(alias)}."categoryId" IN (
      SELECT c."id" FROM "categories" c
      LEFT JOIN "categories" parent ON parent."id" = c."parentId"
      WHERE c."slug" = ${categorySlug} OR parent."slug" = ${categorySlug}
    )`;
}

/**
 * Productos ACTIVOS con existencias y VISIBLES (nunca los ocultos por moderación), por título o
 * etiquetas; primero los que coinciden en el título. La usan la búsqueda global (/buscar) y Comprar
 * (/comprar, con categoría opcional), así que ambas encuentran lo mismo con la misma palabra. El
 * filtro va en el SQL (no solo al hidratar): un oculto no ocupa un lugar del `LIMIT`.
 */
export function productSearchSql(
  terms: string[],
  limit: number = SEARCH_LIMITS.products,
  { categorySlug, offset = 0 }: { categorySlug?: string; offset?: number } = {},
) {
  const title = folded(Prisma.sql`p."title"`);
  // `search_tags_text` = `array_to_string(tags, ' ')` marcada IMMUTABLE (se puede indexar).
  const document = folded(Prisma.sql`p."title" || ' ' || search_tags_text(p."tags")`);
  const category = (alias: "p" | "r") =>
    categorySlug ? inCategory(alias, categorySlug) : Prisma.empty;
  // Sin palabras indexables: solo los productos más recientes (el id UUIDv7 sigue el orden de alta y
  // la llave primaria se recorre al revés sin ordenar). El `LIMIT` de la subconsulta impide que
  // PostgreSQL la aplane y filtre la tabla completa.
  const products = terms.some(isIndexableTerm)
    ? Prisma.sql`"products" p`
    : Prisma.sql`(
        SELECT r."id", r."title", r."tags", r."status", r."stock", r."moderationStatus",
          r."categoryId", r."publishedAt"
        FROM "products" r
        WHERE r."status" = 'ACTIVE' AND r."stock" > 0 AND r."moderationStatus" = 'VISIBLE'
          ${category("r")}
        ORDER BY r."id" DESC
        LIMIT ${UNINDEXED_SEARCH_WINDOW}
      ) p`;
  return Prisma.sql`
    SELECT p."id" FROM ${products}
    WHERE p."status" = 'ACTIVE' AND p."stock" > 0 AND p."moderationStatus" = 'VISIBLE'
      AND ${matchesAll(document, terms)}
    ${terms.some(isIndexableTerm) ? category("p") : Prisma.empty}
    ORDER BY (${matchesAll(title, terms)}) DESC, p."publishedAt" DESC NULLS LAST, p."id" DESC
    LIMIT ${limit}${offset > 0 ? Prisma.sql` OFFSET ${offset}` : Prisma.empty}`;
}

/**
 * Publicaciones sin producto o cuyo producto no está oculto por moderación (el mismo criterio que
 * `POST_WITH_VISIBLE_PRODUCT` de `trust/visibility.ts`).
 */
const POST_WITH_VISIBLE_PRODUCT_SQL = Prisma.sql`(
      p."productId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "products" pr
        WHERE pr."id" = p."productId" AND pr."moderationStatus" = 'VISIBLE'
      )
    )`;

/**
 * Publicaciones visibles por su texto, las más recientes primero: publicadas y sin un producto oculto
 * por moderación (filtrado en el SQL para que no ocupen lugares del `LIMIT`).
 */
export function postSearchSql(
  terms: string[],
  limit: number = SEARCH_LIMITS.posts,
  viewerId: string | null = null,
  { videosOnly = false, offset = 0 }: { videosOnly?: boolean; offset?: number } = {},
) {
  const body = folded(Prisma.sql`p."body"`);
  const video = (alias: "p" | "r") =>
    videosOnly
      ? Prisma.sql`AND EXISTS (
    SELECT 1 FROM "post_media" link JOIN "media" m ON m."id" = link."mediaId"
    WHERE link."postId" = ${Prisma.raw(alias)}."id" AND m."kind" = 'VIDEO' AND m."status" = 'READY'
  )`
      : Prisma.empty;
  // Sin palabras indexables: solo las publicaciones más recientes (índice por fecha de publicación).
  const posts = terms.some(isIndexableTerm)
    ? Prisma.sql`"posts" p`
    : Prisma.sql`(
        SELECT r."id", r."body", r."status", r."productId", r."publishedAt", r."authorId" FROM "posts" r
        WHERE r."status" = 'PUBLISHED' AND ${postVisibleToSql(viewerId, "r")} ${video("r")}
        ORDER BY r."publishedAt" DESC, r."id" DESC
        LIMIT ${UNINDEXED_SEARCH_WINDOW}
      ) p`;
  return Prisma.sql`
    SELECT p."id" FROM ${posts}
    WHERE p."status" = 'PUBLISHED' AND ${POST_WITH_VISIBLE_PRODUCT_SQL}
      AND ${postVisibleToSql(viewerId)}
      ${video("p")}
      AND ${matchesAll(body, terms)}
    ORDER BY p."publishedAt" DESC, p."id" DESC
    LIMIT ${limit}${offset > 0 ? Prisma.sql` OFFSET ${offset}` : Prisma.empty}`;
}
