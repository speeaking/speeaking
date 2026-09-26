import { describe, expect, it } from "vitest";
import { z } from "zod";
import { saleProposalAiSchema } from "@/modules/ai/sale-proposal";
import { saleProposalTask } from "@/modules/ai/tasks/sale-proposal";
import { AIProviderError } from "./errors";
import { MockAIProvider } from "./mock";
import type { AITask } from "./types";

const provider = new MockAIProvider();
const airpods = {
  text: "Tengo 50 AirPods Pro 2. Me costaron $2,400 y quiero venderlos a $3,499.",
  productName: "AirPods Pro 2",
  quantity: 50,
  priceCents: 349_900,
  costCents: 240_000,
  city: "Ciudad de México",
  hasPhoto: false,
  categories: [{ slug: "audio", name: "Audio y audífonos" }],
};

describe("MockAIProvider (contrato que cumple cualquier proveedor)", () => {
  it("devuelve una salida válida según el esquema de la tarea, sin costo", async () => {
    const { output, usage } = await provider.generate(saleProposalTask, airpods);

    expect(saleProposalAiSchema.safeParse(output).success).toBe(true);
    expect(usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it("clasifica el producto y respeta los números confirmados del vendedor", async () => {
    const { output } = await provider.generate(saleProposalTask, airpods);

    expect(output.categorySlug).toBe("audio");
    expect(output.adIdeas[0]).toContain("$3,499");
    expect(output.adIdeas[0]).toContain("50 piezas");
    // Las cifras del rango y del presupuesto no las da el modelo (P2): las pone el código.
    expect(output).not.toHaveProperty("suggestedDailyBudgetCents");
    expect(output.suggestedPriceRange).not.toHaveProperty("minCents");
  });

  it("declara que no consulta precios del mercado (P2: no presenta estimaciones como verdades)", async () => {
    const { output } = await provider.generate(saleProposalTask, {
      ...airpods,
      productName: "Mesa de pino",
    });

    expect(output.assumptions.join(" ")).toMatch(/No consultamos precios/);
    expect(output.categorySlug).toBeNull();
  });

  it("una respuesta simulada que no cumple el esquema es un error, como con un proveedor real", async () => {
    const broken: AITask<null, { ok: true }> = {
      task: "analyst_narrative",
      promptVersion: "test@1",
      format: "json",
      schemaName: "test",
      output: z.object({ ok: z.literal(true) }),
      temperature: 0,
      maxOutputTokens: 10,
      messages: () => ({ system: "", user: "" }),
      mock: () => ({ ok: false }),
    };

    await expect(provider.generate(broken, null)).rejects.toBeInstanceOf(AIProviderError);
  });
});
