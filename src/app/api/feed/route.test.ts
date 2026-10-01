import { beforeEach, describe, expect, it, vi } from "vitest";

const getFeed = vi.fn();
const getViewer = vi.fn();
const findCommunity = vi.fn();
const trackImpressions = vi.fn();
const pickFeedProducts = vi.fn(async () => null);
const checkSocialLimit = vi.fn();

vi.mock("@/modules/feed/engine", () => ({ recommendationEngine: { getFeed } }));
vi.mock("@/modules/feed/impressions", () => ({ trackImpressions }));
vi.mock("@/modules/feed/product-carousel", () => ({ pickFeedProducts }));
vi.mock("@/modules/identity/session", () => ({ getViewer }));
vi.mock("@/modules/social/limits", () => ({ checkSocialLimit }));
vi.mock("@/server/db", () => ({ db: { community: { findUnique: findCommunity } } }));

const { GET } = await import("./route");
const { encodeCursor } = await import("@/modules/feed/ranking");

const request = (query: string) => new Request(`http://localhost/api/feed?${query}`);
const PAGE = { items: [], nextCursor: null };

beforeEach(() => {
  vi.clearAllMocks();
  getFeed.mockResolvedValue(PAGE);
  getViewer.mockResolvedValue(null);
  checkSocialLimit.mockResolvedValue({ ok: true });
});

/** Cursor como lo arma el motor: base64url de `{ v, o, t }`. */
const rawCursor = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64url");

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

    const cursor = encodeCursor({ offset: 10, asOf: Date.now() });

    await GET(request(`community=gaming&cursor=${cursor}`));

    expect(getFeed).toHaveBeenCalledWith({
      viewerId: null,
      cursor,
      communityId: "c1",
      following: false,
    });
  });

  it("SEC-31: un cursor inválido o con fecha fuera de rango es 400, no 500", async () => {
    for (const cursor of [
      "abc",
      rawCursor({ v: 1, o: 10, t: 9e15 }),
      rawCursor({ v: 1, o: 10, t: Date.now() + 24 * 60 * 60 * 1000 }),
    ]) {
      const response = await GET(request(`cursor=${cursor}`));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "Cursor inválido." });
    }
    expect(getFeed).not.toHaveBeenCalled();
  });

  it("SEC-15: con el límite agotado responde 429 con Retry-After, sin calcular el feed", async () => {
    getViewer.mockResolvedValue({ userId: "u1" });
    checkSocialLimit.mockResolvedValue({
      ok: false,
      error: "Demasiados intentos.",
      retryAfterSeconds: 42,
    });

    const response = await GET(request(""));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(checkSocialLimit).toHaveBeenCalledWith("feed", "u1");
    expect(getFeed).not.toHaveBeenCalled();
    expect(trackImpressions).not.toHaveBeenCalled();
  });
});
