import "server-only";
import { redactExpiredAiInputs } from "@/modules/ai/retention";
import { expireStaleCheckouts } from "@/modules/commerce/checkout";
import { deleteOrphanMedia } from "@/modules/media/orphans";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import type { Narrator } from "./narrative";
import { runDailyPipeline } from "./pipeline";

/**
 * La operación diaria con las dependencias reales (base, almacenamiento, comercio, medios e IA). La
 * usan `/api/cron/daily` y `scripts/ops-daily.ts`. La narrativa con IA es opcional: sin `narrate`,
 * el analista redacta con su plantilla determinista. Con `engineOnly` solo corre el motor
 * (métricas, experimentos, salvaguardas y analista), sin el mantenimiento de otros módulos.
 */
export function runScheduledDailyPipeline(
  options: { now?: Date; narrate?: Narrator; engineOnly?: boolean } = {},
) {
  const maintenance = options.engineOnly
    ? {}
    : {
        expireStaleCheckouts: (now: Date) => expireStaleCheckouts(now),
        deleteOrphanMedia: (cleanupOptions: { now: Date; dryRun?: boolean }) =>
          deleteOrphanMedia(db, getStorage(), cleanupOptions),
        redactExpiredAiInputs: (now: Date, batchSize: number) =>
          redactExpiredAiInputs(now, batchSize),
      };
  return runDailyPipeline({
    client: db,
    now: options.now,
    narrate: options.narrate,
    ...maintenance,
  });
}
