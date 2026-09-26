import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * `/media` contra la base de desarrollo (`pnpm db:start`): la consulta real decide qué es público
 * (SEC-14). Una foto solo en una publicación oculta o retirada deja de ser pública.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

const getSession = vi.hoisted(() => vi.fn());
vi.mock("@/modules/identity/session", () => ({ getSession }));
vi.mock("@/server/db", async () => {
  const { createPrismaClient } = await import("@/server/db-client");
  return { db: createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base") };
});
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({
    get: async () => ({ data: Buffer.from("webp"), contentType: "image/webp" }),
  }),
}));

const { db } = await import("@/server/db");
const { GET } = await import("./route");

function request(key: string) {
  return GET(new Request(`http://localhost/media/${key}`), {
    params: Promise.resolve({ key: key.split("/") }),
  } as RouteContext<"/media/[...key]">);
}

describe.skipIf(!databaseUrl)("GET /media contra PostgreSQL (SEC-14)", () => {
  const email = `e2e.fix.${randomUUID().slice(0, 8)}@example.com`;

  afterAll(async () => {
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  });

  it("pública solo mientras la publicación está publicada; oculta, solo para su dueño", async () => {
    const user = await db.user.create({ data: { name: "Prueba", email }, select: { id: true } });
    const media = await db.media.create({
      data: {
        ownerId: user.id,
        storageKey: `images/test/${randomUUID()}.webp`,
        mimeType: "image/webp",
        width: 1,
        height: 1,
        sizeBytes: 1,
      },
      select: { id: true, storageKey: true },
    });
    const post = await db.post.create({
      data: {
        authorId: user.id,
        body: "prueba de /media",
        media: { create: [{ mediaId: media.id }] },
      },
      select: { id: true },
    });
    getSession.mockResolvedValue(null);

    const published = await request(media.storageKey);
    expect(published.status).toBe(200);
    expect(published.headers.get("Cache-Control")).toBe("public, max-age=86400");

    await db.post.update({ where: { id: post.id }, data: { status: "REMOVED" } });
    expect((await request(media.storageKey)).status).toBe(404);

    getSession.mockResolvedValue({ user: { id: user.id } });
    const asOwner = await request(media.storageKey);
    expect(asOwner.status).toBe(200);
    expect(asOwner.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
