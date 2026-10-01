import "server-only";
import type { UserRole } from "@/generated/prisma/enums";
import { db } from "@/server/db";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rol de equipo guardado en el perfil; `null` si la cuenta no tiene perfil. */
export async function findUserRole(userId: string): Promise<UserRole | null> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { role: true } });
  return profile?.role ?? null;
}

/** Conteos de las colas del equipo para el resumen de /admin (solo números, sin datos personales). */
export async function countAdminQueues(now: Date = new Date()) {
  const [
    openReports,
    proofsToReview,
    proposedDecisions,
    runningExperiments,
    failedJobs,
    evalRuns,
    editorialDrafts,
  ] = await Promise.all([
    db.report.count({ where: { status: "OPEN" } }),
    db.authenticityCheck.count({ where: { status: "PROOF_SUBMITTED" } }),
    db.platformDecision.count({ where: { status: "PROPOSED" } }),
    db.experiment.count({ where: { status: "RUNNING" } }),
    db.jobRun.count({
      where: { status: "FAILED", startedAt: { gte: new Date(now.getTime() - DAY_MS) } },
    }),
    db.aIEvalRun.count(),
    db.editorialDraft.count({ where: { status: "PENDING" } }),
  ]);
  return {
    openReports,
    proofsToReview,
    proposedDecisions,
    runningExperiments,
    failedJobsLast24h: failedJobs,
    evalRuns,
    editorialDrafts,
  };
}
