/** Reglas de la búsqueda por foto (ADR-061) que comparten el navegador y el servidor. */

/** Lado máximo con que el navegador manda la foto (el servidor la vuelve a reducir a 768 px). */
export const PHOTO_SEND_DIMENSION = 1024;

/** Lo más que se acepta; el navegador lo revisa antes de mandarla (Next acepta hasta 1 MB). */
export const MAX_PHOTO_BYTES = 900 * 1024;
