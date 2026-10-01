import type { Prisma } from "@/generated/prisma/client";
import type { Client } from "@/modules/platform/client";

/**
 * Bitácora de tareas programadas (`JobRun`): una fila por ejecución, RUNNING mientras corre y
 * SUCCEEDED o FAILED al terminar, con un resumen sin datos personales y un error corto sin secretos.
 */

export const JOB_NAMES = [
  "ops-daily",
  "daily-metrics",
  "experiments",
  "guardrails",
  "analyst",
  "expire-checkouts",
  "orphan-media",
  "ai-input-redaction",
  "tryon-retention",
  "notifications-retention",
  "editorial-drafts",
] as const;

export type JobName = (typeof JOB_NAMES)[number];

export type JobOutcome<T> = { ok: true; summary: T } | { ok: false; error: string };

/** Mensaje corto y sin secretos: sin cadenas de conexión, correos ni tokens largos. */
export function safeErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error ? `${error.name}: ${error.message}` : `Error: ${String(error)}`;
  return raw
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s"']+/gi, "<url>")
    .replace(/[^\s@"']+@[^\s@"']+\.[a-z]{2,}/gi, "<correo>")
    .replace(/[A-Za-z0-9_-]{32,}/g, "<token>")
    .replace(/\s+/g, " ")
    .slice(0, 300);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

/** Corre una tarea registrándola en `JobRun`. Nunca lanza: devuelve el resultado o el error. */
export async function runJob<T>(
  client: Client,
  job: JobName,
  fn: () => Promise<T>,
): Promise<JobOutcome<T>> {
  const run = await client.jobRun.create({ data: { job }, select: { id: true } });
  try {
    const summary = await fn();
    await client.jobRun.update({
      where: { id: run.id },
      data: { status: "SUCCEEDED", finishedAt: new Date(), summary: toJson(summary) },
    });
    return { ok: true, summary };
  } catch (error) {
    const message = safeErrorMessage(error);
    console.error(`[jobs] la tarea ${job} falló: ${message}`);
    await client.jobRun
      .update({
        where: { id: run.id },
        data: { status: "FAILED", finishedAt: new Date(), error: message },
      })
      .catch(() => undefined);
    return { ok: false, error: message };
  }
}
