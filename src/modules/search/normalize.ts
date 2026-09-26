/**
 * Normalización de búsquedas: sin mayúsculas ni acentos, para que «cafe» encuentre «Café» y
 * «pinata» encuentre «Piñata». La MISMA tabla se usa en JavaScript (para el texto buscado) y en
 * PostgreSQL con `translate()` (para las columnas), así que ambos lados se pliegan igual sin
 * extensiones como `unaccent`.
 */

/** Largo máximo de lo que se busca (igual que en Comprar). */
export const SEARCH_MAX_LENGTH = 80;
/** Palabras que se consideran como máximo; el resto se ignora. */
export const SEARCH_MAX_TERMS = 5;

/**
 * Letras acentuadas y su versión simple, posición por posición. Incluye mayúsculas porque
 * `lower()` de PostgreSQL no las convierte con un `LC_CTYPE` "C".
 */
export const FOLD_FROM = "áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ";
export const FOLD_TO = "aaaaaaeeeeiiiiooooouuuuncaaaaaaeeeeiiiiooooouuuunc";

const FOLD_MAP = new Map([...FOLD_FROM].map((char, index) => [char, FOLD_TO[index]!]));

/** Minúsculas y sin acentos, con la misma tabla que usa la base de datos. */
export function foldText(text: string) {
  let folded = "";
  for (const char of text.normalize("NFC").toLowerCase()) folded += FOLD_MAP.get(char) ?? char;
  return folded;
}

/** Signos al inicio o al final de una palabra («¿tenis?» → «tenis»). */
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

export type SearchQuery = {
  /** Lo que escribió la persona, limpio (para mostrarlo y registrarlo). */
  text: string;
  /** Palabras normalizadas; todas deben aparecer en el resultado. */
  terms: string[];
};

/**
 * Convierte el `q` de la URL en una búsqueda. `null` si no hay nada que buscar (vacío, solo
 * espacios o solo signos).
 */
export function parseSearchQuery(raw: unknown): SearchQuery | null {
  if (typeof raw !== "string") return null;
  const text = raw.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH).trim();
  if (!text) return null;

  const words = foldText(text)
    .split(" ")
    .map((word) => word.replace(EDGE_PUNCTUATION, ""))
    .filter((word) => word.length > 0);
  // Una letra suelta («y», «a») casi siempre coincide: solo cuenta si es lo único que se buscó.
  const meaningful = words.some((word) => word.length > 1)
    ? words.filter((word) => word.length > 1)
    : words;
  const terms = [...new Set(meaningful)].slice(0, SEARCH_MAX_TERMS);
  return terms.length > 0 ? { text, terms } : null;
}

/**
 * Patrón de LIKE para una palabra: la busca en cualquier parte. Escapa los comodines del usuario
 * (`%`, `_`) y la barra invertida, que es el carácter de escape por omisión de PostgreSQL.
 */
export function likePattern(term: string) {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
