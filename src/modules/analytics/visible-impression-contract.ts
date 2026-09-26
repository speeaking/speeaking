import { z } from "zod";

/**
 * Contrato de `POST /api/impressions` (T5, ADR-037): lo que manda el navegador cuando una pieza del
 * feed estuvo al menos a la mitad en pantalla durante 1 segundo continuo. Solo ids y la posición: el
 * servidor decide si cuenta (que se haya servido a esa persona) y de dónde salen la versión del
 * algoritmo, el espacio comercial y la variante (nunca del navegador).
 */

export const VISIBLE_IMPRESSION_SURFACES = ["FEED", "COMMUNITY"] as const;
export type VisibleImpressionSurface = (typeof VISIBLE_IMPRESSION_SURFACES)[number];

/** Piezas por petición: el navegador junta lo visto cada 5 s (una página trae 10). */
export const MAX_VISIBLE_IMPRESSIONS_PER_REQUEST = 50;
/** Tope de la posición en el feed (el scroll infinito rara vez pasa de unas decenas). */
export const MAX_FEED_POSITION = 9_999;
/** Cuerpo máximo en bytes (50 piezas caben en ~5 KB). */
export const MAX_VISIBLE_IMPRESSIONS_BODY_BYTES = 16 * 1024;

export const visibleImpressionSchema = z.strictObject({
  postId: z.uuid(),
  surface: z.enum(VISIBLE_IMPRESSION_SURFACES),
  position: z.int().min(0).max(MAX_FEED_POSITION),
});

export const visibleImpressionsRequestSchema = z.strictObject({
  items: z.array(visibleImpressionSchema).min(1).max(MAX_VISIBLE_IMPRESSIONS_PER_REQUEST),
});

export type VisibleImpressionReport = z.infer<typeof visibleImpressionSchema>;

/**
 * Qué pasó con cada pieza: se guardó, ya contaba hoy, no se aceptó (no servida, del dueño…) o no se
 * pudo guardar (la base falló; queda en el log del servidor).
 */
export type VisibleImpressionOutcome = {
  recorded: number;
  duplicates: number;
  rejected: number;
  failed: number;
};
