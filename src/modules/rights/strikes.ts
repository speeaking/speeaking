import type { RightsNoticeStatus } from "@/generated/prisma/enums";

/**
 * Política de reincidencia (LFDA art. 114 Octies fr. II c, ADR-076): una falta es un aviso por el que
 * se retiró contenido y que no se revirtió. Con `STRIKE_THRESHOLD` faltas en 12 meses se cierra la
 * cuenta y su tienda; las cuentas dedicadas a la piratería, a la primera. El código solo cuenta y
 * avisa: el cierre lo decide una persona del equipo en /admin/usuarios.
 */
export const STRIKE_THRESHOLD = 3;
export const STRIKE_WINDOW_MONTHS = 12;

export type StrikeCandidate = {
  status: RightsNoticeStatus;
  contentRemovedAt: Date | null;
  restoreDueAt?: Date | null;
};

export function strikeWindowStart(now: Date): Date {
  const start = new Date(now.getTime());
  start.setUTCMonth(start.getUTCMonth() - STRIKE_WINDOW_MONTHS);
  return start;
}

/**
 * ¿Este aviso cuenta como falta para quien subió el contenido? Cuentan lo retirado
 * (`CONTENT_REMOVED`), lo que se mantiene retirado (`KEPT_DOWN`) y lo que tiene contra-aviso mientras
 * corre su plazo; un contra-aviso que llegó a su fecha sin acción legal acreditada ya no cuenta,
 * aunque el equipo todavía no lo restaure. Lo restaurado, rechazado o retirado por quien avisó, nunca.
 */
export function isStrike(notice: StrikeCandidate, now: Date): boolean {
  if (!notice.contentRemovedAt || notice.contentRemovedAt < strikeWindowStart(now)) return false;
  switch (notice.status) {
    case "CONTENT_REMOVED":
    case "KEPT_DOWN":
      return true;
    case "COUNTER_NOTICE_RECEIVED":
      return !notice.restoreDueAt || now < notice.restoreDueAt;
    default:
      return false;
  }
}

/** Faltas vigentes entre los avisos de una persona (uno por aviso, aunque señale varias cosas suyas). */
export function countStrikes(notices: readonly StrikeCandidate[], now: Date): number {
  return notices.filter((notice) => isStrike(notice, now)).length;
}
