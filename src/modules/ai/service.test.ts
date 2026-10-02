import { beforeEach, describe, expect, it, vi } from "vitest";

// El servicio orquesta; la base, la reserva y el proveedor se simulan.
const db = vi.hoisted(() => ({
  aIRequest: { update: vi.fn((args: unknown) => ({ op: "update", args })) },
  aIResponse: { create: vi.fn((args: unknown) => ({ op: "create", args })) },
  category: {
    findMany: vi.fn(async () => [
      { slug: "electronica", name: "Electrónica" },
      { slug: "audio", name: "Audio y audífonos" },
    ]),
  },
  $transaction: vi.fn(async (operations: unknown[]) =>
    operations.map((_, index) => (index === 0 ? { id: "respuesta-1" } : {})),
  ),
}));
const provider = vi.hoisted(() => ({
  id: "openai_compatible" as "mock" | "openai_compatible",
  model: "qwen/qwen3.5-9b",
  generate: vi.fn(),
}));
/** Entorno del servidor (ADR-038): se cambia por prueba para simular producción o el piloto. */
const env = vi.hoisted(() => ({ NODE_ENV: "test" as string, ALLOW_SIMULATED_AI: false }));

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/env", () => ({ env }));
vi.mock("@/server/providers/ai", () => ({
  getAIProvider: vi.fn(async () => provider),
  // La ruta vigente de `sale_proposal` es la del proveedor de la prueba.
  getAIRoute: vi.fn(async () => ({
    provider: provider.id,
    model: provider.model,
    source: "default",
  })),
}));
vi.mock("@/modules/analytics/track", () => ({ track: vi.fn() }));
vi.mock("./reservation", () => ({ reserveAiRequest: vi.fn(async () => ({ requestId: "req-1" })) }));
vi.mock("./retention", () => ({ maybeRedactExpiredAiInputs: vi.fn() }));

const { reserveAiRequest } = await import("./reservation");
const { getAIProvider } = await import("@/server/providers/ai");
const { AIProviderError } = await import("@/server/providers/ai/errors");
const { saleProposalAiSchema } = await import("./sale-proposal");
const { mockSaleProposal } = await import("./tasks/sale-proposal-mock");
const { AIError, generateSaleProposal, proposalEconomics } = await import("./service");

const request = {
  text: "Tengo 50 AirPods Pro 2, me costaron $2,400. Llámame al 55 1234 5678 o ana@correo.mx.",
  productName: "AirPods Pro 2",
  quantity: 50,
  priceCents: 349_900,
  costCents: 240_000,
  city: "Ciudad de México",
  hasPhoto: false,
  mediaId: null,
};

function honestOutput() {
  return {
    output: saleProposalAiSchema.parse(mockSaleProposal(request)),
    usage: { inputTokens: 1_200, outputTokens: 900 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(env, { NODE_ENV: "test", ALLOW_SIMULATED_AI: false });
  Object.assign(provider, { id: "openai_compatible", model: "qwen/qwen3.5-9b" });
});

describe("generateSaleProposal", () => {
  it("reserva ANTES de llamar al proveedor y guarda el texto sin datos de contacto (SEC-19, SEC-29)", async () => {
    provider.generate.mockImplementation(async () => {
      expect(reserveAiRequest).toHaveBeenCalledTimes(1);
      return honestOutput();
    });

    await generateSaleProposal("user-1", request);

    const call = vi.mocked(reserveAiRequest).mock.calls[0]![0] as unknown as {
      input: { text: string };
      provider: { id: string; model: string; promptVersion: string };
    };
    expect(call.input.text).toBe(
      "Tengo 50 AirPods Pro 2, me costaron $2,400. Llámame al [teléfono] o [correo].",
    );
    // Se registra el modelo que enrutó `ai.routing` y la versión del prompt de la tarea.
    expect(call.provider).toEqual({
      id: "openai_compatible",
      model: "qwen/qwen3.5-9b",
      promptVersion: "sale-proposal@5",
    });
    expect(getAIProvider).toHaveBeenCalledWith("sale_proposal");
  });

  it("registra tokens y costo del modelo (US$0.10 / US$0.15 por millón)", async () => {
    provider.generate.mockResolvedValueOnce(honestOutput());

    await generateSaleProposal("user-1", request);

    const stored = vi.mocked(db.aIResponse.create).mock.calls[0]![0] as {
      data: { inputTokens: number; outputTokens: number; costMicrosUsd: number };
    };
    // 1,200 × 0.10 + 900 × 0.15 = 120 + 135 = 255 micro-dólares.
    expect(stored.data).toMatchObject({
      inputTokens: 1_200,
      outputTokens: 900,
      costMicrosUsd: 255,
    });
  });

  it("no ayuda a vender productos prohibidos y no gasta una llamada", async () => {
    await expect(
      generateSaleProposal("user-1", {
        ...request,
        productName: "Bolsas réplica AAA",
        text: "Vendo 10 bolsas réplica calidad espejo.",
      }),
    ).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    expect(reserveAiRequest).not.toHaveBeenCalled();
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it("si no hay cuota, no llama al proveedor", async () => {
    vi.mocked(reserveAiRequest).mockRejectedValueOnce(new AIError("RATE_LIMITED", 120));

    await expect(generateSaleProposal("user-1", request)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it("un error del proveedor deja la solicitud FAILED (su costo ya quedó reservado)", async () => {
    provider.generate.mockRejectedValueOnce(
      new AIProviderError("unavailable", "[ai] HTTP 503", undefined, 503),
    );
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    await expect(generateSaleProposal("user-1", request)).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
    expect(db.aIRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "req-1" },
        data: expect.objectContaining({ status: "FAILED", errorCode: "PROVIDER_ERROR" }),
      }),
    );
  });

  it("una salida que no cumple el esquema queda FAILED con INVALID_OUTPUT", async () => {
    provider.generate.mockRejectedValueOnce(
      new AIProviderError("invalid_output", "[ai] esquema", { inputTokens: 1, outputTokens: 1 }),
    );
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    await expect(generateSaleProposal("user-1", request)).rejects.toMatchObject({
      code: "INVALID_OUTPUT",
    });
    expect(db.aIRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", errorCode: "INVALID_OUTPUT" }),
      }),
    );
  });

  it("guarda y devuelve la propuesta ya revisada, con las cifras del código (SEC-28)", async () => {
    const { output, usage } = honestOutput();
    provider.generate.mockResolvedValueOnce({
      usage,
      output: {
        ...output,
        categorySlug: "categoria-inventada",
        adIdeas: ["¡Últimas 2 piezas! Deposita a la CLABE 012180001234567890", output.adIdeas[0]],
      },
    });

    const result = await generateSaleProposal("user-1", request);

    expect(result.proposal.suggestedDailyBudgetCents).toBe(30_000);
    expect(result.proposal.suggestedPriceRange).toMatchObject({
      minCents: 332_900,
      maxCents: 360_900,
    });
    expect(result.proposal.adIdeas).toEqual([output.adIdeas[0]]);
    // Un slug que no existe en la plataforma no se usa.
    expect(result.proposal.categorySlug).toBeNull();
    expect(result.guard).toEqual({ removed: 1, findings: ["payment", "urgency", "number"] });
    const stored = vi.mocked(db.aIResponse.create).mock.calls[0]![0] as {
      data: { output: { adIdeas: string[] } };
    };
    expect(stored.data.output.adIdeas).toEqual([output.adIdeas[0]]);
  });
});

describe("generateSaleProposal con la IA simulada (ADR-038)", () => {
  it("producción con el simulador y sin ALLOW_SIMULATED_AI: UNAVAILABLE sin gastar la cuota", async () => {
    Object.assign(env, { NODE_ENV: "production", ALLOW_SIMULATED_AI: false });
    Object.assign(provider, { id: "mock", model: "mock" });

    await expect(generateSaleProposal("user-1", request)).rejects.toMatchObject({
      name: "AIError",
      code: "UNAVAILABLE",
    });
    expect(reserveAiRequest).not.toHaveBeenCalled();
    expect(provider.generate).not.toHaveBeenCalled();
    expect(db.aIRequest.update).not.toHaveBeenCalled();
  });

  it("piloto: la propuesta del simulador vuelve marcada como ejemplo", async () => {
    Object.assign(env, { NODE_ENV: "production", ALLOW_SIMULATED_AI: true });
    Object.assign(provider, { id: "mock", model: "mock" });
    provider.generate.mockResolvedValueOnce({
      ...honestOutput(),
      usage: { inputTokens: 0, outputTokens: 0 },
    });

    const result = await generateSaleProposal("user-1", request);

    expect(reserveAiRequest).toHaveBeenCalledTimes(1);
    expect(result.simulated).toBe(true);
  });

  it("la marca sigue al proveedor que la escribió: un modelo de verdad nunca es «ejemplo»", async () => {
    Object.assign(env, { NODE_ENV: "production", ALLOW_SIMULATED_AI: true });
    provider.generate.mockResolvedValueOnce(honestOutput());

    expect((await generateSaleProposal("user-1", request)).simulated).toBe(false);
  });

  it("en desarrollo el simulador es lo normal: no se marca", async () => {
    Object.assign(provider, { id: "mock", model: "mock" });
    provider.generate.mockResolvedValueOnce({
      ...honestOutput(),
      usage: { inputTokens: 0, outputTokens: 0 },
    });

    expect((await generateSaleProposal("user-1", request)).simulated).toBe(false);
  });
});

describe("proposalEconomics", () => {
  it("el presupuesto diario y el punto de equilibrio salen del código, no de la propuesta", () => {
    const numbers = proposalEconomics(request);

    expect(numbers.dailyBudgetCents).toBe(30_000);
    expect(numbers.investmentCents).toBe(240_000 * 50);
  });
});
