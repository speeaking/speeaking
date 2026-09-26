import { z } from "zod";

/** Clave del ajuste en `PlatformSetting` (ADR-008). */
export const FEED_POLICY_KEY = "feed.policy";

/**
 * Política de mezcla del feed. Los rangos son límites duros: ni una persona ni el motor de
 * automejora pueden guardar valores fuera de ellos (principio 3: comercio contextual, no catálogo).
 */
export const feedPolicySchema = z.object({
  version: z.literal(1),
  /** Como máximo 1 pieza comercial por cada N posiciones del feed. */
  commerceSlotEvery: z.int().min(3).max(12),
  /** Separación mínima entre dos piezas comerciales. */
  minGapBetweenCommerce: z.int().min(2).max(12),
  /** Ventana (en posiciones) en la que un mismo autor no puede repetirse. */
  authorWindow: z.int().min(2).max(10),
  /** Vida media de la recencia en horas: a esa edad una publicación vale la mitad. */
  recencyHalfLifeHours: z.number().min(6).max(168),
  /** Proporción de contenido de exploración (fuera de las comunidades del usuario). */
  explorationShare: z.number().min(0).max(0.5),
});

export type FeedPolicy = z.infer<typeof feedPolicySchema>;

/** ≈ 1 pieza comercial por cada 3–4 de contenido (decisión de producto 13). */
export const DEFAULT_FEED_POLICY: FeedPolicy = {
  version: 1,
  commerceSlotEvery: 4,
  minGapBetweenCommerce: 3,
  authorWindow: 4,
  recencyHalfLifeHours: 36,
  explorationShare: 0.2,
};
