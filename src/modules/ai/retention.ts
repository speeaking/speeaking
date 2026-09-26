import "server-only";
import { db } from "@/server/db";

/**
 * Retención de la entrada de IA (SEC-29). `AIRequest.input` guarda lo necesario para auditar y
 * reconstruir una propuesta (con el texto libre ya sin datos de contacto ni cuentas); pasado el
 * plazo se reemplaza por `{ redacted: true }`. La fila se queda: la contabilidad de gasto de IA
 * (ADR-020) la necesita. Una propuesta así ya no prellena productos.
 */
export const AI_INPUT_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
const RUN_INTERVAL_MS = 60 * 60 * 1000;
const BATCH_SIZE = 500;

let nextRunAt = 0;

/** Redacta hasta `batchSize` entradas vencidas. Devuelve cuántas redactó. */
export function redactExpiredAiInputs(now: Date = new Date(), batchSize = BATCH_SIZE) {
  const cutoff = new Date(now.getTime() - AI_INPUT_RETENTION_DAYS * DAY_MS);
  return db.$executeRaw`
    UPDATE "ai_requests" SET "input" = '{"redacted": true}'::jsonb
    WHERE "id" IN (
      SELECT "id" FROM "ai_requests"
      WHERE "createdAt" < ${cutoff} AND NOT ("input" @> '{"redacted": true}'::jsonb)
      ORDER BY "createdAt"
      LIMIT ${batchSize}::int
    )`;
}

/** Limpieza oportunista: a lo más una vez por hora por proceso; nunca rompe la petición. */
export async function maybeRedactExpiredAiInputs() {
  const now = Date.now();
  if (now < nextRunAt) return;
  nextRunAt = now + RUN_INTERVAL_MS;
  try {
    await redactExpiredAiInputs(new Date(now));
  } catch (error) {
    console.error("[ai] no se pudo aplicar la retención de entradas", error);
  }
}
