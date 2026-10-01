import type { ModerationStatus, ProductStatus, SellerStatus } from "@/generated/prisma/enums";

/**
 * Reglas de las colaboraciones con creadores (ADR-063). Código puro (P2): quién puede etiquetar qué
 * producto en una publicación y cuándo una publicación es contenido de un tercero sobre una tienda.
 *
 * - Cada quien etiqueta sus propios productos, como siempre.
 * - El producto de OTRA tienda solo se etiqueta si esa tienda aceptó colaboraciones, está activa y
 *   el producto está a la venta y visible. La tienda puede quitar la etiqueta cuando quiera.
 */

export type TaggableProduct = {
  status: ProductStatus;
  moderationStatus: ModerationStatus;
  seller: { userId: string; status: SellerStatus; acceptsCollaborations: boolean };
};

export type TagDecision =
  | { ok: true; kind: "own" | "collaboration" }
  | { ok: false; reason: "hidden" | "not_accepting" | "unavailable" };

/** ¿Puede `viewerUserId` etiquetar este producto en una publicación suya? */
export function tagDecision(viewerUserId: string, product: TaggableProduct): TagDecision {
  if (product.seller.userId === viewerUserId) {
    // Lo propio se etiqueta siempre, salvo lo que el equipo ocultó (P14).
    return product.moderationStatus === "HIDDEN"
      ? { ok: false, reason: "hidden" }
      : { ok: true, kind: "own" };
  }
  if (!product.seller.acceptsCollaborations) return { ok: false, reason: "not_accepting" };
  // De una tienda ajena: solo lo que cualquiera puede comprar hoy. No se dice si está oculto.
  if (
    product.seller.status !== "ACTIVE" ||
    product.status !== "ACTIVE" ||
    product.moderationStatus !== "VISIBLE"
  ) {
    return { ok: false, reason: "unavailable" };
  }
  return { ok: true, kind: "collaboration" };
}

export const TAG_ERRORS: Record<Extract<TagDecision, { ok: false }>["reason"], string> = {
  hidden:
    "Ese producto está oculto por moderación y no se puede publicar. Revisa su estado en Studio → Productos.",
  not_accepting: "Esa tienda no acepta colaboraciones.",
  unavailable: "Ese producto ya no está disponible para etiquetarse.",
};

/** Lo que se le pide declarar a quien etiqueta el producto de otra tienda. */
export const COLLABORATION_DISCLOSURE =
  "Recibí algo de esta tienda por publicarlo (pago, producto o comisión)";

/** Por qué se pide: la publicidad debe poder identificarse (Ley Federal de Protección al Consumidor). */
export const COLLABORATION_HINT =
  "Si es así, tu publicación llevará la etiqueta «Colaboración». La ley pide que la publicidad se identifique.";

/** Etiqueta de la tarjeta y su explicación para lectores de pantalla. */
export const COLLABORATION_LABEL = "Colaboración";

export function collaborationExplanation(storeName: string) {
  return `Publicación con un acuerdo comercial con ${storeName}`;
}
