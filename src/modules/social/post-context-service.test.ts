import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAIProvider } from "@/server/providers/ai/mock";

const db = vi.hoisted(() => ({
  post: { findFirst: vi.fn() },
  aIResponse: { create: vi.fn() },
  aIRequest: { update: vi.fn() },
  postContext: { upsert: vi.fn() },
  $transaction: vi.fn(async (operations: unknown[]) => operations),
}));
const reserveAiRequest = vi.hoisted(() => vi.fn());
const isFeatureOn = vi.hoisted(() => vi.fn());
const aiAvailability = vi.hoisted(() => vi.fn());
const getAIProvider = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/env", () => ({
  env: { NODE_ENV: "test", TRUSTED_PROXY_HOPS: 0, BETTER_AUTH_SECRET: "s".repeat(32) },
}));
vi.mock("@/modules/ai/reservation", () => ({ reserveAiRequest }));
vi.mock("@/modules/ai/features-store", () => ({ isFeatureOn }));
vi.mock("@/modules/ai/tasks/availability", () => ({
  aiAvailability,
  simulatedRecord: (provider: string) => provider === "mock",
}));
vi.mock("@/server/providers/ai", () => ({ getAIProvider }));

const { getPostContext } = await import("./post-context-service");

const POST = "0199a000-0000-7000-8000-0000000000c1";
const VIEWER = "0199a000-0000-7000-8000-00000000000a";
const LONG =
  "La colonia amaneció sin agua desde el lunes. ".repeat(12) +
  "Los vecinos piden pipas para el fin de semana. Escríbeme al 55 1234 5678 si sabes algo.";
const hash = createHash("sha256").update(LONG).digest("hex");
const allow = () => Promise.resolve({ ok: true as const });

beforeEach(() => {
  vi.clearAllMocks();
  db.post.findFirst.mockResolvedValue({ id: POST, body: LONG, context: null });
  isFeatureOn.mockResolvedValue(true);
  aiAvailability.mockResolvedValue("available");
  getAIProvider.mockResolvedValue(new MockAIProvider());
  reserveAiRequest.mockResolvedValue({ requestId: "solicitud-1" });
  db.aIRequest.update.mockResolvedValue({});
});

describe("getPostContext (ADR-060)", () => {
  it("el guardado se lee gratis y sin sesión mientras el texto no cambie", async () => {
    db.post.findFirst.mockResolvedValue({
      id: POST,
      body: LONG,
      context: { summary: "Resumen guardado.", bodyHash: hash, provider: "openai_compatible" },
    });

    await expect(getPostContext(POST, null, { checkLimit: allow })).resolves.toEqual({
      ok: true,
      summary: "Resumen guardado.",
      simulated: false,
      cached: true,
    });
    expect(reserveAiRequest).not.toHaveBeenCalled();
  });

  it("uno nuevo pide sesión, respeta el límite por persona y la función apagada", async () => {
    await expect(getPostContext(POST, null, { checkLimit: allow })).resolves.toMatchObject({
      ok: false,
      reason: "needs_auth",
    });
    await expect(
      getPostContext(POST, VIEWER, {
        checkLimit: () => Promise.resolve({ ok: false, error: "Demasiados intentos." }),
      }),
    ).resolves.toEqual({ ok: false, reason: "limited", message: "Demasiados intentos." });
    isFeatureOn.mockResolvedValue(false);
    await expect(getPostContext(POST, VIEWER, { checkLimit: allow })).resolves.toMatchObject({
      reason: "unavailable",
    });
    expect(reserveAiRequest).not.toHaveBeenCalled();
  });

  it("una publicación corta no ofrece contexto", async () => {
    db.post.findFirst.mockResolvedValue({ id: POST, body: "Hola", context: null });

    await expect(getPostContext(POST, VIEWER, { checkLimit: allow })).resolves.toMatchObject({
      reason: "too_short",
    });
  });

  it("genera sin cuota personal, con tope diario, limpia el teléfono y lo guarda para todos", async () => {
    const result = await getPostContext(POST, VIEWER, { checkLimit: allow });

    expect(result).toMatchObject({ ok: true, simulated: true, cached: false });
    expect(result.ok && result.summary).not.toMatch(/55 1234/);
    // Cabe en una parte: una sola llamada, sin síntesis. Nunca se registra el texto.
    expect(reserveAiRequest).toHaveBeenCalledOnce();
    expect(reserveAiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        feature: "POST_CONTEXT",
        input: { postId: POST, part: 0, merging: false },
        featureDailyCapMicros: 500_000,
      }),
    );
    expect(db.postContext.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { postId: POST },
        create: expect.objectContaining({
          bodyHash: hash,
          provider: "mock",
          requestId: "solicitud-1",
        }),
      }),
    );
  });

  it("una publicación muy larga se lee completa: por partes y luego una síntesis (docs/long-posts.md)", async () => {
    // ≈18,000 caracteres: tres partes de hasta 8,000.
    const body = "Los vecinos acordaron reparar la bomba de agua esta semana. ".repeat(300);
    db.post.findFirst.mockResolvedValue({ id: POST, body, context: null });

    await expect(getPostContext(POST, VIEWER, { checkLimit: allow })).resolves.toMatchObject({
      ok: true,
    });
    const inputs = reserveAiRequest.mock.calls.map(([request]) => request.input);
    expect(inputs).toEqual([
      { postId: POST, part: 0, merging: false },
      { postId: POST, part: 1, merging: false },
      { postId: POST, part: 2, merging: false },
      { postId: POST, part: 3, merging: true },
    ]);
  });

  it("si el modelo falla, la solicitud queda FAILED y no se guarda nada", async () => {
    getAIProvider.mockResolvedValue({
      id: "openai_compatible",
      model: "qwen/qwen3.5-9b",
      generate: vi.fn().mockRejectedValue(new Error("se cayó")),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getPostContext(POST, VIEWER, { checkLimit: allow })).resolves.toEqual({
      ok: false,
      reason: "failed",
    });
    expect(db.aIRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
    expect(db.postContext.upsert).not.toHaveBeenCalled();
  });
});
