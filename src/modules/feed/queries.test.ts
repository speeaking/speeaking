import { beforeEach, describe, expect, it, vi } from "vitest";

// Solo interesa la consulta que se arma: Prisma se simula.
vi.mock("@/server/db", () => ({
  db: {
    post: { findMany: vi.fn(async () => []) },
    profile: { findUnique: vi.fn(async () => ({ personalizationEnabled: false })) },
    communityMembership: { findMany: vi.fn(async () => []) },
    follow: { findMany: vi.fn(async () => []) },
    shoppingIntent: { findMany: vi.fn(async () => []) },
  },
}));

const { db } = await import("@/server/db");
const { loadCandidates, loadViewerContext, MAX_FOLLOWING_CONTEXT } = await import("./queries");

const findMany = () => vi.mocked(db.post.findMany);
const where = () => (findMany().mock.calls[0]![0] as { where: Record<string, unknown> }).where;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadCandidates", () => {
  const asOf = new Date("2026-09-25T12:00:00Z");

  it("«Siguiendo»: solo publicaciones de las personas indicadas", async () => {
    await loadCandidates(asOf, { authorIds: ["a", "b"] });

    expect(where().authorId).toEqual({ in: ["a", "b"] });
    expect(where().status).toBe("PUBLISHED");
  });

  it("combina «Siguiendo» con una comunidad", async () => {
    await loadCandidates(asOf, { communityId: "c1", authorIds: ["a"] });

    expect(where()).toMatchObject({ communityId: "c1", authorId: { in: ["a"] } });
  });

  it("sin filtro no limita autor ni comunidad", async () => {
    await loadCandidates(asOf);

    expect(where()).not.toHaveProperty("authorId");
    expect(where()).not.toHaveProperty("communityId");
  });
});

describe("loadViewerContext", () => {
  it("SEC-38: a quién sigue se lee con tope (las más recientes), no sin límite", async () => {
    await loadViewerContext("0199a000-0000-7000-8000-00000000000a", new Date());

    expect(vi.mocked(db.follow.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: MAX_FOLLOWING_CONTEXT, orderBy: { createdAt: "desc" } }),
    );
    expect(MAX_FOLLOWING_CONTEXT).toBeLessThanOrEqual(1000);
  });
});
