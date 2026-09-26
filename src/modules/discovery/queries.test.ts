import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  post: { findMany: vi.fn() },
  communityMembership: { findMany: vi.fn() },
}));

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/providers/storage", () => ({ getStorage: () => ({ publicUrl: String }) }));

const queries = await import("./queries");

const VIEWER = "0199a000-0000-7000-8000-00000000000a";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listActiveCommunityPeers («Gente de tus comunidades»)", () => {
  it("sin comunidades no consulta nada", async () => {
    await expect(queries.listActiveCommunityPeers(VIEWER, [])).resolves.toEqual([]);
    expect(db.post.findMany).not.toHaveBeenCalled();
  });

  it("ordena por actividad reciente y con LIMIT, no por antigüedad de la cuenta", async () => {
    db.post.findMany.mockResolvedValue([
      { authorId: "p1" },
      { authorId: "p2" },
      { authorId: "p1" },
    ]);
    db.communityMembership.findMany.mockResolvedValue([{ userId: "m1" }, { userId: "p2" }]);

    const peers = await queries.listActiveCommunityPeers(VIEWER, ["gaming", "tecnologia"]);

    // Primero quien publicó hace poco, después quien se unió hace poco; sin repetir.
    expect(peers).toEqual(["p1", "p2", "m1"]);
    const posts = db.post.findMany.mock.calls[0]![0];
    const memberships = db.communityMembership.findMany.mock.calls[0]![0];
    expect(posts.orderBy[0]).toEqual({ publishedAt: "desc" });
    expect(memberships.orderBy[0]).toEqual({ createdAt: "desc" });
    expect(posts.take).toBeGreaterThan(0);
    expect(memberships.take).toBeGreaterThan(0);
    // Solo publicaciones visibles de tus comunidades, nunca las tuyas.
    expect(posts.where).toMatchObject({
      status: "PUBLISHED",
      communityId: { in: ["gaming", "tecnologia"] },
      authorId: { not: VIEWER },
    });
  });

  it("aplica las exclusiones (editoriales, ocultos, descartados y ya seguidos) en ambas consultas", async () => {
    db.post.findMany.mockResolvedValue([]);
    db.communityMembership.findMany.mockResolvedValue([]);

    await queries.listActiveCommunityPeers(VIEWER, ["gaming"]);

    const eligible = {
      profile: { is: { isEditorial: false, discoverable: true, onboardedAt: { not: null } } },
      dismissedBy: { none: { userId: VIEWER } },
      followers: { none: { followerId: VIEWER } },
    };
    expect(db.post.findMany.mock.calls[0]![0].where.author).toMatchObject(eligible);
    // Quien publica también debe ser miembro de alguna de tus comunidades.
    expect(db.post.findMany.mock.calls[0]![0].where.author.memberships).toEqual({
      some: { communityId: { in: ["gaming"] } },
    });
    expect(db.communityMembership.findMany.mock.calls[0]![0].where.user).toEqual(eligible);
  });

  it("devuelve a lo sumo 50 personas", async () => {
    db.post.findMany.mockResolvedValue(
      Array.from({ length: 80 }, (_, index) => ({ authorId: `p${index}` })),
    );
    db.communityMembership.findMany.mockResolvedValue([]);

    await expect(queries.listActiveCommunityPeers(VIEWER, ["gaming"])).resolves.toHaveLength(50);
  });

  it("ya no existe una consulta de quién dio «me gusta»", () => {
    expect(Object.keys(queries).filter((name) => /like/i.test(name))).toEqual([]);
  });
});
