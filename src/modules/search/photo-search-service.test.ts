import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAIProvider } from "@/server/providers/ai/mock";

const db = vi.hoisted(() => ({
  aIResponse: { create: vi.fn() },
  aIRequest: { update: vi.fn() },
  $transaction: vi.fn(async (operations: unknown[]) => operations),
}));
const env = vi.hoisted(() => ({
  NODE_ENV: "test",
  TRUSTED_PROXY_HOPS: 0,
  BETTER_AUTH_SECRET: "s".repeat(32),
  AI_VISION_MODEL: undefined as string | undefined,
}));
const reserveAiRequest = vi.hoisted(() => vi.fn());
const isFeatureOn = vi.hoisted(() => vi.fn());
const getAIRoute = vi.hoisted(() => vi.fn());
const providerForRoute = vi.hoisted(() => vi.fn());
const listShopProducts = vi.hoisted(() => vi.fn());
const track = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/env", () => ({ env }));
vi.mock("@/modules/ai/reservation", () => ({ reserveAiRequest }));
vi.mock("@/modules/ai/features-store", () => ({ isFeatureOn }));
vi.mock("@/modules/ai/tasks/availability", () => ({
  simulatedRecord: (provider: string) => provider === "mock",
}));
vi.mock("@/server/providers/ai", () => ({ getAIRoute, providerForRoute }));
vi.mock("@/modules/catalog/queries", () => ({ listShopProducts }));
vi.mock("@/modules/analytics/track", () => ({ track }));

const { searchByPhoto, PHOTO_SEARCH_LIMITS } = await import("./photo-search-service");
const { AIError } = await import("@/modules/ai/errors");

const USER = "0199a000-0000-7000-8000-00000000000a";
const photo = await sharp({
  create: { width: 1600, height: 1200, channels: 3, background: "#fff" },
})
  .jpeg()
  .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "19/1 25/1 0/1" } })
  .toBuffer();

beforeEach(() => {
  vi.clearAllMocks();
  env.AI_VISION_MODEL = undefined;
  isFeatureOn.mockResolvedValue(true);
  getAIRoute.mockResolvedValue({ provider: "mock", model: "mock", source: "default" });
  providerForRoute.mockReturnValue(new MockAIProvider());
  reserveAiRequest.mockResolvedValue({ requestId: "solicitud-1" });
  db.aIRequest.update.mockResolvedValue({});
  listShopProducts.mockImplementation(async ({ query }: { query: { text: string } }) => [
    { id: `p-${query.text}`, title: query.text },
  ]);
});

describe("searchByPhoto (ADR-061)", () => {
  it("describe la foto y busca cada cosa en el catálogo, con cuota por persona", async () => {
    const result = await searchByPhoto(USER, photo);

    expect(result).toMatchObject({
      ok: true,
      simulated: true,
      results: [
        {
          label: "Camisa blanca",
          query: "camisa blanca",
          // Primero lo más parecido; después lo más general («camisa»).
          products: [{ title: "camisa blanca" }, { title: "camisa" }],
        },
        { label: "Jeans azul", query: "jeans azul" },
      ],
    });
    // P5: lo que se buscó y cuánto se encontró; nunca la foto.
    expect(track).toHaveBeenCalledWith({
      type: "SEARCH",
      userId: USER,
      query: "camisa blanca, jeans azul",
      surface: "DISCOVER",
      metadata: { scope: "photo", products: 4 },
    });
    expect(reserveAiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        feature: "IMAGE_SEARCH",
        limits: PHOTO_SEARCH_LIMITS,
        // En el registro solo queda que hubo una foto, nunca la foto.
        input: { photo: "no se guarda" },
      }),
    );
  });

  it("sin nada idéntico busca lo más general, sin repetir productos", async () => {
    const camisa = { id: "p-1", title: "Camisa de vestir" };
    listShopProducts.mockImplementation(async ({ query }: { query: { text: string } }) =>
      query.text === "camisa blanca" ? [] : query.text === "camisa" ? [camisa, camisa] : [],
    );

    const result = await searchByPhoto(USER, photo);

    expect(result).toMatchObject({
      ok: true,
      results: [
        { query: "camisa blanca", products: [camisa] },
        { query: "jeans azul", products: [] },
      ],
    });
    const searched = listShopProducts.mock.calls.map(
      ([options]) => (options as { query: { text: string } }).query.text,
    );
    expect(searched).toEqual(["camisa blanca", "jeans azul", "camisa", "jeans"]);
  });

  it("al modelo le llega la foto reducida, en JPEG y sin la ubicación", async () => {
    const generate = vi.fn(new MockAIProvider().generate);
    providerForRoute.mockReturnValue({ id: "mock", model: "mock", generate });

    await searchByPhoto(USER, photo);

    const sent = (generate.mock.calls[0]![1] as { image: string }).image;
    expect(sent.startsWith("data:image/jpeg;base64,")).toBe(true);
    const meta = await sharp(Buffer.from(sent.split(",")[1]!, "base64")).metadata();
    expect([meta.width, meta.height]).toEqual([768, 576]);
    expect(meta.exif).toBeUndefined();
  });

  it("con un modelo de pago y sin AI_VISION_MODEL no está disponible (el de texto no ve fotos)", async () => {
    getAIRoute.mockResolvedValue({
      provider: "openai_compatible",
      model: "qwen/qwen3.5-9b",
      source: "default",
    });

    await expect(searchByPhoto(USER, photo)).resolves.toEqual({ ok: false, reason: "unavailable" });

    env.AI_VISION_MODEL = "google/gemini-2.5-flash-lite";
    await searchByPhoto(USER, photo);
    expect(providerForRoute).toHaveBeenLastCalledWith({
      provider: "openai_compatible",
      model: "google/gemini-2.5-flash-lite",
    });
  });

  it("lo que no es una foto se rechaza antes de gastar; la cuota agotada se dice", async () => {
    await expect(searchByPhoto(USER, Buffer.from("<svg></svg>".padEnd(64)))).resolves.toMatchObject(
      {
        ok: false,
        reason: "invalid_image",
      },
    );
    expect(reserveAiRequest).not.toHaveBeenCalled();

    reserveAiRequest.mockRejectedValueOnce(new AIError("QUOTA_EXCEEDED"));
    await expect(searchByPhoto(USER, photo)).resolves.toEqual({ ok: false, reason: "limited" });
  });

  it("con la función apagada no hace nada", async () => {
    isFeatureOn.mockResolvedValue(false);

    await expect(searchByPhoto(USER, photo)).resolves.toEqual({ ok: false, reason: "unavailable" });
    expect(reserveAiRequest).not.toHaveBeenCalled();
  });
});
