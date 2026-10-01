import type { Prisma } from "@/generated/prisma/client";
import type { Database } from "@/server/db-client";
import type { StorageProvider } from "@/server/providers/storage/types";
import { deleteStoredMedia } from "./variant-keys";

/**
 * Recolector de imágenes huérfanas (SEC-14): las que nadie adjuntó a una publicación o producto en
 * `ORPHAN_MAX_AGE_HOURS` (subidas y abandonadas, quitadas de un producto, o que se quedaron en
 * PROCESSING porque el proceso murió) se borran: primero la fila y luego el archivo, con sus
 * variantes de entrega (`variants/w<ancho>/…`, ADR-039).
 *
 * Las fotos de un comprobante de autenticidad NUNCA son huérfanas: son privadas a propósito (no se
 * adjuntan a nada) y el equipo las necesita para revisar y auditar. Tampoco las fotos y resultados
 * de Pruébatelo (`try_on_photos`, `try_on_results`, ADR-045): privadas, con su propia fecha de
 * borrado (`tryon/service.ts`). Ni la foto de perfil o la portada de alguien (`profiles`, ADR-058),
 * ni la portada de un video que sigue existiendo (`media."posterId"`, ADR-062): se va en la tanda
 * siguiente a la de su video. Un video sin adjuntar se borra igual que una foto.
 * Cuentan las del comprobante
 * vigente (`authenticity_checks."proofMediaIds"`, con `@>` para usar su índice GIN) y las de envíos
 * anteriores (`authenticity_proof_history`, índice por `mediaId`; `trust/proof-media.ts`).
 * Cada tanda va en dos pasos dentro de una transacción: bloquear candidatas (`lockOrphanBatch`, con
 * `FOR UPDATE SKIP LOCKED`: salta las que `submitProof` tiene bloqueadas `FOR UPDATE` mientras las
 * guarda) y borrarlas volviendo a comprobar en una sentencia aparte (`deleteLockedOrphans`), que ya
 * ve un comprobante o un adjunto confirmado justo antes de tomar el candado. Si el recolector llega
 * primero, `submitProof` espera el candado, ya no encuentra la foto y rechaza el comprobante.
 *
 * Sin `server-only` ni `@/server/db`: lo usa `scripts/cleanup-orphan-media.ts` fuera de Next, y
 * recibe la base y el almacenamiento como parámetros.
 */
export const ORPHAN_MAX_AGE_HOURS = 24;
const BATCH_SIZE = 200;
const HOUR = 60 * 60 * 1000;

type Tx = Prisma.TransactionClient;

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
        AND NOT EXISTS (SELECT 1 FROM "product_media" pr WHERE pr."mediaId" = m."id")
        AND NOT EXISTS (
          SELECT 1 FROM "authenticity_checks" ac WHERE ac."proofMediaIds" @> ARRAY[m."id"]
        )
        AND NOT EXISTS (
          SELECT 1 FROM "authenticity_proof_history" ph WHERE ph."mediaId" = m."id"
        )
        AND NOT EXISTS (SELECT 1 FROM "try_on_photos" tp WHERE tp."mediaId" = m."id")
        AND NOT EXISTS (SELECT 1 FROM "try_on_results" tr WHERE tr."resultMediaId" = m."id")
        AND NOT EXISTS (
          SELECT 1 FROM "profiles" pf
          WHERE pf."avatarMediaId" = m."id" OR pf."coverMediaId" = m."id"
        )
        AND NOT EXISTS (SELECT 1 FROM "media" v WHERE v."posterId" = m."id")`;
    return { deleted: row?.count ?? 0, failedFiles: [] };
  }

  let deleted = 0;
  const failedFiles: string[] = [];
  for (;;) {
    // Adjuntar una foto mientras está bloqueada espera el candado y después falla por llave foránea,
    // en lugar de perder la foto de una publicación.
    const { locked, rows } = await db.$transaction(
      async (tx) => {
        const ids = await lockOrphanBatch(tx, cutoff, batchSize);
        return { locked: ids.length, rows: await deleteLockedOrphans(tx, ids) };
      },
      // Cada sentencia con su propia foto de la base: la segunda ve lo que se confirmó antes de que
      // la primera tomara los candados (ver `deleteLockedOrphans`). Sin el tope de 5 s por omisión de
      // Prisma: un cron no debe fallar porque una tanda grande tarde más.
      { isolationLevel: "ReadCommitted", timeout: 60_000 },
    );
    // El archivo y sus variantes, después de confirmar el borrado de la fila (y fuera de la
    // transacción).
    for (const { storageKey } of rows) {
      try {
        await deleteStoredMedia(storage, storageKey);
      } catch {
        failedFiles.push(storageKey);
      }
    }
    deleted += rows.length;
    if (locked < batchSize) break;
  }
  return { deleted, failedFiles };
}

/**
 * Paso 1: candidatas (viejas, sin adjuntar y sin ser comprobante), bloqueadas `FOR UPDATE`. `SKIP
 * LOCKED` salta las que otra transacción tiene bloqueadas en ese momento: `submitProof` guardándolas
 * como comprobante (`FOR UPDATE`) o una publicación o producto adjuntándolas (la llave foránea y el
 * trigger `reject_proof_media_link` toman `FOR KEY SHARE`).
 */
export async function lockOrphanBatch(tx: Tx, cutoff: Date, batchSize: number) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT o."id" FROM "media" o
    WHERE o."createdAt" < ${cutoff}
      AND NOT EXISTS (SELECT 1 FROM "post_media" pm WHERE pm."mediaId" = o."id")
      AND NOT EXISTS (SELECT 1 FROM "product_media" pr WHERE pr."mediaId" = o."id")
      AND NOT EXISTS (
        SELECT 1 FROM "authenticity_checks" ac WHERE ac."proofMediaIds" @> ARRAY[o."id"]
      )
      AND NOT EXISTS (
        SELECT 1 FROM "authenticity_proof_history" ph WHERE ph."mediaId" = o."id"
      )
      AND NOT EXISTS (SELECT 1 FROM "try_on_photos" tp WHERE tp."mediaId" = o."id")
      AND NOT EXISTS (SELECT 1 FROM "try_on_results" tr WHERE tr."resultMediaId" = o."id")
      AND NOT EXISTS (
        SELECT 1 FROM "profiles" pf
        WHERE pf."avatarMediaId" = o."id" OR pf."coverMediaId" = o."id"
      )
      AND NOT EXISTS (SELECT 1 FROM "media" v WHERE v."posterId" = o."id")
    ORDER BY o."createdAt"
    LIMIT ${batchSize}::int
    FOR UPDATE SKIP LOCKED`;
  return rows.map((row) => row.id);
}

/**
 * Paso 2: borra las bloqueadas que SIGUEN sin adjuntar y sin ser comprobante, en una sentencia
 * aparte. En una sola sentencia, las condiciones se evaluaban con la foto de la base del INICIO de
 * la sentencia: si `submitProof` (o una publicación) confirmaba entre esa foto y el momento en que
 * el recolector llegaba a la fila, el candado ya estaba libre, la condición vieja decía «huérfana» y
 * se borraba una foto recién guardada como comprobante (o, por la cascada, recién adjuntada). Con la
 * fila ya bloqueada, lo que se confirmó antes está en la foto nueva de esta sentencia y lo que venga
 * después espera el candado (y ya no encuentra la fila).
 */
export async function deleteLockedOrphans(tx: Tx, ids: readonly string[]) {
  if (ids.length === 0) return [];
  return tx.$queryRaw<{ storageKey: string }[]>`
    DELETE FROM "media" m
    WHERE m."id" = ANY(${[...ids]}::uuid[])
      AND NOT EXISTS (SELECT 1 FROM "post_media" pm WHERE pm."mediaId" = m."id")
      AND NOT EXISTS (SELECT 1 FROM "product_media" pr WHERE pr."mediaId" = m."id")
      AND NOT EXISTS (
        SELECT 1 FROM "authenticity_checks" ac WHERE ac."proofMediaIds" @> ARRAY[m."id"]
      )
      AND NOT EXISTS (
        SELECT 1 FROM "authenticity_proof_history" ph WHERE ph."mediaId" = m."id"
      )
      AND NOT EXISTS (SELECT 1 FROM "try_on_photos" tp WHERE tp."mediaId" = m."id")
      AND NOT EXISTS (SELECT 1 FROM "try_on_results" tr WHERE tr."resultMediaId" = m."id")
      AND NOT EXISTS (
        SELECT 1 FROM "profiles" pf
        WHERE pf."avatarMediaId" = m."id" OR pf."coverMediaId" = m."id"
      )
      AND NOT EXISTS (SELECT 1 FROM "media" v WHERE v."posterId" = m."id")
    RETURNING m."storageKey"`;
}
