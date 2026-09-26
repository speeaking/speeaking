import { z } from "zod";

export const COMMERCE_FEES_KEY = "commerce.fees";

/**
 * Comisiones. Durante el piloto la comisión de plataforma es 0 % (docs/mvp-0.1.md → Cómo
 * cobramos). Cambiarla es una decisión de riesgo ALTO: el motor de automejora solo puede
 * proponerla; la aprueba una persona (ADR-019).
 */
export const commerceFeesSchema = z.object({
  version: z.literal(1),
  platformFeeBps: z.int().min(0).max(2_000),
  /** Estimación de la comisión del procesador, para calcular el beneficio del vendedor. */
  estimatedPaymentFeeBps: z.int().min(0).max(1_000),
});

export type CommerceFees = z.infer<typeof commerceFeesSchema>;

export const DEFAULT_COMMERCE_FEES: CommerceFees = {
  version: 1,
  platformFeeBps: 0,
  estimatedPaymentFeeBps: 350,
};

/** Minutos que se reserva el stock mientras se completa el pago. */
export const CHECKOUT_TTL_MINUTES = 30;

/**
 * Checkouts sin pagar que una persona puede tener a la vez (SEC-05): uno más permite corregir y
 * reintentar sin que una sola cuenta aparte el inventario de un vendedor.
 */
export const MAX_PENDING_CHECKOUTS_PER_BUYER = 2;
