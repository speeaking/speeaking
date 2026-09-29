import { z } from "zod";
import { ReportReason } from "@/generated/prisma/enums";

/** Lo que se puede reportar desde la interfaz (el modelo también admite personas y comentarios). */
export const REPORTABLE_TARGETS = ["PRODUCT", "POST", "USER"] as const;
export type ReportableTarget = (typeof REPORTABLE_TARGETS)[number];

export const REPORT_DETAILS_MAX = 1000;

/** Texto libre opcional: vacío cuenta como ausente. Es dato no confiable (nunca instrucción). */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value ? value : undefined));

export const reportInputSchema = z.object({
  targetType: z.enum(REPORTABLE_TARGETS),
  targetId: z.uuid(),
  reason: z.enum(ReportReason, { error: "Elige un motivo." }),
  details: optionalText(REPORT_DETAILS_MAX, `Máximo ${REPORT_DETAILS_MAX} caracteres.`),
});
export type ReportInput = z.infer<typeof reportInputSchema>;

/** Fotos de comprobante por producto (ticket, factura, empaque, número de serie). */
export const MAX_PROOF_IMAGES = 4;

export const proofInputSchema = z.object({
  productId: z.uuid(),
  mediaIds: z
    .array(z.uuid())
    .min(1, "Agrega al menos una foto del comprobante.")
    .max(MAX_PROOF_IMAGES, `Máximo ${MAX_PROOF_IMAGES} fotos.`)
    .refine((ids) => new Set(ids).size === ids.length, "Hay fotos repetidas."),
});

export const productIdSchema = z.object({ productId: z.uuid() });

export const MODERATION_NOTE_MAX = 500;
const note = optionalText(MODERATION_NOTE_MAX, `Máximo ${MODERATION_NOTE_MAX} caracteres.`);
const target = { targetType: z.enum(REPORTABLE_TARGETS), targetId: z.uuid() };

/**
 * Fotos del comprobante que el equipo tenía en pantalla al verificar («id,id»). Si el vendedor lo
 * reemplazó mientras tanto, no coinciden con lo guardado y la verificación no procede.
 */
const proofIds = z
  .string()
  .max(40 * MAX_PROOF_IMAGES)
  .transform((value) => value.split(",").filter(Boolean))
  .pipe(z.array(z.uuid()).min(1).max(MAX_PROOF_IMAGES));

/** Acciones del equipo en /admin/moderacion. */
export const moderationActionSchema = z.discriminatedUnion("action", [
  // Verificar exige confirmar que se revisó el comprobante (casilla).
  z.object({
    action: z.literal("verify"),
    productId: z.uuid(),
    proofIds,
    note,
    confirmed: z.literal(true),
  }),
  z.object({ action: z.literal("reject"), productId: z.uuid(), note }),
  z.object({ action: z.literal("hide"), ...target, note }),
  z.object({ action: z.literal("restore"), ...target, note }),
  z.object({ action: z.literal("dismiss"), ...target, note }),
]);
export type ModerationAction = z.infer<typeof moderationActionSchema>;

/** Ajuste de plataforma: señal de IA en la revisión de autenticidad (apagada por omisión). */
export const TRUST_AI_SIGNAL_KEY = "trust.aiSignal.enabled";
export const trustAiSignalSchema = z.boolean();
/** Ajuste opcional que reemplaza la lista de precios de referencia (`reference-prices.ts`). */
export const TRUST_REFERENCE_PRICES_KEY = "trust.referencePrices";
