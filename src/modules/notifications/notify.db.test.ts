import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Avisos (ADR-059) contra la base de desarrollo (`pnpm db:start`): una reacción por persona y
 * publicación, quitar la reacción quita el aviso, nadie se avisa a sí mismo, lo retirado por
 * moderación deja de contar, abrir la campana los marca leídos y la retención borra los viejos. Crea
 * cuentas `e2e.fix.avisos*@example.com` y las borra al final.
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

const { db } = await import("@/server/db");
const notify = await import("./notify");
const {
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
  deleteOldNotifications,
} = await import("./queries");

const RUN = randomUUID().slice(0, 8);
const ids = { author: "", fan: "", post: "" };

async function createUser(tag: string) {
  const user = await db.user.create({
    data: { name: `Avisos ${tag}`, email: `e2e.fix.avisos.${RUN}.${tag}@example.com` },
    select: { id: true },
  });
  await db.profile.create({
    data: {
      userId: user.id,
      username: `e2e.fix.avisos.${RUN}.${tag}`,
      displayName: `Avisos ${tag}`,
      onboardedAt: new Date(),
    },
  });
  return user.id;
}

describe.skipIf(!databaseUrl)("avisos contra PostgreSQL", () => {
  beforeAll(async () => {
    ids.author = await createUser("autora");
    ids.fan = await createUser("fan");
    ids.post = (
      await db.post.create({
        data: { authorId: ids.author, body: "Mi cocina nueva" },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: [ids.author, ids.fan].filter(Boolean) } } });
    await db.$disconnect();
  });

  it("una reacción por persona y publicación: cambiarla no la duplica; quitarla la quita", async () => {
    await notify.notifyReaction({
      recipientId: ids.author,
      actorId: ids.fan,
      postId: ids.post,
      reaction: "LIKE",
    });
    await notify.notifyReaction({
      recipientId: ids.author,
      actorId: ids.fan,
      postId: ids.post,
      reaction: "HAHA",
    });

    const rows = await db.notification.findMany({ where: { recipientId: ids.author } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "REACTION", reaction: "HAHA", readAt: null });

    await notify.removeReactionNotification({ actorId: ids.fan, postId: ids.post });
    expect(await db.notification.count({ where: { recipientId: ids.author } })).toBe(0);
  });

  it("nadie recibe avisos de lo que hizo él mismo", async () => {
    await notify.notifyFollow({ recipientId: ids.author, actorId: ids.author });
    await notify.notifyReaction({
      recipientId: ids.author,
      actorId: ids.author,
      postId: ids.post,
      reaction: "LIKE",
    });

    expect(await db.notification.count({ where: { recipientId: ids.author } })).toBe(0);
  });

  it("la campana cuenta lo nuevo y lo visible; abrirla lo marca leído", async () => {
    await notify.notifyFollow({ recipientId: ids.author, actorId: ids.fan });
    await notify.notifyFollow({ recipientId: ids.author, actorId: ids.fan });
    const comment = await db.comment.create({
      data: { postId: ids.post, authorId: ids.fan, body: "¡Qué bonita quedó!" },
      select: { id: true },
    });
    await notify.notifyComment({
      recipientId: ids.author,
      actorId: ids.fan,
      postId: ids.post,
      commentId: comment.id,
    });

    expect(await countUnreadNotifications(ids.author)).toBe(2);
    const rows = await listNotifications(ids.author);
    expect(rows.map((row) => row.type).sort()).toEqual(["COMMENT", "FOLLOW"]);
    expect(rows.find((row) => row.type === "COMMENT")).toMatchObject({
      commentExcerpt: "¡Qué bonita quedó!",
      postExcerpt: "Mi cocina nueva",
      actor: { displayName: "Avisos fan" },
    });

    // Un comentario retirado por moderación deja de avisar.
    await db.comment.update({ where: { id: comment.id }, data: { status: "REMOVED" } });
    expect(await countUnreadNotifications(ids.author)).toBe(1);

    expect(await markNotificationsRead(ids.author)).toBe(2);
    expect(await countUnreadNotifications(ids.author)).toBe(0);
  });

  it("la operación diaria borra los avisos de más de 90 días", async () => {
    const old = await db.notification.create({
      data: {
        recipientId: ids.author,
        actorId: ids.fan,
        type: "FOLLOW",
        createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    });

    expect(await deleteOldNotifications()).toBeGreaterThanOrEqual(1);
    expect(await db.notification.findUnique({ where: { id: old.id } })).toBeNull();
  });
});
