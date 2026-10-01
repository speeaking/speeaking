/**
 * Cuándo se ofrece «Contexto» (ADR-060). Módulo mínimo, sin el prompt ni el esquema, para que la
 * tarjeta (en el navegador) lo use sin cargar la tarea de IA.
 */

/** Desde este largo se ofrece «Contexto» (unas 90 palabras): lo corto se lee solo. */
export const CONTEXT_MIN_CHARS = 500;

export function canHaveContext(body: string): boolean {
  return body.trim().length >= CONTEXT_MIN_CHARS;
}
