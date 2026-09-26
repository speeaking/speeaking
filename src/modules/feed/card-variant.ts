/**
 * Variantes con las que se pinta cada pieza del feed (F3 del rediseño «Revista»). Es solo
 * presentación: el feed sigue siendo una lista plana y no cambian el ranking ni las posiciones de
 * impresión. Funciones puras para poder probarlas sin navegador.
 */
import type { FeedItemDTO } from "./dto";

export type CardVariant = "cover" | "bigType" | "standard";

/** Texto corto que se pinta en grande sobre el color de su comunidad. */
export const BIG_TYPE_MAX_CHARS = 160;
/** La primera oración sirve de titular si mide esto o menos. */
export const HEADLINE_MAX_CHARS = 90;
/**
 * Ancho mínimo (px) de la primera foto para ser portada: se pinta a media tarjeta en escritorio y a
 * todo el ancho en móvil; una foto más chica se vería borrosa en el lugar más visible del feed.
 */
export const COVER_MIN_WIDTH = 600;

type VariantInput = Pick<FeedItemDTO, "body" | "media" | "product" | "community">;

/** Caracteres visibles aproximados (un emoji cuenta como uno, no como dos). */
function visibleLength(text: string) {
  return [...text].length;
}

/**
 * ¿Puede ser portada? Contenido con una foto de buen tamaño y comunidad (la portada lleva el
 * separador «Hoy en {comunidad}»). El comercio nunca es portada: se dosifica, no se destaca.
 */
export function isCoverCandidate(item: VariantInput): boolean {
  const first = item.media[0];
  return (
    first !== undefined &&
    first.width >= COVER_MIN_WIDTH &&
    item.product === null &&
    item.community !== null
  );
}

/** Posición de la portada: la primera pieza de la lista que puede serlo, o -1. */
export function findCoverIndex(items: readonly VariantInput[]): number {
  return items.findIndex(isCoverCandidate);
}

/**
 * Variante de la pieza en `index`. `coverIndex` sale de `findCoverIndex(lista)`: la portada es la
 * primera pieza con fotos de la lista, así que no cambia al cargar más páginas.
 */
export function pickCardVariant(
  item: VariantInput,
  index: number,
  coverIndex: number,
): CardVariant {
  if (index === coverIndex && isCoverCandidate(item)) return "cover";
  const text = item.body.trim();
  if (
    item.media.length === 0 &&
    item.product === null &&
    item.community !== null &&
    text.length > 0 &&
    visibleLength(text) <= BIG_TYPE_MAX_CHARS
  ) {
    return "bigType";
  }
  return "standard";
}

/** Variantes de toda la lista, en orden. */
export function pickCardVariants(items: readonly VariantInput[]): CardVariant[] {
  const coverIndex = findCoverIndex(items);
  return items.map((item, index) => pickCardVariant(item, index, coverIndex));
}

/**
 * Primera oración: termina en . ! ? o … (con comillas o paréntesis de cierre) seguidos de un
 * espacio o del final. "$1.5" o "vendeia.mx" no la cortan porque no llevan espacio después.
 */
const FIRST_SENTENCE = /^[\s\S]*?[.!?…]+["'”’»)]*(?=\s|$)/;

/**
 * Titular para la portada: la primera oración si mide `HEADLINE_MAX_CHARS` o menos (spec F3). Se
 * quita del cuerpo para no repetirla; si el texto es una sola oración corta, todo es titular (una
 * portada sin titular deja el texto chico junto a una foto grande). Un salto de línea también
 * cierra la oración.
 */
export function extractHeadline(body: string): { headline: string | null; rest: string } {
  const text = body.trim();
  const firstLine = text.split("\n", 1)[0]!.trim();
  const sentence = (FIRST_SENTENCE.exec(firstLine)?.[0] ?? firstLine).trim();
  const rest = text.slice(text.indexOf(sentence) + sentence.length).trim();
  const hasWords = (sentence.match(/\p{L}/gu)?.length ?? 0) >= 3;
  if (!hasWords || visibleLength(sentence) > HEADLINE_MAX_CHARS) {
    return { headline: null, rest: text };
  }
  return { headline: sentence, rest };
}

/** Hasta aquí el titular de la portada va en grande (36 px en escritorio). */
export const HEADLINE_LARGE_MAX_CHARS = 40;
/** Hasta aquí, mediano (26 px); más largo, chico (21 px). */
export const HEADLINE_MEDIUM_MAX_CHARS = 60;

export type HeadlineSize = "lg" | "md" | "sm";

/**
 * Tamaño del titular de la portada según su largo, para que nunca pase de 3 líneas en la columna
 * de texto (330 px a 1352 px de ancho; medido con la fuente real: 91 caracteres a 21 px = 3 líneas).
 */
export function headlineSize(headline: string): HeadlineSize {
  const length = visibleLength(headline);
  if (length <= HEADLINE_LARGE_MAX_CHARS) return "lg";
  if (length <= HEADLINE_MEDIUM_MAX_CHARS) return "md";
  return "sm";
}
