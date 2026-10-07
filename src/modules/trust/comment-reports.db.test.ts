import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Reportes de comentarios y cola urgente contra la base de desarrollo (`pnpm db:start`, ADR-076):
 * un comentario se reporta como tal (no pesa en ningún producto), ocultarlo y restaurarlo ajusta el
 * contador de su publicación una sola vez, y los reportes urgentes se leen antes que los demás. Usa
 * cuentas `e2e.fix.cmtrep*@example.com` propias y las borra al final.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

vi.mock("@/server/db", async () => {
  const { createPrismaClient } = await import("@/server/db-client");
  return { db: createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base") };
});
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ publicUrl: (key: string) => `/media/${key}` }),
}));

const { db } = await import("@/server/db");
const q = await import("./queries");

const tag = randomUUID().slice(0, 8);
const emails = ["author", "reporter"].map((who) => `e2e.fix.cmtrep${who}${tag}@example.com`);
let ids: { author: string; reporter: string; post: string; comment: string };

async function account(email: string, username: string) {
  const user = await db.user.create({
    data: {
      name: "Prueba comentarios",
      email,
      profile: { create: { username, displayName: username, onboardedAt: new Date() } },
    },
    select: { id: true },
  });
  return user.id;
}

function commentCount() {
  return db.post
    .findUniqueOrThrow({ where: { id: ids.post }, select: { commentCount: true } })
    .then((post) => post.commentCount);
}

describe.skipIf(!databaseUrl)("reportes de comentarios contra PostgreSQL", () => {
  beforeAll(async () => {
    const author = await account(emails[0]!, `e2e.fix.cmtrepa${tag}`);
    const reporter = await account(emails[1]!, `e2e.fix.cmtrepr${tag}`);
    const post = await db.post.create({
      data: { authorId: author, body: `Publicación ${tag}`, commentCount: 1 },
      select: { id: true },
    });
    const comment = await db.comment.create({
      data: { postId: post.id, authorId: author, body: `Comentario ${tag}` },
      select: { id: true },
    });
    ids = { author, reporter, post: post.id, comment: comment.id };
  });

  afterAll(async () => {
    if (ids) {
      await db.report.deleteMany({ where: { targetId: { in: [ids.post, ids.comment] } } });
    }
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.$disconnect();
  });

  it("el comentario es de su autor, visible y sin producto", async () => {
    await expect(q.findReportTarget("COMMENT", ids.comment)).resolves.toEqual({
      ownerUserId: ids.author,
      visible: true,
      productId: null,
    });
    await expect(q.findReportTarget("COMMENT", randomUUID())).resolves.toBeNull();
  });

  it("ocultar y restaurar cambia el estado y el contador una sola vez", async () => {
    await expect(
      db.$transaction((tx) => q.setCommentModeration(tx, ids.comment, true)),
    ).resolves.toEqual({ count: 1 });
    expect(await commentCount()).toBe(0);
    await expect(q.findReportTarget("COMMENT", ids.comment)).resolves.toMatchObject({
      visible: false,
    });

    // Repetir no vuelve a restar.
    await expect(
      db.$transaction((tx) => q.setCommentModeration(tx, ids.comment, true)),
    ).resolves.toEqual({ count: 0 });
    expect(await commentCount()).toBe(0);

    await expect(
      db.$transaction((tx) => q.setCommentModeration(tx, ids.comment, false)),
    ).resolves.toEqual({ count: 1 });
    expect(await commentCount()).toBe(1);
    await expect(
      db.comment.findUniqueOrThrow({ where: { id: ids.comment }, select: { status: true } }),
    ).resolves.toEqual({ status: "PUBLISHED" });
  });

  it("los reportes urgentes se leen antes que los demás aunque sean más nuevos", async () => {
    const old = await db.report.create({
      data: {
        reporterId: ids.reporter,
        targetType: "POST",
        targetId: ids.post,
        reason: "SPAM",
        createdAt: new Date(Date.now() - 86_400_000),
      },
      select: { id: true },
    });
    const urgent = await db.report.create({
      data: {
        reporterId: ids.reporter,
        targetType: "COMMENT",
        targetId: ids.comment,
        reason: "INTIMATE_WITHOUT_CONSENT",
      },
      select: { id: true },
    });

    const order = (await q.listOpenReports()).map((report) => report.id);

    expect(order).toContain(old.id);
    expect(order.indexOf(urgent.id)).toBeGreaterThanOrEqual(0);
    expect(order.indexOf(urgent.id)).toBeLessThan(order.indexOf(old.id));
  });
});
