import { beforeEach, describe, expect, it, vi } from "vitest";

// Prellenado del producto desde una propuesta: la etiqueta sigue a quien la escribió (ADR-038).
const db = vi.hoisted(() => ({
  aIResponse: { findFirst: vi.fn() },
  category: { findUnique: vi.fn(async () => null) },
  media: { findFirst: vi.fn(async () => null) },
}));
const env = vi.hoisted(() => ({ NODE_ENV: "production" as string, ALLOW_SIMULATED_AI: true }));

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/env", () => ({ env }));
vi.mock("@/server/providers/ai", () => ({ getAIRoute: vi.fn() }));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ publicUrl: (key: string) => `/media/${key}` }),
}));

const { mockSaleProposal } = await import("./tasks/sale-proposal-mock");
const { withCodeNumbers } = await import("./proposal-numbers");
const { getProposalDefaults } = await import("./proposal-defaults");

const USER = "0199a000-0000-7000-8000-00000000000a";
const RESPONSE = "0199a000-0000-7000-8000-000000000001";
const input = {
  text: "Tengo 50 AirPods Pro 2.",
  productName: "AirPods Pro 2",
  quantity: 50,
  priceCents: 349_900,
  costCents: 240_000,
  city: null,
  hasPhoto: false,
};

function stored(provider: string) {
  return {
    id: RESPONSE,
    output: withCodeNumbers(mockSaleProposal(input) as object, input),
    request: { provider, input: { ...input, mediaId: null } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(env, { NODE_ENV: "production", ALLOW_SIMULATED_AI: true });
});

describe("getProposalDefaults", () => {
  it("lee el proveedor de la propuesta guardada (solo de quien la pidió)", async () => {
    db.aIResponse.findFirst.mockResolvedValue(stored("mock"));
    await getProposalDefaults(RESPONSE, USER);
    expect(db.aIResponse.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RESPONSE, request: { userId: USER, feature: "SALE_PROPOSAL" } },
        select: expect.objectContaining({
          request: { select: { input: true, provider: true } },
        }),
      }),
    );
  });

  it("una propuesta del simulador (piloto) prellena marcada como ejemplo", async () => {
    db.aIResponse.findFirst.mockResolvedValue(stored("mock"));
    const defaults = await getProposalDefaults(RESPONSE, USER);
    expect(defaults).toMatchObject({ proposalId: RESPONSE, simulated: true, stock: "50" });
  });

  it("una que escribió un modelo sigue siendo de la IA, aunque hoy la IA esté simulada", async () => {
    db.aIResponse.findFirst.mockResolvedValue(stored("openai_compatible"));
    expect((await getProposalDefaults(RESPONSE, USER))?.simulated).toBe(false);
  });

  it("una propuesta guardada con el precio leído como lote y la marca «[costo]» prellena limpio", async () => {
    // El caso real del 2026-10-02 (sale-proposal@4), tal como quedó guardado.
    const bolsas = {
      text: "Vendo 8 bolsas de piel café, hechas a mano. Me salen en $650 cada una y quiero venderlas a $1,199.",
      productName: "bolsas de piel café",
      quantity: 8,
      priceCents: 119_900,
      costCents: 65_000,
      city: null,
      hasPhoto: false,
    };
    const output = {
      ...(mockSaleProposal(bolsas) as object),
      productName: "bolsas de piel café",
      headline: "8 bolsas de piel café hechas a mano por $1,199",
      description:
        "Tengo 8 bolsas de piel café hechas a mano disponibles. Me salen en [costo] cada una y las ofrezco a $1,199. Son piezas únicas con un acabado especial. Pídelo aquí.",
      valueProposition:
        "8 bolsas de piel café hechas a mano disponibles por $1,199. Un producto único con acabado especial.",
      adIdeas: [
        "8 bolsas de piel café hechas a mano por solo $1,199. Pídelo aquí.",
        "Bolsa de piel café hecha a mano, única y resistente. Aparta la tuya.",
      ],
    };
    db.aIResponse.findFirst.mockResolvedValue({
      id: RESPONSE,
      output: withCodeNumbers(output, bolsas),
      request: { provider: "openai_compatible", input: { ...bolsas, mediaId: null } },
    });

    const defaults = await getProposalDefaults(RESPONSE, USER);

    expect(defaults).toMatchObject({
      title: "Bolsas de piel café",
      description:
        "Son piezas únicas con un acabado especial. Pídelo aquí.\n\nUn producto único con acabado especial.",
      postBody: "Bolsa de piel café hecha a mano, única y resistente. Aparta la tuya.",
      price: "1199",
      stock: "8",
    });
    expect(`${defaults?.description} ${defaults?.postBody}`).not.toMatch(/\[costo\]|8 bolsas/);
  });

  it("la foto se prellena solo si es propia, está lista y no es un comprobante de autenticidad", async () => {
    const MEDIA = "0199a000-0000-7000-8000-0000000000aa";
    const row = stored("openai_compatible");
    db.aIResponse.findFirst.mockResolvedValue({
      ...row,
      request: { ...row.request, input: { ...input, mediaId: MEDIA } },
    });
    await getProposalDefaults(RESPONSE, USER);
    expect(db.media.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: MEDIA,
          ownerId: USER,
          status: "READY",
          kind: "IMAGE",
          proofHistory: { none: {} },
        },
      }),
    );
  });
});
