import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FEED_POLICY } from "./policy";
import type { Candidate, ViewerContext } from "./ranking";

// El motor decide; la base de datos (consultas, política y DTOs) se simula.
vi.mock("./queries", () => ({
  EMPTY_CONTEXT: {
    communityIds: new Set(),
    followingIds: new Set(),
    categoryIntent: new Map(),
    viewedCategoryIds: new Set(),
    intentQueries: [],
  },
  loadCandidates: vi.fn(),
  loadViewerContext: vi.fn(),
}));
vi.mock("@/modules/platform/settings", () => ({
  getFeedPolicy: vi.fn(async () => DEFAULT_FEED_POLICY),
}));
vi.mock("@/modules/social/post-queries", () => ({ hydratePosts: vi.fn() }));

const queries = await import("./queries");
const { hydratePosts } = await import("@/modules/social/post-queries");
const { recommendationEngine } = await import("./engine");

const VIEWER = "0199a000-0000-7000-8000-00000000000a";
const FRIEND = "0199a000-0000-7000-8000-00000000000b";

function context(followingIds: string[]): ViewerContext {
  return {
    communityIds: new Set(),
    followingIds: new Set(followingIds),
    categoryIntent: new Map(),
    viewedCategoryIds: new Set(),
    intentQueries: [],
  };
}

function candidate(id: string, authorId: string): Candidate {
  return {
    id,
    authorId,
    communityId: null,
    categoryId: null,
    isCommerce: false,
    productText: "",
    publishedAt: new Date(),
    likeCount: 0,
    commentCount: 0,
    saveCount: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(hydratePosts).mockImplementation(
    async (ids) =>
      ids.map((id) => ({
        id,
        product: null,
        viewer: { liked: false, saved: false, withinBudget: false },
      })) as never,
  );
});

describe("RecommendationEngine: «Siguiendo»", () => {
  it("solo pide publicaciones de las personas que sigue quien ve", async () => {
    vi.mocked(queries.loadViewerContext).mockResolvedValue(context([FRIEND]));
    vi.mocked(queries.loadCandidates).mockResolvedValue([candidate("p1", FRIEND)]);

    const page = await recommendationEngine.getFeed({ viewerId: VIEWER, following: true });

    expect(queries.loadCandidates).toHaveBeenCalledTimes(1);
    expect(vi.mocked(queries.loadCandidates).mock.calls[0]![1]).toEqual({
      communityId: undefined,
      authorIds: [FRIEND],
    });
    expect(page.items.map((item) => item.id)).toEqual(["p1"]);
  });

  it("si no sigue a nadie, la página viene vacía y no se rellena con otras publicaciones", async () => {
    vi.mocked(queries.loadViewerContext).mockResolvedValue(context([]));

    const page = await recommendationEngine.getFeed({ viewerId: VIEWER, following: true });

    expect(queries.loadCandidates).not.toHaveBeenCalled();
    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it("sin sesión no hay «Siguiendo»: página vacía sin consultar nada", async () => {
    const page = await recommendationEngine.getFeed({ viewerId: null, following: true });

    expect(queries.loadViewerContext).not.toHaveBeenCalled();
    expect(queries.loadCandidates).not.toHaveBeenCalled();
    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it("sin el filtro, el feed no se limita a quienes sigue", async () => {
    vi.mocked(queries.loadViewerContext).mockResolvedValue(context([FRIEND]));
    vi.mocked(queries.loadCandidates).mockResolvedValue([]);

    await recommendationEngine.getFeed({ viewerId: VIEWER, communityId: "c1" });

    expect(vi.mocked(queries.loadCandidates).mock.calls[0]![1]).toEqual({ communityId: "c1" });
  });
});

describe("RecommendationEngine: experimentos del motor de automejora", () => {
  it("pide la política de quien ve (la variante de su experimento) y sin sesión la vigente", async () => {
    const { getFeedPolicy } = await import("@/modules/platform/settings");
    vi.mocked(queries.loadViewerContext).mockResolvedValue(context([]));
    vi.mocked(queries.loadCandidates).mockResolvedValue([candidate("p1", FRIEND)]);

    await recommendationEngine.getFeed({ viewerId: VIEWER });
    expect(getFeedPolicy).toHaveBeenLastCalledWith(VIEWER);

    await recommendationEngine.getFeed({ viewerId: null });
    expect(getFeedPolicy).toHaveBeenLastCalledWith(null);
  });
});
