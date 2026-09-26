import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integración contra la base de desarrollo (`pnpm db:start`): una impresión visible solo cuenta si
 * la pieza se le sirvió a quien la reporta, una vez por persona, publicación y día, y sin
 * personalización se guarda anónima (T5, ADR-037, SEC-16). Crea cuentas `e2e.fix.*@example.com` y
 * publicaciones propias, y las borra al final (con sus eventos).
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
vi.mock("@/server/env", () => ({
  env: { BETTER_AUTH_SECRET: "s".repeat(32), TRUSTED_PROXY_HOPS: 0, NODE_ENV: "test" },
}));

const { db } = await import("@/server/db");
const { rateLimit } = await import("@/server/rate-limit");
const { servedImpressionKey } = await import("./integrity");
const { recordVisibleImpressions } = await import("./visible-impressions");

const tag = randomUUID().slice(0, 8);
const users: Record<"author" | "viewer" | "optedOut", string> = {
  author: "",
  viewer: "",
  optedOut: "",
};
const posts: Record<
  "served" | "notServed" | "old" | "own" | "anonymous" | "optOut" | "burst",
  string
> = {
  served: "",
  notServed: "",
  old: "",
  own: "",
  anonymous: "",
  optOut: "",
  burst: "",
};
const HOUR = 60 * 60 * 1000;

async function createUser(suffix: string, personalizationEnabled = true) {
  const user = await db.user.create({
    data: { name: "Prueba Visibles", email: `e2e.fix.${tag}${suffix}@example.com` },
    select: { id: true },
  });
  await db.profile.create({
    data: {
      userId: user.id,
      username: `e2e.fix.${tag}${suffix}`,
      displayName: "Prueba Visibles",
      onboardedAt: new Date(),
      personalizationEnabled,
    },
  });
  return user.id;
}

async function createPost(authorId: string) {
  const post = await db.post.create({
    data: { authorId, body: `Prueba de impresiones visibles ${tag}` },
    select: { id: true },
  });
  return post.id;
}

/** La impresión SERVIDA tal como la deja `track` (con persona, o anónima con la hora truncada). */
async function served(postId: string, userId: string | null, createdAt = new Date()) {
  await db.analyticsEvent.create({
    data: {
      type: "IMPRESSION",
      userId,
      entityType: "POST",
      entityId: postId,
      sourcePostId: postId,
      surface: "FEED",
      position: 3,
      score: 0.75,
      algorithmVersion: "v0-explicable",
      metadata: { slot: "commerce" },
      createdAt,
    },
  });
}

const report = (postId: string, position = 7) => ({
  postId,
  surface: "FEED" as const,
  position,
});

function visibleRows(postId: string) {
  return db.analyticsEvent.findMany({
    where: { type: "VISIBLE_IMPRESSION", entityId: postId },
    orderBy: { createdAt: "asc" },
  });
}

describe.skipIf(!databaseUrl)("impresiones visibles contra PostgreSQL (T5)", () => {
  beforeAll(async () => {
    users.author = await createUser("a");
    users.viewer = await createUser("v");
    users.optedOut = await createUser("o", false);
    for (const key of Object.keys(posts) as (keyof typeof posts)[]) {
      posts[key] = await createPost(key === "own" ? users.viewer : users.author);
    }
  });

  afterAll(async () => {
    await db.analyticsEvent.deleteMany({ where: { entityId: { in: Object.values(posts) } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await db.$disconnect();
  });

  it("con personalización: solo lo servido a esa persona, con los datos de lo servido", async () => {
    await served(posts.served, users.viewer, new Date(Date.now() - 10 * 60 * 1000));
    await served(posts.old, users.viewer, new Date(Date.now() - 25 * HOUR));
    // Servida a OTRA persona: no le sirve de comprobante a esta.
    await served(posts.notServed, users.author);

    const outcome = await recordVisibleImpressions({
      viewerId: users.viewer,
      ip: null,
      items: [
        report(posts.served),
        report(posts.notServed),
        report(posts.old),
        report(posts.own),
        report(randomUUID()),
      ],
    });
    expect(outcome).toEqual({ recorded: 1, duplicates: 0, rejected: 4, failed: 0 });

    const [row, ...rest] = await visibleRows(posts.served);
    expect(rest).toHaveLength(0);
    expect(row).toMatchObject({
      userId: users.viewer,
      entityType: "POST",
      sourcePostId: posts.served,
      surface: "FEED",
      // De lo servido, no del navegador (que dijo 7).
      position: 3,
      score: 0.75,
      algorithmVersion: "v0-explicable",
      metadata: { slot: "commerce" },
    });
    for (const postId of [posts.notServed, posts.old, posts.own]) {
      expect(await visibleRows(postId)).toHaveLength(0);
    }
  });

  it("una por persona, publicación y día (aunque la mande otra vez)", async () => {
    const again = await recordVisibleImpressions({
      viewerId: users.viewer,
      ip: null,
      items: [report(posts.served), report(posts.served)],
    });
    expect(again).toEqual({ recorded: 0, duplicates: 1, rejected: 0, failed: 0 });
    expect(await visibleRows(posts.served)).toHaveLength(1);
  });

  it("sin personalización: exige el comprobante de lo servido y se guarda anónima", async () => {
    const at = new Date();
    await served(posts.optOut, null, new Date(Math.floor(at.getTime() / HOUR) * HOUR));
    const withoutReceipt = await recordVisibleImpressions({
      viewerId: users.optedOut,
      ip: null,
      items: [report(posts.optOut)],
    });
    expect(withoutReceipt).toEqual({ recorded: 0, duplicates: 0, rejected: 1, failed: 0 });

    // La cubeta que deja `track` al servirle la pieza (se sirvió en la última hora).
    await rateLimit({
      key: servedImpressionKey(`user:${users.optedOut}`, posts.optOut),
      limit: 1,
      windowSeconds: 60 * 60,
    });
    const outcome = await recordVisibleImpressions({
      viewerId: users.optedOut,
      ip: null,
      items: [report(posts.optOut, 4)],
    });
    expect(outcome).toEqual({ recorded: 1, duplicates: 0, rejected: 0, failed: 0 });
    const [row] = await visibleRows(posts.optOut);
    expect(row).toMatchObject({ userId: null, anonymousId: null, position: 4, score: null });
    expect(row?.metadata).toEqual({ slot: "commerce" });
    expect(row!.createdAt.getTime() % HOUR).toBe(0);
  });

  it("sin sesión ni IP: nunca más visibles que servidas", async () => {
    await served(posts.anonymous, null);
    await served(posts.anonymous, null);
    const results = [];
    for (let i = 0; i < 3; i++) {
      results.push(
        await recordVisibleImpressions({
          viewerId: null,
          ip: null,
          items: [report(posts.anonymous)],
        }),
      );
    }
    expect(results.map((result) => result.recorded)).toEqual([1, 1, 0]);
    expect(results[2]?.rejected).toBe(1);
    const rows = await visibleRows(posts.anonymous);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.userId === null)).toBe(true);
  });

  it("sin sesión ni IP: tampoco con peticiones simultáneas (el conteo no se lee dos veces)", async () => {
    await served(posts.burst, null);
    await served(posts.burst, null);
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        recordVisibleImpressions({ viewerId: null, ip: null, items: [report(posts.burst)] }),
      ),
    );
    const recorded = results.reduce((sum, result) => sum + result.recorded, 0);
    expect(recorded).toBeLessThanOrEqual(2);
    expect(results.every((result) => result.failed === 0)).toBe(true);
    expect((await visibleRows(posts.burst)).length).toBeLessThanOrEqual(2);
  });
});
