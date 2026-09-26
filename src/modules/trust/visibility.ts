import type { Prisma } from "@/generated/prisma/client";

/**
 * Filtros de moderación para las consultas públicas (feed, búsqueda, Comprar, similares, perfiles).
 * Un producto oculto por el equipo (`moderationStatus = HIDDEN`) desaparece de todo lo público; su
 * vendedor lo sigue viendo en el Studio. Las publicaciones y comentarios ocultos ya se filtran con
 * `status: "PUBLISHED"`.
 *
 * Uso: se agrega a las reglas de estado de cada lista, sin reemplazarlas:
 *   `product: { status: "ACTIVE", stock: { gt: 0 }, ...VISIBLE_PRODUCT }`
 *   `where: { status: "PUBLISHED", AND: [POST_WITH_VISIBLE_PRODUCT] }`
 * En SQL: `p."moderationStatus" = 'VISIBLE'`.
 */
export const VISIBLE_PRODUCT = {
  moderationStatus: "VISIBLE",
} as const satisfies Prisma.ProductWhereInput;

/** Publicación sin producto, o cuyo producto no está oculto. */
export const POST_WITH_VISIBLE_PRODUCT: Prisma.PostWhereInput = {
  OR: [{ productId: null }, { product: VISIBLE_PRODUCT }],
};
