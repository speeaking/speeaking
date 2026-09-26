import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createPrismaClient } from "@/server/db-client";
import { deleteOrphanMedia } from "./orphans";

/**
 * Integración contra la base de desarrollo (`pnpm db:start`). Las filas de prueba se fechan en el año
 * 2000 y la corrida usa un `now` de esa época: el recolector solo alcanza a esas filas, nunca a las
 * imágenes reales de la base.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

const OLD = new Date("2000-01-01T00:00:00Z");
const NOW = new Date("2000-01-02T12:00:00Z");

describe.skipIf(!databaseUrl)("deleteOrphanMedia contra PostgreSQL", () => {
  const db = createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base");
  const email = `e2e.fix.${randomUUID().slice(0, 8)}@example.com`;

  afterAll(async () => {
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  });

  it("borra fila y archivo de lo no adjuntado en 24 h; conserva lo adjunto y lo reciente", async () => {
    const user = await db.user.create({ data: { name: "Prueba", email }, select: { id: true } });
    const media = (label: string, createdAt: Date, status: "READY" | "PROCESSING" = "READY") =>
      db.media.create({
        data: {
          ownerId: user.id,
          storageKey: `images/test/${label}-${randomUUID()}.webp`,
          mimeType: "image/webp",
          width: 1,
          height: 1,
          sizeBytes: 1,
          status,
          createdAt,
        },
        select: { id: true, storageKey: true },
      });
    const orphan = await media("huerfana", OLD);
    const stuck = await media("atorada", OLD, "PROCESSING");
    const attached = await media("adjunta", OLD);
    const recent = await media("reciente", new Date(NOW.getTime() - 60 * 60 * 1000));
    await db.post.create({
      data: {
        authorId: user.id,
        body: "prueba del recolector",
        status: "HIDDEN",
        media: { create: [{ mediaId: attached.id }] },
      },
    });
    const deletedFiles: string[] = [];
    const storage = { delete: async (key: string) => void deletedFiles.push(key) };

    const preview = await deleteOrphanMedia(db, storage, { now: NOW, dryRun: true });
    expect(preview.deleted).toBe(2);
    expect(deletedFiles).toEqual([]);

    const result = await deleteOrphanMedia(db, storage, { now: NOW, batchSize: 1 });

    expect(result).toEqual({ deleted: 2, failedFiles: [] });
    expect(deletedFiles.sort()).toEqual([orphan.storageKey, stuck.storageKey].sort());
    const left = await db.media.findMany({ where: { ownerId: user.id }, select: { id: true } });
    expect(left.map((row) => row.id).sort()).toEqual([attached.id, recent.id].sort());
  });

  it("si el archivo no se puede borrar, lo reporta (la fila ya no existe)", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    const row = await db.media.create({
      data: {
        ownerId: user.id,
        storageKey: `images/test/falla-${randomUUID()}.webp`,
        mimeType: "image/webp",
        width: 1,
        height: 1,
        sizeBytes: 1,
        createdAt: OLD,
      },
      select: { storageKey: true },
    });
    const storage = {
      delete: async () => {
        throw new Error("disco");
      },
    };

    await expect(deleteOrphanMedia(db, storage, { now: NOW })).resolves.toEqual({
      deleted: 1,
      failedFiles: [row.storageKey],
    });
  });
});
