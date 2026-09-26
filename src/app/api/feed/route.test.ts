import { beforeEach, describe, expect, it, vi } from "vitest";

const getFeed = vi.fn();
const getViewer = vi.fn();
const findCommunity = vi.fn();
const trackImpressions = vi.fn();

vi.mock("@/modules/feed/engine", () => ({ recommendationEngine: { getFeed } }));
vi.mock("@/modules/feed/impressions", () => ({ trackImpressions }));
vi.mock("@/modules/identity/session", () => ({ getViewer }));
vi.mock("@/server/db", () => ({ db: { community: { findUnique: findCommunity } } }));

const { GET } = await import("./route");

const request = (query: string) => new Request(`http://localhost/api/feed?${query}`);
const PAGE = { items: [], nextCursor: null };

beforeEach(() => {
  vi.clearAllMocks();
  getFeed.mockResolvedValue(PAGE);
  getViewer.mockResolvedValue(null);
});

describe("GET /api/feed", () => {
  it("«Siguiendo» sin sesión: 401 sin calcular nada", async () => {
    const response = await GET(request("following=1"));

    expect(response.status).toBe(401);
    expect(getFeed).not.toHaveBeenCalled();
  });

  it("«Siguiendo» con sesión pide solo a quienes sigue, sin caché compartida", async () => {
    getViewer.mockResolvedValue({ userId: "u1" });

    const response = await GET(request("following=1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getFeed).toHaveBeenCalledWith({
      viewerId: "u1",
      cursor: undefined,
      communityId: undefined,
      following: true,
    });
    expect(trackImpressions).toHaveBeenCalledWith([], "u1", "FEED");
  });

  it("una comunidad por slug: 404 si no existe; con forma inválida, 400", async () => {
    findCommunity.mockResolvedValue(null);
    expect((await GET(request("community=no-existe"))).status).toBe(404);
    expect((await GET(request("community=Gaming%20%3B"))).status).toBe(400);
    expect((await GET(request("following=true"))).status).toBe(400);
    expect(getFeed).not.toHaveBeenCalled();
  });

  it("una comunidad que existe filtra por su id", async () => {
    findCommunity.mockResolvedValue({ id: "c1" });

    await GET(request("community=gaming&cursor=abc"));

    expect(getFeed).toHaveBeenCalledWith({
      viewerId: null,
      cursor: "abc",
      communityId: "c1",
      following: false,
    });
  });
});
