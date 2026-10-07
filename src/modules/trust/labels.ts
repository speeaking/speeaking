import type {
  AuthenticityStatus,
  ReportReason,
  ReportStatus,
  RiskLevel,
} from "@/generated/prisma/enums";
import type { ReportableTarget } from "./schemas";

/** Motivos de reporte tal como los elige quien reporta. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  COUNTERFEIT: "Posible falsificación",
  SCAM: "Estafa o engaño",
  PROHIBITED: "Artículo prohibido",
  SPAM: "Spam",
  OFFENSIVE: "Contenido ofensivo",
  OTHER: "Otro motivo",
  INTIMATE_WITHOUT_CONSENT: "Contenido íntimo sin consentimiento",
  CHILD_SAFETY: "Pone en riesgo a un menor",
  MINOR_ACCOUNT: "Cuenta de un menor de edad",
};

/** Orden en el formulario de reporte («Otro motivo» siempre al final). */
export const REPORT_REASONS: readonly ReportReason[] = [
  "COUNTERFEIT",
  "SCAM",
  "PROHIBITED",
  "SPAM",
  "OFFENSIVE",
  "INTIMATE_WITHOUT_CONSENT",
  "CHILD_SAFETY",
  "MINOR_ACCOUNT",
  "OTHER",
];

/**
 * Daños graves que van primero en la cola del equipo con la marca «Urgente» (Ley Olimpia y
 * protección de menores, ADR-076).
 */
export const URGENT_REPORT_REASONS: readonly ReportReason[] = [
  "INTIMATE_WITHOUT_CONSENT",
  "CHILD_SAFETY",
];

export function isUrgentReportReason(reason: ReportReason) {
  return URGENT_REPORT_REASONS.includes(reason);
}

/** Motivos que tienen sentido para lo que se reporta: «Cuenta de un menor» solo para una persona. */
export function reportReasonsFor(targetType: ReportableTarget): readonly ReportReason[] {
  return targetType === "USER"
    ? REPORT_REASONS
    : REPORT_REASONS.filter((reason) => reason !== "MINOR_ACCOUNT");
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  OPEN: "Abierto",
  ACTIONED: "Atendido",
  DISMISSED: "Descartado",
};

/** Estado de la revisión como lo ve el vendedor en su Studio. */
export const SELLER_AUTHENTICITY_LABELS: Record<AuthenticityStatus, string | null> = {
  AUTO_CLEAR: null,
  NEEDS_PROOF: "Falta comprobante",
  PROOF_SUBMITTED: "Comprobante en revisión",
  VERIFIED_BY_ADMIN: "Comprobante revisado",
  REJECTED: "Marcado como genérico",
};

/**
 * Riesgo alto en un producto que NO se declara original (usa la marca con palabras de imitación):
 * no se pide comprobante, se pide corregir la publicación.
 */
export const SELLER_NOT_DECLARED_LABEL = "Revisa el uso de la marca";
export const ADMIN_NOT_DECLARED_LABEL = "Marca con palabras de imitación";

/** Estado de la revisión en la cola del equipo. */
export const ADMIN_AUTHENTICITY_LABELS: Record<AuthenticityStatus, string> = {
  AUTO_CLEAR: "Sin prueba pedida",
  NEEDS_PROOF: "Esperando comprobante",
  PROOF_SUBMITTED: "Comprobante por revisar",
  VERIFIED_BY_ADMIN: "Comprobante revisado",
  REJECTED: "Declaración rechazada",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "Riesgo bajo",
  MEDIUM: "Riesgo medio",
  HIGH: "Riesgo alto",
};
