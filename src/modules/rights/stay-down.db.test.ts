import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPrismaClient } from "@/server/db-client";
import { blockMediaHashes, isBlockedHash } from "./stay-down";

/**
 * Integración contra la base de desarrollo (`pnpm db:start`): `skipDuplicates` es un
 * `ON CONFLICT DO NOTHING` que solo PostgreSQL prueba de verdad. Huellas al azar (nunca chocan con
 * archivos reales) y todo se borra al terminar.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

const randomHash = () => createHash("sha256").update(randomUUID()).digest("hex");

describe.skipIf(!databaseUrl)("blockMediaHashes contra PostgreSQL", () => {
  const db = createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base");
  const email = `e2e.fix.${randomUUID().slice(0, 8)}@example.com`;
  const photo = randomHash();
  const poster = randomHash();
  const video = randomHash();
  const raced = randomHash();
  const noticed = randomHash();
  const noticeIds: string[] = [];
  let ownerId = "";

  beforeAll(async () => {
    ownerId = (await db.user.create({ data: { name: "Prueba", email }, select: { id: true } })).id;
  });

  afterAll(async () => {
    await db.blockedMediaHash.deleteMany({
      where: { sha256: { in: [photo, poster, video, raced, noticed] } },
    });
    await db.rightsNotice.deleteMany({ where: { id: { in: noticeIds } } });
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  });

  const media = (label: string, sha256: string | null, extra: object = {}) =>
    db.media.create({
      data: {
        ownerId,
        storageKey: `images/test/${label}-${randomUUID()}.webp`,
        mimeType: "image/webp",
        width: 1,
        height: 1,
        sizeBytes: 1,
        sha256,
        ...extra,
      },
      select: { id: true },
    });
  const block = (sha256: string) =>
    db.blockedMediaHash.findUnique({
      where: { sha256 },
      select: { reason: true, noticeId: true },
    });

  it("bloquea una vez cada huella, omite lo que no tiene y se puede repetir sin fallar", async () => {
    const first = await media("foto", photo);
    // La misma foto subida dos veces (otra cuenta, otra publicación): una sola huella.
    const copy = await media("copia", photo);
    const old = await media("anterior", null);
    const posterRow = await media("portada", poster);
    const videoRow = await media("video", video, {
      kind: "VIDEO",
      mimeType: "video/mp4",
      storageKey: `videos/test/${randomUUID()}.mp4`,
      posterId: posterRow.id,
    });

    await expect(isBlockedHash(db, photo)).resolves.toBe(false);
    await expect(
      blockMediaHashes(db, [first.id, copy.id, old.id, videoRow.id], "INTIMATE_WITHOUT_CONSENT"),
    ).resolves.toBe(2);
    await expect(isBlockedHash(db, photo)).resolves.toBe(true);
    await expect(isBlockedHash(db, video)).resolves.toBe(true);
    // La portada (un cuadro que saca el navegador) solo se bloquea si se pide por su cuenta.
    await expect(isBlockedHash(db, poster)).resolves.toBe(false);

    // Otra vez (también dentro de una transacción): ni repite ni falla, y un motivo menor no le
    // quita el suyo a lo ya bloqueado.
    await expect(blockMediaHashes(db, [first.id], "MODERATION")).resolves.toBe(0);
    await expect(
      db.$transaction((tx) => blockMediaHashes(tx, [first.id, videoRow.id], "MODERATION")),
    ).resolves.toBe(0);
    const rows = await db.blockedMediaHash.findMany({
      where: { sha256: { in: [photo, poster, video] } },
      select: { reason: true, noticeId: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.reason === "INTIMATE_WITHOUT_CONSENT")).toBe(true);
    expect(rows.every((row) => row.noticeId === null)).toBe(true);

    // Dos retiros del mismo archivo a la vez: uno lo bloquea y el otro no falla.
    const racedRow = await media("carrera", raced);
    const counts = await Promise.all([
      blockMediaHashes(db, [racedRow.id], "RIGHTS_NOTICE"),
      blockMediaHashes(db, [racedRow.id], "RIGHTS_NOTICE"),
    ]);
    expect(counts.sort()).toEqual([0, 1]);
  });

  it("restaurar un aviso nunca desbloquea lo que también se retiró por menores", async () => {
    const notice = await db.rightsNotice.create({
      data: {
        kind: "COPYRIGHT",
        claimantName: "Prueba",
        claimantEmail: email,
        claimantRole: "OWNER",
        workDescription: "Una foto",
        rightDescription: "La tomé yo",
        urls: [],
        swornStatement: true,
        penaltyAcknowledged: true,
      },
      select: { id: true },
    });
    noticeIds.push(notice.id);
    const row = await media("aviso", noticed);

    await expect(blockMediaHashes(db, [row.id], "RIGHTS_NOTICE", notice.id)).resolves.toBe(1);
    await expect(block(noticed)).resolves.toEqual({
      reason: "RIGHTS_NOTICE",
      noticeId: notice.id,
    });

    await expect(blockMediaHashes(db, [row.id], "CHILD_SAFETY")).resolves.toBe(0);
    await expect(block(noticed)).resolves.toEqual({ reason: "CHILD_SAFETY", noticeId: null });

    // El contra-aviso procede y se quitan las huellas del aviso: esta sigue bloqueada.
    await db.blockedMediaHash.deleteMany({ where: { noticeId: notice.id } });
    await expect(isBlockedHash(db, noticed)).resolves.toBe(true);

    // Otro aviso o una moderación después no la bajan de motivo.
    await blockMediaHashes(db, [row.id], "RIGHTS_NOTICE", notice.id);
    await blockMediaHashes(db, [row.id], "MODERATION");
    await expect(block(noticed)).resolves.toEqual({ reason: "CHILD_SAFETY", noticeId: null });
  });
});
