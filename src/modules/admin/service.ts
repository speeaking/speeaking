import "server-only";
import { countAdminQueues, findUserRole } from "./queries";

/**
 * Autorización del equipo en la capa de servicios (docs/architecture.md → Administración y
 * operación). Toda función de servicio que lea o cambie algo del área de administración recibe a
 * quien actúa y llama `assertAdmin` primero, aunque la página o la acción ya hayan pasado por
 * `requireAdmin`/`getAdminViewer`: así ningún camino nuevo se salta la regla.
 */
export class AdminAuthorizationError extends Error {
  override name = "AdminAuthorizationError";
  constructor() {
    super("ADMIN_REQUIRED");
  }
}

/** Lanza `AdminAuthorizationError` si la cuenta no tiene el rol ADMIN (leído de la base). */
export async function assertAdmin(actorUserId: string): Promise<void> {
  if ((await findUserRole(actorUserId)) !== "ADMIN") {
    throw new AdminAuthorizationError();
  }
}

/** Resumen de /admin: cuántos pendientes hay en cada cola. Solo conteos calculados por código. */
export type AdminOverview = {
  registeredUsers: number;
  openReports: number;
  proofsToReview: number;
  proposedDecisions: number;
  runningExperiments: number;
  failedJobsLast24h: number;
  evalRuns: number;
  /** Borradores de la redacción diaria que esperan revisión (ADR-066). */
  editorialDrafts: number;
};

export async function getAdminOverview(actorUserId: string): Promise<AdminOverview> {
  await assertAdmin(actorUserId);
  return countAdminQueues();
}
