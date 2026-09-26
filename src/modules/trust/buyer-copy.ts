import { siteConfig } from "@/config/site";

/**
 * Textos de autenticidad que ve quien compra (P14), en un solo lugar: la etiqueta junto al precio y
 * el detalle de «Autenticidad» (`status.ts` → `buyerAuthenticityView`) y la respuesta de «¿Es
 * original?» (`catalog/quick-answers.ts`) dicen lo mismo. Sin dependencias pesadas: lo importa un
 * componente de cliente. Nunca acusa ni certifica.
 */

/** Qué se le dice a quien compra sobre la declaración del vendedor. */
export type BuyerAuthenticityClaim = "declared" | "unverified" | "reviewed";

export const UNVERIFIED_LABEL = "Autenticidad sin verificar";
export const REVIEWED_LABEL = `Comprobante revisado por ${siteConfig.name}`;

export const UNVERIFIED_DETAIL =
  "Aún no hemos revisado un comprobante de compra de este producto. Antes de pagar, pide al vendedor el ticket o la factura.";
export const REVIEWED_DETAIL = `El vendedor declara que es original y el equipo de ${siteConfig.name} revisó su comprobante de compra. No es una certificación ni una garantía de autenticidad.`;
