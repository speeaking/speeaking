import { beforeEach, describe, expect, it, vi } from "vitest";

// El servicio orquesta; la base, la reserva y el proveedor se simulan.
const db = vi.hoisted(() => ({
  aIRequest: { update: vi.fn((args: unknown) => ({ op: "update", args })) },
  aIResponse: { create: vi.fn((args: unknown) => ({ op: "create", args })) },
  $transaction: vi.fn(async (operations: unknown[]) =>
    operations.map((_, index) => (index === 0 ? { id: "respuesta-1" } : {})),
  ),
}));
const provider = vi.hoisted(() => ({
  id: "test",
  model: "mock",
  promptVersion: "test@1",
  generateSaleProposal: vi.fn(),
}));

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/providers/ai", () => ({ getAIProvider: () => provider }));
vi.mock("@/modules/analytics/track", () => ({ track: vi.fn() }));
vi.mock("./reservation", () => ({ reserveAiRequest: vi.fn(async () => ({ requestId: "req-1" })) }));
vi.mock("./retention", () => ({ maybeRedactExpiredAiInputs: vi.fn() }));

const { reserveAiRequest } = await import("./reservation");
const { MockAIProvider } = await import("@/server/providers/ai/mock");
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

async function honestOutput() {
  return new MockAIProvider().generateSaleProposal(request);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateSaleProposal", () => {
  it("reserva ANTES de llamar al proveedor y guarda el texto sin datos de contacto (SEC-19, SEC-29)", async () => {
    provider.generateSaleProposal.mockImplementation(async () => {
      expect(reserveAiRequest).toHaveBeenCalledTimes(1);
      return honestOutput();
    });

    await generateSaleProposal("user-1", request);

    const { input } = vi.mocked(reserveAiRequest).mock.calls[0]![0] as unknown as {
      input: { text: string };
    };
    expect(input.text).toBe(
      "Tengo 50 AirPods Pro 2, me costaron $2,400. Llámame al [teléfono] o [correo].",
    );
  });

  it("si no hay cuota, no llama al proveedor", async () => {
    vi.mocked(reserveAiRequest).mockRejectedValueOnce(new AIError("RATE_LIMITED", 120));

    await expect(generateSaleProposal("user-1", request)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(provider.generateSaleProposal).not.toHaveBeenCalled();
  });

  it("un error del proveedor deja la solicitud FAILED (su costo ya quedó reservado)", async () => {
    provider.generateSaleProposal.mockRejectedValueOnce(new Error("503"));

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

  it("una salida inválida queda FAILED con INVALID_OUTPUT", async () => {
    provider.generateSaleProposal.mockResolvedValueOnce({
      output: { productName: "X" },
      usage: { inputTokens: 100, outputTokens: 900 },
    });

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
    const { output, usage } = await honestOutput();
    provider.generateSaleProposal.mockResolvedValueOnce({
      usage,
      output: {
        ...output,
        suggestedDailyBudgetCents: 9_000_000,
        adIdeas: ["¡Últimas 2 piezas! Deposita a la CLABE 012180001234567890", output.adIdeas[0]],
      },
    });

    const result = await generateSaleProposal("user-1", request);

    expect(result.proposal.suggestedDailyBudgetCents).toBe(30_000);
    expect(result.proposal.adIdeas).toEqual([output.adIdeas[0]]);
    expect(result.guard).toEqual({ removed: 1, findings: ["payment", "urgency", "number"] });
    const stored = vi.mocked(db.aIResponse.create).mock.calls[0]![0] as {
      data: { output: { adIdeas: string[] } };
    };
    expect(stored.data.output.adIdeas).toEqual([output.adIdeas[0]]);
  });
});

describe("proposalEconomics", () => {
  it("el presupuesto diario y el punto de equilibrio salen del código, no de la propuesta", () => {
    const numbers = proposalEconomics(request);

    expect(numbers.dailyBudgetCents).toBe(30_000);
    expect(numbers.investmentCents).toBe(240_000 * 50);
  });
});
