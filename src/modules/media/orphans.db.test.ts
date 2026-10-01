import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createPrismaClient } from "@/server/db-client";
import { deleteLockedOrphans, deleteOrphanMedia, lockOrphanBatch } from "./orphans";
import { variantKeys } from "./variant-keys";

/** Lo que se borró: cada original con sus variantes de entrega (ADR-039). */
const withVariants = (...keys: string[]) =>
  keys.flatMap((key) => [key, ...variantKeys(key)]).sort();

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

// `lockPrivateReadyMedia` (trust) usa el cliente de `@/server/db`: aquí, la misma base.
vi.mock("@/server/db", async () => {
  const { createPrismaClient } = await import("@/server/db-client");
  return { db: createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base") };
});
vi.mock("@/server/env", () => ({ env: { NODE_ENV: "test", STORAGE_LOCAL_ROOT: ".data" } }));
vi.mock("@/server/providers/storage", () => ({ getStorage: () => ({}) }));

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
    expect(deletedFiles.sort()).toEqual(withVariants(orphan.storageKey, stuck.storageKey));
    const left = await db.media.findMany({ where: { ownerId: user.id }, select: { id: true } });
    expect(left.map((row) => row.id).sort()).toEqual([attached.id, recent.id].sort());
  });

  it("nunca borra fotos de un comprobante, vigente o reemplazado (privadas, sin adjuntar)", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    const seller = await db.sellerProfile.create({
      data: { userId: user.id, displayName: "Tienda recolector" },
      select: { id: true },
    });
    const category = await db.category.create({
      data: { slug: `orphans-test-${randomUUID().slice(0, 8)}`, name: "Prueba recolector" },
      select: { id: true },
    });
    const media = (label: string) =>
      db.media.create({
        data: {
          ownerId: user.id,
          storageKey: `images/test/${label}-${randomUUID()}.webp`,
          mimeType: "image/webp",
          width: 1,
          height: 1,
          sizeBytes: 1,
          createdAt: OLD,
        },
        select: { id: true, storageKey: true },
      });
    try {
      const proof = await media("comprobante");
      const reviewed = await media("comprobante-revisado");
      const replaced = await media("comprobante-reemplazado");
      const orphan = await media("huerfana-2");
      const product = (title: string) =>
        db.product.create({
          data: {
            sellerId: seller.id,
            categoryId: category.id,
            slug: `recolector-${randomUUID()}`,
            title,
            description: "Prueba del recolector",
            priceCents: 100_000,
            city: "Ciudad de México",
            state: "CDMX",
          },
          select: { id: true },
        });
      const pending = await product("Con comprobante en revisión");
      const verified = await product("Con comprobante revisado");
      const check = (productId: string, status: "PROOF_SUBMITTED" | "VERIFIED_BY_ADMIN") =>
        db.authenticityCheck.create({
          data: { productId, riskLevel: "HIGH", score: 0.7, signals: [], status },
        });
      await check(pending.id, "PROOF_SUBMITTED");
      await check(verified.id, "VERIFIED_BY_ADMIN");
      await db.authenticityCheck.update({
        where: { productId: pending.id },
        data: { proofMediaIds: [proof.id] },
      });
      await db.authenticityCheck.update({
        where: { productId: verified.id },
        data: { proofMediaIds: [reviewed.id] },
      });
      // Primer envío del producto en revisión, ya reemplazado: solo queda en la bitácora.
      await db.authenticityProofHistory.create({
        data: { productId: pending.id, mediaId: replaced.id, submittedAt: OLD, replacedAt: NOW },
      });
      const deletedFiles: string[] = [];
      const storage = { delete: async (key: string) => void deletedFiles.push(key) };

      const preview = await deleteOrphanMedia(db, storage, { now: NOW, dryRun: true });
      expect(preview.deleted).toBe(1);
      const result = await deleteOrphanMedia(db, storage, { now: NOW, batchSize: 1 });

      expect(result).toEqual({ deleted: 1, failedFiles: [] });
      expect(deletedFiles.sort()).toEqual(withVariants(orphan.storageKey));
      const left = await db.media.findMany({
        where: { id: { in: [proof.id, reviewed.id, replaced.id, orphan.id] } },
        select: { id: true },
      });
      expect(left.map((row) => row.id).sort()).toEqual([proof.id, reviewed.id, replaced.id].sort());
      // La bitácora sigue completa (la cascada desde `media` no se disparó).
      await expect(
        db.authenticityProofHistory.count({ where: { mediaId: replaced.id } }),
      ).resolves.toBe(1);
    } finally {
      await db.product.deleteMany({ where: { categoryId: category.id } });
      await db.category.delete({ where: { id: category.id } });
      await db.media.deleteMany({ where: { ownerId: user.id } });
    }
  });

  it("la portada de un video sigue mientras el video exista; se va en la tanda siguiente (ADR-062)", async () => {
    const user = await db.user.create({
      data: { name: "Prueba", email: `e2e.fix.${randomUUID().slice(0, 8)}@example.com` },
      select: { id: true, email: true },
    });
    try {
      const poster = await db.media.create({
        data: {
          ownerId: user.id,
          storageKey: `images/test/portada-${randomUUID()}.webp`,
          mimeType: "image/webp",
          width: 1,
          height: 1,
          sizeBytes: 1,
          createdAt: OLD,
        },
        select: { id: true, storageKey: true },
      });
      // Un video sin publicar (abandonado) y su portada: el video se va primero.
      const video = await db.media.create({
        data: {
          ownerId: user.id,
          kind: "VIDEO",
          storageKey: `videos/test/${randomUUID()}.mp4`,
          mimeType: "video/mp4",
          width: 180,
          height: 320,
          sizeBytes: 1,
          durationMs: 2000,
          posterId: poster.id,
          createdAt: OLD,
        },
        select: { id: true, storageKey: true },
      });
      const deleted: string[] = [];
      const storage = { delete: vi.fn(async (key: string) => void deleted.push(key)) };

      await deleteOrphanMedia(db, storage, { now: NOW });
      expect(deleted).toContain(video.storageKey);
      expect(deleted).not.toContain(poster.storageKey);
      expect(await db.media.findUnique({ where: { id: poster.id } })).not.toBeNull();

      await deleteOrphanMedia(db, storage, { now: NOW });
      expect(deleted).toContain(poster.storageKey);
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
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

  it("una foto que se está guardando como comprobante (bloqueada) no se borra, ni al revés", async () => {
    const { db: appDb } = await import("@/server/db");
    const { lockPrivateReadyMedia } = await import("@/modules/trust/queries");
    const user = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    const photo = await db.media.create({
      data: {
        ownerId: user.id,
        storageKey: `images/test/bloqueada-${randomUUID()}.webp`,
        mimeType: "image/webp",
        width: 1,
        height: 1,
        sizeBytes: 1,
        createdAt: OLD,
      },
      select: { id: true, storageKey: true },
    });
    const deletedFiles: string[] = [];
    const storage = { delete: async (key: string) => void deletedFiles.push(key) };
    const gate = () => {
      let open!: () => void;
      const opened = new Promise<void>((resolve) => (open = resolve));
      return { open, opened };
    };

    // 1) `submitProof` la bloquea (FOR UPDATE) y el recolector corre a la vez: la salta.
    const locked = gate();
    const release = gate();
    const saving = appDb.$transaction(
      async (tx) => {
        const count = await lockPrivateReadyMedia(tx, user.id, [photo.id]);
        locked.open();
        await release.opened;
        return count;
      },
      { timeout: 20_000 },
    );
    await locked.opened;
    await expect(deleteOrphanMedia(db, storage, { now: NOW })).resolves.toEqual({
      deleted: 0,
      failedFiles: [],
    });
    release.open();
    await expect(saving).resolves.toBe(1);

    // 2) El recolector la borra primero (sin confirmar): el comprobante espera y ya no la encuentra.
    const deletedRow = gate();
    const commit = gate();
    const collecting = db.$transaction(
      async (tx) => {
        await tx.$executeRaw`DELETE FROM "media" WHERE "id" = ${photo.id}::uuid`;
        deletedRow.open();
        await commit.opened;
      },
      { timeout: 20_000 },
    );
    await deletedRow.opened;
    const waiting = appDb.$transaction((tx) => lockPrivateReadyMedia(tx, user.id, [photo.id]), {
      timeout: 20_000,
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    commit.open();
    await collecting;
    await expect(waiting).resolves.toBe(0);
    await appDb.$disconnect();
  });

  it("un comprobante confirmado después de elegir candidatas se vuelve a comprobar antes de borrar", async () => {
    // La carrera que un DELETE de una sola sentencia no veía: sus condiciones usan la foto de la base
    // del inicio de la sentencia, y un comprobante confirmado entre esa foto y el candado (ya libre)
    // no contaba. Aquí el comprobante se guarda entre los dos pasos, desde otra conexión.
    const other = createPrismaClient(databaseUrl!);
    const raceEmail = `e2e.int.${randomUUID().slice(0, 8)}@example.com`;
    const user = await db.user.create({
      data: {
        name: "Prueba carrera",
        email: raceEmail,
        sellerProfile: { create: { displayName: "Tienda carrera" } },
      },
      select: { id: true, sellerProfile: { select: { id: true } } },
    });
    const category = await db.category.create({
      data: { slug: `orphans-race-${randomUUID().slice(0, 8)}`, name: "Prueba carrera" },
      select: { id: true },
    });
    try {
      const photo = await db.media.create({
        data: {
          ownerId: user.id,
          storageKey: `images/test/carrera-${randomUUID()}.webp`,
          mimeType: "image/webp",
          width: 1,
          height: 1,
          sizeBytes: 1,
          createdAt: OLD,
        },
        select: { id: true },
      });
      const product = await db.product.create({
        data: {
          sellerId: user.sellerProfile!.id,
          categoryId: category.id,
          slug: `carrera-${randomUUID()}`,
          title: "Con comprobante recién enviado",
          description: "Prueba del recolector",
          priceCents: 100_000,
          city: "Ciudad de México",
          state: "CDMX",
          authenticityCheck: {
            create: { riskLevel: "HIGH", score: 0.7, signals: [], status: "NEEDS_PROOF" },
          },
        },
        select: { id: true },
      });
      const cutoff = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);

      const deleted = await db.$transaction(
        async (tx) => {
          const locked = await lockOrphanBatch(tx, cutoff, 500);
          expect(locked).toContain(photo.id);
          // Entre los dos pasos (la fila de `media` no se toca: no espera el candado).
          await other.authenticityCheck.update({
            where: { productId: product.id },
            data: { proofMediaIds: [photo.id], status: "PROOF_SUBMITTED" },
          });
          // Solo esta foto: las demás candidatas de la tanda se liberan al terminar.
          return deleteLockedOrphans(tx, [photo.id]);
        },
        { isolationLevel: "ReadCommitted", timeout: 20_000 },
      );

      expect(deleted).toEqual([]);
      await expect(db.media.count({ where: { id: photo.id } })).resolves.toBe(1);
    } finally {
      await db.product.deleteMany({ where: { categoryId: category.id } });
      await db.category.delete({ where: { id: category.id } });
      await db.user.deleteMany({ where: { email: raceEmail } });
      await other.$disconnect();
    }
  });
});
