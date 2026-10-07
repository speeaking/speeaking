import type { ReportTargetType, RightsNoticeStatus } from "@/generated/prisma/enums";

/**
 * Qué puede hacer el equipo con un caso según su etapa (ADR-076). Código puro: lo usan el servicio
 * (que vuelve a revisarlo dentro de la transacción) y la página para mostrar solo lo que procede.
 *
 * recibido → «Retirar contenido» | «Rechazar» | «Retirado por quien avisó»
 * retirado / contra-aviso → «Restaurar» | «Mantener retirado» | «Retirado por quien avisó»
 * se mantiene retirado → «Restaurar» (p. ej. la autoridad resolvió) | «Retirado por quien avisó»
 * restaurado tras un contra-aviso → «Mantener retirado» (vuelve a retirarlo: quien avisó acreditó
 *   una acción legal dentro de sus 15 días hábiles, RLFDA art. 37 Nonies)
 * restaurado sin contra-aviso, rechazado, retirado por quien avisó → cerrado
 */
export type RightsDecision = "remove" | "restore" | "keep_down" | "reject" | "withdraw";

export type RightsStage = { status: RightsNoticeStatus; counterNoticeAt: Date | null };

const ALLOWED: Record<RightsNoticeStatus, readonly RightsDecision[]> = {
  RECEIVED: ["remove", "reject", "withdraw"],
  CONTENT_REMOVED: ["restore", "keep_down", "withdraw"],
  COUNTER_NOTICE_RECEIVED: ["restore", "keep_down", "withdraw"],
  KEPT_DOWN: ["restore", "withdraw"],
  RESTORED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function allowedDecisions(stage: RightsStage): readonly RightsDecision[] {
  if (stage.status === "RESTORED" && stage.counterNoticeAt) return ["keep_down"];
  return ALLOWED[stage.status];
}

export function canDecide(stage: RightsStage, decision: RightsDecision): boolean {
  return allowedDecisions(stage).includes(decision);
}

/**
 * «Mantener retirado» sobre lo que ya se restauró tras un contra-aviso vuelve a retirarlo (ocultar,
 * bloquear sus archivos y avisar a quien lo subió). En las demás etapas el contenido sigue oculto y
 * solo cambia el caso.
 */
export function keepDownHidesAgain(stage: RightsStage): boolean {
  return stage.status === "RESTORED";
}

/**
 * Restaurar exige nota cuando el equipo se adelanta al plazo de la ley o lo revierte por su cuenta:
 * sin contra-aviso (el aviso no procedía), con lo que se mantiene retirado, o antes de que venza el
 * plazo del contra-aviso (quien avisó todavía puede acreditar una acción legal).
 */
export function restoreNeedsNote(
  notice: { status: RightsNoticeStatus; restoreDueAt: Date | null },
  now: Date,
): boolean {
  if (notice.status === "COUNTER_NOTICE_RECEIVED") {
    return notice.restoreDueAt !== null && now < notice.restoreDueAt;
  }
  return true;
}

/** Lo que el equipo oculta con un clic (el resto, fotos de perfil y comentarios, se retira a mano). */
export function isAutoTarget(
  targetType: ReportTargetType,
): targetType is Extract<ReportTargetType, "POST" | "PRODUCT"> {
  return targetType === "POST" || targetType === "PRODUCT";
}
