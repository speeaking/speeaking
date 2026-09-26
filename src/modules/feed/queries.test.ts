import { beforeEach, describe, expect, it, vi } from "vitest";

// Solo interesa la consulta que se arma: Prisma se simula.
vi.mock("@/server/db", () => ({ db: { post: { findMany: vi.fn(async () => []) } } }));

const { db } = await import("@/server/db");
const { loadCandidates } = await import("./queries");

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
