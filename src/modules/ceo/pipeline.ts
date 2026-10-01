import type { Prisma } from "@/generated/prisma/client";
import {
  addDays,
  type Day,
  dayRange,
  dayToDbDate,
  dbDateToDay,
  mexicoDay,
} from "@/modules/platform/calendar";
import { type Client, inTransaction, lockName } from "@/modules/platform/client";
import { runAnalyst } from "./analyst";
import { evaluateRunningExperiments } from "./experiments";
import { type JobName, runJob, safeErrorMessage } from "./jobs";
import { aggregateDailyMetrics } from "./metrics";
import { runGuardrailMonitor } from "./monitor";
import type { Narrator } from "./narrative";

/**
 * Operación diaria (`pnpm ops:daily` y `/api/cron/daily`), en este orden:
 *   métricas → experimentos → salvaguardas → analista → checkouts vencidos → imágenes huérfanas →
 *   retención de entradas de IA → retención de Pruébatelo.
 * Cada paso deja su `JobRun`; todos son idempotentes y se pueden volver a correr. Si las métricas
 * fallan, salvaguardas y analista no corren (no se decide con datos incompletos); el mantenimiento
 * sí. Dos ejecuciones simultáneas no se enciman: la segunda se registra como omitida.
 *
 * Las tareas de otros módulos llegan como dependencias (el motor no importa comercio, medios ni IA).
 */

/** Días hacia atrás que se revisan por si faltan métricas (ejecuciones perdidas). */
export const BACKFILL_DAYS = 14;
const OVERLAP_MINUTES = 30;
const MAX_ROUNDS = 20;
const REDACTION_BATCH = 500;
const NOT_IN_RUN = "No se incluyó en esta ejecución (solo el motor de automejora).";

export type OrphanCleanup = (options: {
  now: Date;
  dryRun?: boolean;
}) => Promise<{ deleted: number; failedFiles: string[] }>;

export type PipelineDeps = {
  client: Client;
  now?: Date;
  narrate?: Narrator;
  /** `expireStaleCheckouts` de comercio (procesa lotes de 50; aquí se repite hasta vaciar). */
  expireStaleCheckouts?: (now: Date) => Promise<unknown>;
  /** `deleteOrphanMedia` de medios, ya con su base y almacenamiento. */
  deleteOrphanMedia?: OrphanCleanup;
  /** `redactExpiredAiInputs` de IA (devuelve cuántas redactó en el lote). */
  redactExpiredAiInputs?: (now: Date, batchSize: number) => Promise<number>;
  /** `deleteExpiredTryOnMedia` de Pruébatelo (ADR-045): fotos y simulaciones vencidas. */
  deleteExpiredTryOnMedia?: (
    now: Date,
  ) => Promise<{ photos: number; results: number; failedFiles: string[] }>;
  /** `deleteOldNotifications` de avisos (ADR-059): los de más de 90 días. */
  deleteOldNotifications?: (now: Date) => Promise<number>;
};

export type StepResult = { ok: true; summary: unknown } | { ok: false; error: string };

export type PipelineSummary = {
  skipped: boolean;
  day: Day;
  steps: Partial<Record<JobName, StepResult | { ok: true; summary: "omitido"; reason: string }>>;
};

/** Días a (re)calcular: ayer y anteayer siempre (eventos tardíos) y los que falten en 14 días. */
async function daysToAggregate(client: Client, yesterday: Day): Promise<Day[]> {
  const from = addDays(yesterday, -(BACKFILL_DAYS - 1));
  const existing = await client.dailyMetric.findMany({
    where: {
      key: "feed.impressions.visible",
      dimension: "",
      day: { gte: dayToDbDate(from), lte: dayToDbDate(yesterday) },
    },
    select: { day: true },
  });
  const have = new Set(existing.map((row) => dbDateToDay(row.day)));
  const always = new Set([yesterday, addDays(yesterday, -1)]);
  return dayRange(from, yesterday).filter((day) => always.has(day) || !have.has(day));
}

/** Registra la ejecución general; `null` si ya hay otra corriendo (se registra como omitida). */
async function claimRun(client: Client, now: Date): Promise<string | null> {
  return inTransaction(client, async (tx) => {
    await lockName(tx, "job:ops-daily");
    const since = new Date(now.getTime() - OVERLAP_MINUTES * 60_000);
    const running = await tx.jobRun.findFirst({
      where: { job: "ops-daily", status: "RUNNING", startedAt: { gte: since } },
      select: { id: true },
    });
    if (running) {
      await tx.jobRun.create({
        data: {
          job: "ops-daily",
          status: "SUCCEEDED",
          finishedAt: now,
          summary: { skipped: true, reason: "Ya había otra ejecución en curso." },
        },
      });
      return null;
    }
    const run = await tx.jobRun.create({ data: { job: "ops-daily" }, select: { id: true } });
    return run.id;
  });
}

/**
 * Candado de seguridad de la limpieza de imágenes: las fotos de prueba de autenticidad
 * (`AuthenticityCheck.proofMediaIds`) no están adjuntas a publicaciones ni productos, así que un
 * recolector que no las excluya las borraría. Se compara lo que borraría el recolector con las
 * huérfanas SIN las pruebas: si borraría más, el paso se omite (se reanuda solo cuando el recolector
 * las excluya).
 */
async function orphanCleanupIsSafe(client: Client, cleanup: OrphanCleanup, now: Date) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [row] = await client.$queryRaw<{ unprotected: number; proofs: number }[]>`
    SELECT
      count(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM "authenticity_checks" a WHERE m."id" = ANY(a."proofMediaIds")
      ))::int AS "unprotected",
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "authenticity_checks" a WHERE m."id" = ANY(a."proofMediaIds")
      ))::int AS "proofs"
    FROM "media" m
    WHERE m."createdAt" < ${cutoff}
      AND NOT EXISTS (SELECT 1 FROM "post_media" pm WHERE pm."mediaId" = m."id")
      AND NOT EXISTS (SELECT 1 FROM "product_media" pr WHERE pr."mediaId" = m."id")`;
  if (!row || row.proofs === 0) return { safe: true, proofs: 0 };
  const dryRun = await cleanup({ now, dryRun: true });
  return { safe: dryRun.deleted <= row.unprotected, proofs: row.proofs };
}

export async function runDailyPipeline(deps: PipelineDeps): Promise<PipelineSummary> {
  const client = deps.client;
  const now = deps.now ?? new Date();
  const yesterday = addDays(mexicoDay(now), -1);
  const summary: PipelineSummary = { skipped: false, day: yesterday, steps: {} };

  const runId = await claimRun(client, now);
  if (!runId) return { ...summary, skipped: true };

  const skip = (reason: string) => ({ ok: true as const, summary: "omitido" as const, reason });
  try {
    const metrics = await runJob(client, "daily-metrics", async () => {
      const days = await daysToAggregate(client, yesterday);
      const results = [];
      for (const day of days) results.push(await aggregateDailyMetrics(client, day, now));
      return {
        days: results.map((result) => result.day),
        rows: results.reduce((s, r) => s + r.rows, 0),
      };
    });
    summary.steps["daily-metrics"] = metrics;

    summary.steps.experiments = await runJob(client, "experiments", () =>
      evaluateRunningExperiments(client, now),
    );

    if (metrics.ok) {
      summary.steps.guardrails = await runJob(client, "guardrails", () =>
        runGuardrailMonitor(client, now),
      );
      summary.steps.analyst = await runJob(client, "analyst", () =>
        runAnalyst(client, yesterday, { now, narrate: deps.narrate }),
      );
    } else {
      const reason = "Las métricas del día fallaron: no se decide con datos incompletos.";
      summary.steps.guardrails = skip(reason);
      summary.steps.analyst = skip(reason);
    }

    const expire = deps.expireStaleCheckouts;
    summary.steps["expire-checkouts"] = expire
      ? await runJob(client, "expire-checkouts", async () => {
          const stale = () =>
            client.checkout.count({
              where: { status: "PENDING_PAYMENT", expiresAt: { lt: now } },
            });
          const before = await stale();
          let remaining = before;
          let rounds = 0;
          while (remaining > 0 && rounds < MAX_ROUNDS) {
            await expire(now);
            rounds++;
            const after = await stale();
            if (after >= remaining) {
              remaining = after;
              break;
            }
            remaining = after;
          }
          return { before, remaining, rounds };
        })
      : skip(NOT_IN_RUN);

    const cleanup = deps.deleteOrphanMedia;
    summary.steps["orphan-media"] = cleanup
      ? await runJob(client, "orphan-media", async () => {
          const guard = await orphanCleanupIsSafe(client, cleanup, now);
          if (!guard.safe) {
            return {
              skipped: true,
              reason:
                "El recolector borraría fotos de prueba de autenticidad; se omite hasta que las excluya.",
              proofMedia: guard.proofs,
            };
          }
          const result = await cleanup({ now });
          return { deleted: result.deleted, failedFiles: result.failedFiles.length };
        })
      : skip(NOT_IN_RUN);

    const redact = deps.redactExpiredAiInputs;
    summary.steps["ai-input-redaction"] = redact
      ? await runJob(client, "ai-input-redaction", async () => {
          let redacted = 0;
          for (let round = 0; round < MAX_ROUNDS; round++) {
            const batch = await redact(now, REDACTION_BATCH);
            redacted += batch;
            if (batch < REDACTION_BATCH) break;
          }
          return { redacted };
        })
      : skip(NOT_IN_RUN);

    const tryOn = deps.deleteExpiredTryOnMedia;
    summary.steps["tryon-retention"] = tryOn
      ? await runJob(client, "tryon-retention", async () => {
          let photos = 0;
          let results = 0;
          let failedFiles = 0;
          for (let round = 0; round < MAX_ROUNDS; round++) {
            const batch = await tryOn(now);
            photos += batch.photos;
            results += batch.results;
            failedFiles += batch.failedFiles.length;
            if (batch.photos === 0 && batch.results === 0) break;
          }
          return { photos, results, failedFiles };
        })
      : skip(NOT_IN_RUN);

    const notifications = deps.deleteOldNotifications;
    summary.steps["notifications-retention"] = notifications
      ? await runJob(client, "notifications-retention", async () => ({
          deleted: await notifications(now),
        }))
      : skip(NOT_IN_RUN);

    const failed = Object.entries(summary.steps).filter(([, step]) => !step.ok);
    await client.jobRun.update({
      where: { id: runId },
      data: {
        status: failed.length === 0 ? "SUCCEEDED" : "FAILED",
        finishedAt: new Date(),
        summary: JSON.parse(JSON.stringify(summary)) as Prisma.InputJsonValue,
        error:
          failed.length === 0
            ? null
            : `Fallaron ${failed.length} pasos: ${failed.map(([name]) => name).join(", ")}.`,
      },
    });
    return summary;
  } catch (error) {
    await client.jobRun
      .update({
        where: { id: runId },
        data: { status: "FAILED", finishedAt: new Date(), error: safeErrorMessage(error) },
      })
      .catch(() => undefined);
    throw error;
  }
}
