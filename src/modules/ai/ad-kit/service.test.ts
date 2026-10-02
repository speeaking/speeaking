import { beforeEach, describe, expect, it, vi } from "vitest";

// El servicio orquesta: la base, la reserva y el proveedor se simulan.
const productRow = {
  id: "0199a000-0000-7000-8000-000000000001",
  slug: "audifonos-abc123",
  title: "Audífonos inalámbricos",
  description: "Audífonos con cancelación de ruido.",
  priceCents: 89_900,
  currency: "MXN",
  condition: "NEW",
  tags: ["audifonos"],
  status: "ACTIVE",
  stock: 4,
  moderationStatus: "VISIBLE",
  city: "Ciudad de México",
  state: "CDMX",
  pickupAvailable: true,
  localDeliveryAvailable: false,
  localDeliveryZones: [],
  nationalShippingAvailable: false,
  shippingPriceCents: null,
  deliveryMinDays: null,
  deliveryMaxDays: null,
  warrantyType: "NONE",
  warrantyDays: null,
  returnWindowDays: 0,
  authenticity: "NOT_APPLICABLE",
  authenticityCheck: null,
  category: { name: "Audio y audífonos" },
  seller: { acceptedPaymentMethods: ["CASH_ON_DELIVERY"] },
};

const db = vi.hoisted(() => ({
  product: { findFirst: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  aIRequest: {
    update: vi.fn((args: unknown) => ({ op: "update", args })),
    count: vi.fn(async () => 3),
    findFirst: vi.fn(async () => null),
  },
  aIResponse: { create: vi.fn((args: unknown) => ({ op: "create", args })) },
  $transaction: vi.fn(async (operations: unknown[]) =>
    operations.map((_, index) =>
      index === 0 ? { createdAt: new Date("2026-09-26T16:00:00Z") } : {},
    ),
  ),
}));
const provider = vi.hoisted(() => ({
  id: "mock" as "mock" | "openai_compatible",
  model: "mock",
  generate: vi.fn(),
}));
/** Entorno del servidor (ADR-038): se cambia por prueba para simular producción o el piloto. */
const env = vi.hoisted(() => ({
  APP_URL: "https://speeaking.com",
  NODE_ENV: "test" as string,
  ALLOW_SIMULATED_AI: false,
}));

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/env", () => ({ env }));
vi.mock("@/server/providers/ai", () => ({
  getAIProvider: vi.fn(async () => provider),
  // La ruta vigente de `ad_copy` es la del proveedor de la prueba.
  getAIRoute: vi.fn(async () => ({
    provider: provider.id,
    model: provider.model,
    source: "default",
  })),
}));
vi.mock("@/modules/platform/settings", () => ({
  getAiBudget: vi.fn(async () => ({ maxRequestsPerUserPerMonth: 30 })),
}));
vi.mock("../reservation", () => ({
  reserveAiRequest: vi.fn(async () => ({ requestId: "req-1" })),
}));
vi.mock("../retention", () => ({ maybeRedactExpiredAiInputs: vi.fn() }));

const { reserveAiRequest } = await import("../reservation");
const { AIError } = await import("../errors");
const { MockAIProvider } = await import("@/server/providers/ai/mock");
const { AdKitError, generateAdKit, getAdKitView } = await import("./service");

const OWNER = "0199a000-0000-7000-8000-00000000000a";
const OTHER = "0199a000-0000-7000-8000-00000000000b";

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(env, { NODE_ENV: "test", ALLOW_SIMULATED_AI: false });
  Object.assign(provider, { id: "mock", model: "mock" });
  // Autorización en la consulta: el producto solo aparece si `seller.userId` es quien actúa.
  db.product.findFirst.mockImplementation(
    async (args: { where: { id: string; seller: { userId: string } } }) =>
      args.where.seller.userId === OWNER && args.where.id === productRow.id ? productRow : null,
  );
  provider.generate.mockImplementation((task, input) => new MockAIProvider().generate(task, input));
});

describe("getAdKitView", () => {
  it("un producto ajeno es «no encontrado» (autorización en el servicio)", async () => {
    expect(await getAdKitView(OTHER, productRow.id)).toBeNull();
    expect(db.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: productRow.id, seller: { userId: OTHER } } }),
    );
  });

  it("un id que no es UUID ni siquiera consulta la base", async () => {
    expect(await getAdKitView(OWNER, "../../etc")).toBeNull();
    expect(db.product.findFirst).not.toHaveBeenCalled();
  });

  it("sin kit guardado muestra el producto y el uso del mes", async () => {
    const view = await getAdKitView(OWNER, productRow.id);
    expect(view).toEqual({
      product: {
        id: productRow.id,
        title: productRow.title,
        priceLabel: "$899",
        unavailable: null,
      },
      kit: null,
      usage: { used: 3, limit: 30 },
    });
  });
});

describe("getAdKitView con un kit guardado", () => {
  const storedKit = (whatsapp: string, from: "mock" | "openai_compatible" = "mock") => ({
    provider: from,
    response: {
      createdAt: new Date("2026-09-20T16:00:00Z"),
      output: {
        version: 1,
        factsHash: "hash-de-otros-datos",
        guard: { removed: 0, findings: [] },
        copy: {
          whatsapp,
          facebook: "Audífonos inalámbricos a [PRECIO]. Pregúntame lo que quieras.",
          instagram: { caption: "Audífonos inalámbricos a [PRECIO].", hashtags: ["audifonos"] },
          headline: "Audífonos a [PRECIO]",
        },
      },
    },
  });

  it("vuelve a revisar los textos con los datos DE HOY: una promesa que ya no aplica no se muestra (P4)", async () => {
    // Cuando se creó el kit el producto tenía envío gratis y garantía; hoy no tiene ninguno.
    db.aIRequest.findFirst.mockResolvedValueOnce(
      storedKit(
        "¡Hola! Tengo Audífonos inalámbricos a [PRECIO]. Envío gratis a todo México. Garantía de 30 días.",
      ) as never,
    );

    const view = await getAdKitView(OWNER, productRow.id);

    const whatsapp = view!.kit!.variants.find((variant) => variant.channel === "whatsapp")!;
    expect(whatsapp.text).toContain("Tengo Audífonos inalámbricos a $899.");
    expect(whatsapp.text).not.toMatch(/Envío gratis|Garantía de 30/);
    expect(view!.kit!.stale).toBe(true);
    expect(view!.kit!.guard).toEqual({ removed: 2, findings: ["claim", "number"] });
  });

  it("un producto que hoy no se puede comprar no muestra su kit (su liga no vendería)", async () => {
    db.product.findFirst.mockResolvedValueOnce({ ...productRow, status: "PAUSED" });
    db.aIRequest.findFirst.mockResolvedValueOnce(
      storedKit("¡Hola! Tengo Audífonos inalámbricos a [PRECIO].") as never,
    );

    const view = await getAdKitView(OWNER, productRow.id);

    expect(view?.product.unavailable).toBe("Pausado");
    expect(view?.kit).toBeNull();
  });

  it("un producto oculto por moderación no muestra su kit guardado", async () => {
    db.product.findFirst.mockResolvedValueOnce({ ...productRow, moderationStatus: "HIDDEN" });
    db.aIRequest.findFirst.mockResolvedValueOnce(
      storedKit("¡Hola! Tengo Audífonos inalámbricos a [PRECIO].") as never,
    );

    const view = await getAdKitView(OWNER, productRow.id);

    expect(view?.product.unavailable).toBe("Oculto por moderación");
    expect(view?.kit).toBeNull();
  });

  describe("la etiqueta sigue al proveedor que escribió ESE kit (ADR-038)", () => {
    it("pide el proveedor de la solicitud guardada", async () => {
      await getAdKitView(OWNER, productRow.id);
      expect(db.aIRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ provider: true }),
        }),
      );
    });

    it("en producción (piloto), un kit del simulador es de ejemplo aunque hoy la ruta vaya a un modelo", async () => {
      Object.assign(env, { NODE_ENV: "production", ALLOW_SIMULATED_AI: true });
      Object.assign(provider, { id: "openai_compatible", model: "qwen/qwen3.5-9b" });
      db.aIRequest.findFirst.mockResolvedValueOnce(
        storedKit("¡Hola! Tengo Audífonos inalámbricos a [PRECIO].", "mock") as never,
      );

      expect((await getAdKitView(OWNER, productRow.id))?.kit?.simulated).toBe(true);
    });

    it("en producción, un kit que escribió un modelo sigue siendo de la IA aunque hoy la ruta vaya al simulador", async () => {
      Object.assign(env, { NODE_ENV: "production", ALLOW_SIMULATED_AI: true });
      db.aIRequest.findFirst.mockResolvedValueOnce(
        storedKit("¡Hola! Tengo Audífonos inalámbricos a [PRECIO].", "openai_compatible") as never,
      );

      expect((await getAdKitView(OWNER, productRow.id))?.kit?.simulated).toBe(false);
    });

    it("en desarrollo y pruebas el simulador es lo normal: no se marca", async () => {
      db.aIRequest.findFirst.mockResolvedValueOnce(
        storedKit("¡Hola! Tengo Audífonos inalámbricos a [PRECIO].", "mock") as never,
      );
      expect((await getAdKitView(OWNER, productRow.id))?.kit?.simulated).toBe(false);
    });
  });

  describe("originalidad: el kit dice lo mismo que la ficha (P14)", () => {
    const declared = (check: unknown) => ({
      ...productRow,
      authenticity: "DECLARED_ORIGINAL",
      authenticityCheck: check,
    });
    const claimsOriginal =
      "¡Hola! Tengo Audífonos inalámbricos a [PRECIO]. Son originales, con su caja.";

    async function whatsappFor(row: unknown) {
      db.product.findFirst.mockResolvedValueOnce(row);
      db.aIRequest.findFirst.mockResolvedValueOnce(storedKit(claimsOriginal) as never);
      const view = await getAdKitView(OWNER, productRow.id);
      return view!.kit!.variants.find((variant) => variant.channel === "whatsapp")!.text;
    }

    it("consulta la revisión vigente junto con el producto", async () => {
      await getAdKitView(OWNER, productRow.id);
      expect(db.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            authenticityCheck: { select: { status: true, riskLevel: true, signals: true } },
          }),
        }),
      );
    });

    it("declarado con riesgo bajo (o sin revisión todavía): «original» con la frase del código", async () => {
      for (const check of [null, { status: "AUTO_CLEAR", riskLevel: "LOW", signals: [] }]) {
        const text = await whatsappFor(declared(check));
        expect(text).toContain("Son originales");
        expect(text).toContain("Original (lo declara el vendedor)");
      }
    });

    it("con el comprobante revisado por el equipo, también", async () => {
      const text = await whatsappFor(
        declared({ status: "VERIFIED_BY_ADMIN", riskLevel: "LOW", signals: [] }),
      );
      expect(text).toContain("Original (lo declara el vendedor)");
    });

    it("con el comprobante pedido, enviado sin revisar o rechazado: nunca «original»", async () => {
      for (const status of ["NEEDS_PROOF", "PROOF_SUBMITTED", "REJECTED"]) {
        const text = await whatsappFor(declared({ status, riskLevel: "HIGH", signals: [] }));
        expect(text).not.toMatch(/original/i);
      }
    });

    it("declarado con riesgo medio (la ficha dice «Revisa: …»): el anuncio no lo afirma", async () => {
      const text = await whatsappFor(
        declared({
          status: "AUTO_CLEAR",
          riskLevel: "MEDIUM",
          signals: [{ rule: "price_below_reference", weight: 0.3, message: "Precio bajo" }],
        }),
      );
      expect(text).not.toMatch(/original/i);
    });
  });
});

describe("generateAdKit", () => {
  it("con un producto ajeno no reserva ni llama al proveedor", async () => {
    await expect(generateAdKit(OTHER, productRow.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(reserveAiRequest).not.toHaveBeenCalled();
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it("un producto pausado o agotado no lleva kit (su liga no vendería)", async () => {
    db.product.findFirst.mockResolvedValueOnce({ ...productRow, status: "PAUSED" });
    await expect(generateAdKit(OWNER, productRow.id)).rejects.toBeInstanceOf(AdKitError);
    db.product.findFirst.mockResolvedValueOnce({ ...productRow, stock: 0 });
    await expect(generateAdKit(OWNER, productRow.id)).rejects.toMatchObject({
      code: "NOT_ELIGIBLE",
    });
    expect(reserveAiRequest).not.toHaveBeenCalled();
  });

  it("un producto prohibido no gasta una llamada", async () => {
    db.product.findFirst.mockResolvedValueOnce({ ...productRow, title: "Vape desechable" });
    await expect(generateAdKit(OWNER, productRow.id)).rejects.toMatchObject({
      code: "NOT_ALLOWED",
    });
    expect(reserveAiRequest).not.toHaveBeenCalled();
  });

  it("sin cuota (10 al día, 30 al mes) no llama al proveedor", async () => {
    vi.mocked(reserveAiRequest).mockRejectedValueOnce(new AIError("QUOTA_EXCEEDED", 3_600, "day"));

    await expect(generateAdKit(OWNER, productRow.id)).rejects.toMatchObject({
      code: "QUOTA_EXCEEDED",
      scope: "day",
    });
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it("reserva como CONTENT_GENERATION y guarda los textos revisados con [PRECIO]", async () => {
    const view = await generateAdKit(OWNER, productRow.id);

    expect(reserveAiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER,
        feature: "CONTENT_GENERATION",
        provider: { id: "mock", model: "mock", promptVersion: "ad-copy@4" },
        input: expect.objectContaining({ kind: "ad_kit", productId: productRow.id }),
      }),
    );
    const stored = vi.mocked(db.aIResponse.create).mock.calls[0]![0] as {
      data: { output: { copy: { whatsapp: string }; factsHash: string }; costMicrosUsd: number };
    };
    expect(stored.data.output.copy.whatsapp).toContain("[PRECIO]");
    expect(stored.data.costMicrosUsd).toBe(0);
    expect(view.kit?.variants).toHaveLength(4);
    expect(view.kit?.variants[0]?.text).toContain("$899");
    expect(view.kit?.variants[0]?.text).toContain(
      "https://speeaking.com/producto/audifonos-abc123?ref=compartir&canal=whatsapp",
    );
    expect(view.kit?.stale).toBe(false);
  });

  it("un error del proveedor deja la solicitud FAILED", async () => {
    const { AIProviderError } = await import("@/server/providers/ai/errors");
    provider.generate.mockRejectedValueOnce(new AIProviderError("timeout", "[ai] timeout"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    await expect(generateAdKit(OWNER, productRow.id)).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
    expect(db.aIRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", errorCode: "PROVIDER_ERROR" }),
      }),
    );
  });
});

describe("generateAdKit sin IA disponible (ADR-038)", () => {
  it("producción con el simulador y sin ALLOW_SIMULATED_AI: UNAVAILABLE sin reservar ni llamar", async () => {
    Object.assign(env, { NODE_ENV: "production", ALLOW_SIMULATED_AI: false });

    await expect(generateAdKit(OWNER, productRow.id)).rejects.toMatchObject({
      name: "AIError",
      code: "UNAVAILABLE",
    });
    // La cuota del vendedor queda intacta: ni reserva ni solicitud FAILED.
    expect(reserveAiRequest).not.toHaveBeenCalled();
    expect(provider.generate).not.toHaveBeenCalled();
    expect(db.aIRequest.update).not.toHaveBeenCalled();
  });

  it("piloto (ALLOW_SIMULATED_AI=true): genera y el kit queda marcado como de ejemplo", async () => {
    Object.assign(env, { NODE_ENV: "production", ALLOW_SIMULATED_AI: true });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_SIMULATED_AI", "true");
    try {
      const view = await generateAdKit(OWNER, productRow.id);
      expect(reserveAiRequest).toHaveBeenCalledTimes(1);
      expect(view.kit?.simulated).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("con un modelo de verdad en producción, el kit es de la IA", async () => {
    Object.assign(env, { NODE_ENV: "production", ALLOW_SIMULATED_AI: false });
    Object.assign(provider, { id: "openai_compatible", model: "qwen/qwen3.5-9b" });
    provider.generate.mockImplementationOnce(async (task, input) => ({
      ...(await new MockAIProvider().generate(task, input)),
      usage: { inputTokens: 900, outputTokens: 400 },
    }));

    const view = await generateAdKit(OWNER, productRow.id);

    expect(reserveAiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: expect.objectContaining({ id: "openai_compatible", model: "qwen/qwen3.5-9b" }),
      }),
    );
    expect(view.kit?.simulated).toBe(false);
  });
});
