/**
 * Borra las imágenes que nadie adjuntó a una publicación o producto en 24 h (SEC-14): la fila de
 * `media` y el archivo. Mientras no se adjuntan, `/media` solo se las sirve a su dueño.
 *
 * Uso: `tsx scripts/cleanup-orphan-media.ts [--dry-run]`. Pensado para correr a diario (cron).
 */
import "dotenv/config";
import { deleteOrphanMedia, ORPHAN_MAX_AGE_HOURS } from "../src/modules/media/orphans";
import { createPrismaClient } from "../src/server/db-client";
import { LocalStorageProvider } from "../src/server/providers/storage/local-storage";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Falta DATABASE_URL.");

const dryRun = process.argv.includes("--dry-run");
const db = createPrismaClient(databaseUrl);
// Hoy solo existe el almacenamiento local (ADR-005); con S3/R2 se cambia aquí el proveedor.
const storage = new LocalStorageProvider(process.env.STORAGE_LOCAL_ROOT ?? ".data/uploads");

async function main() {
  const { deleted, failedFiles } = await deleteOrphanMedia(db, storage, { dryRun });
  if (dryRun) {
    console.warn(
      `Se borrarían ${deleted} imágenes sin adjuntar de más de ${ORPHAN_MAX_AGE_HOURS} h.`,
    );
    return;
  }
  console.warn(`✓ Borradas ${deleted} imágenes sin adjuntar de más de ${ORPHAN_MAX_AGE_HOURS} h.`);
  if (failedFiles.length > 0) {
    console.error(`No se pudieron borrar ${failedFiles.length} archivos:`, failedFiles);
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
