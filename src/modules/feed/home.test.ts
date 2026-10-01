import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./queries", () => ({
  listCommunitiesInOrder: vi.fn(),
  listJoinedCommunities: vi.fn(),
  findOnboardingIntentQuery: vi.fn(),
  findCommunityJoinState: vi.fn(),
  listRecentCommunityPostIds: vi.fn(),
}));
vi.mock("@/modules/social/post-queries", () => ({ hydratePosts: vi.fn(async () => []) }));

const queries = await import("./queries");
const { firstNameOf, getMoreFromCommunity, getWelcomeMoment } = await import("./home");

const community = (slug: string) => ({
  id: `id-${slug}`,
  slug,
  name: slug,
  emoji: "⭐",
  hue: 10,
});
const all = ["humor", "gaming", "tecnologia", "comida", "musica", "deportes", "mascotas"].map(
  community,
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(queries.listCommunitiesInOrder).mockResolvedValue(all);
});

describe("getWelcomeMoment", () => {
  it("saluda por el primer nombre, con sus comunidades y la búsqueda declarada", async () => {
    vi.mocked(queries.listJoinedCommunities).mockResolvedValue([community("gaming")]);
    vi.mocked(queries.findOnboardingIntentQuery).mockResolvedValue({ query: "tenis para correr" });

    const moment = await getWelcomeMoment("viewer-2", "  Sofía Ramírez ");

    expect(moment).toEqual({
      firstName: "Sofía",
      communities: [community("gaming")],
      query: "tenis para correr",
    });
  });

  it("sin búsqueda declarada no hay chip «Buscando»", async () => {
    vi.mocked(queries.listJoinedCommunities).mockResolvedValue([]);
    vi.mocked(queries.findOnboardingIntentQuery).mockResolvedValue(null);

    expect((await getWelcomeMoment("viewer-3", "Ana")).query).toBeNull();
    expect(firstNameOf("Ana")).toBe("Ana");
  });
});

describe("getMoreFromCommunity", () => {
  it("hasta 5 recientes de la comunidad, sin la publicación que se está viendo", async () => {
    vi.mocked(queries.findCommunityJoinState).mockResolvedValue({ id: "id-gaming", joined: true });
    vi.mocked(queries.listRecentCommunityPostIds).mockResolvedValue([]);

    const more = await getMoreFromCommunity("gaming", "post-1", "viewer-4");

    expect(queries.listRecentCommunityPostIds).toHaveBeenCalledWith(
      "id-gaming",
      expect.objectContaining({ excludePostId: "post-1", limit: 5 }),
    );
    expect(more).toEqual({ communityId: "id-gaming", joined: true, posts: [] });
  });

  it("si la comunidad ya no existe, no hay sección", async () => {
    vi.mocked(queries.findCommunityJoinState).mockResolvedValue(null);

    await expect(getMoreFromCommunity("borrada", "post-1", null)).resolves.toBeNull();
  });
});
