import type { Database } from "@/server/db-client";
import type { StorageProvider } from "@/server/providers/storage/types";

/**
 * Recolector de imágenes huérfanas (SEC-14): las que nadie adjuntó a una publicación o producto en
 * `ORPHAN_MAX_AGE_HOURS` (subidas y abandonadas, quitadas de un producto, o que se quedaron en
 * PROCESSING porque el proceso murió) se borran: primero la fila y luego el archivo.
 *
 * Sin `server-only` ni `@/server/db`: lo usa `scripts/cleanup-orphan-media.ts` fuera de Next, y
 * recibe la base y el almacenamiento como parámetros.
 */
export const ORPHAN_MAX_AGE_HOURS = 24;
const BATCH_SIZE = 200;
const HOUR = 60 * 60 * 1000;

export type OrphanCleanupOptions = {
  now?: Date;
  maxAgeHours?: number;
  batchSize?: number;
  /** Solo cuenta lo que se borraría. */
  dryRun?: boolean;
};

export type OrphanCleanupResult = {
  /** Filas borradas (o que se borrarían, con `dryRun`). */
  deleted: number;
  /** Archivos que no se pudieron borrar (la fila ya no existe: `/media` ya no los sirve). */
  failedFiles: string[];
};

export async function deleteOrphanMedia(
  db: Database,
  storage: Pick<StorageProvider, "delete">,
  {
    now = new Date(),
    maxAgeHours = ORPHAN_MAX_AGE_HOURS,
    batchSize = BATCH_SIZE,
    dryRun = false,
  }: OrphanCleanupOptions = {},
): Promise<OrphanCleanupResult> {
  const cutoff = new Date(now.getTime() - maxAgeHours * HOUR);
  if (dryRun) {
    const [row] = await db.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS "count" FROM "media" m
      WHERE m."createdAt" < ${cutoff}
        AND NOT EXISTS (SELECT 1 FROM "post_media" pm WHERE pm."mediaId" = m."id")
        AND NOT EXISTS (SELECT 1 FROM "product_media" pr WHERE pr."mediaId" = m."id")`;
    return { deleted: row?.count ?? 0, failedFiles: [] };
  }

  let deleted = 0;
  const failedFiles: string[] = [];
  for (;;) {
    // Borrado condicional en una sola sentencia: la fila se bloquea (FOR UPDATE) y solo se borra si
    // sigue sin adjuntar; adjuntarla al mismo tiempo espera el bloqueo y falla por llave foránea en
    // lugar de perder la foto de una publicación.
    const rows = await db.$queryRaw<{ storageKey: string }[]>`
      DELETE FROM "media" m
      WHERE m."id" IN (
          SELECT o."id" FROM "media" o
          WHERE o."createdAt" < ${cutoff}
            AND NOT EXISTS (SELECT 1 FROM "post_media" pm WHERE pm."mediaId" = o."id")
            AND NOT EXISTS (SELECT 1 FROM "product_media" pr WHERE pr."mediaId" = o."id")
          ORDER BY o."createdAt"
          LIMIT ${batchSize}::int
          FOR UPDATE SKIP LOCKED
        )
        AND NOT EXISTS (SELECT 1 FROM "post_media" pm WHERE pm."mediaId" = m."id")
        AND NOT EXISTS (SELECT 1 FROM "product_media" pr WHERE pr."mediaId" = m."id")
      RETURNING m."storageKey"`;
    for (const { storageKey } of rows) {
      try {
        await storage.delete(storageKey);
      } catch {
        failedFiles.push(storageKey);
      }
    }
    deleted += rows.length;
    if (rows.length < batchSize) break;
  }
  return { deleted, failedFiles };
}
