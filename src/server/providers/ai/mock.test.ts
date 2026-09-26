import { describe, expect, it } from "vitest";
import { saleProposalSchema } from "@/modules/ai/sale-proposal";
import { MockAIProvider } from "./mock";

const provider = new MockAIProvider();
const airpods = {
  text: "Tengo 50 AirPods Pro 2. Me costaron $2,400 y quiero venderlos a $3,499.",
  productName: "AirPods Pro 2",
  quantity: 50,
  priceCents: 349_900,
  costCents: 240_000,
  city: "Ciudad de México",
  hasPhoto: false,
};

describe("MockAIProvider (contrato que cumplirá cualquier proveedor real)", () => {
  it("devuelve una propuesta válida según el esquema", async () => {
    const { output } = await provider.generateSaleProposal(airpods);

    expect(saleProposalSchema.safeParse(output).success).toBe(true);
  });

  it("clasifica el producto y respeta los números confirmados del vendedor", async () => {
    const { output } = await provider.generateSaleProposal(airpods);
    const proposal = saleProposalSchema.parse(output);

    expect(proposal.categorySlug).toBe("audio");
    expect(proposal.adIdeas[0]).toContain("$3,499");
    expect(proposal.adIdeas[0]).toContain("50 piezas");
    // Presupuesto de prueba: 30 % del margen, con tope de $300 diarios.
    expect(proposal.suggestedDailyBudgetCents).toBe(30_000);
  });

  it("declara que no consulta precios del mercado (P2: no presenta estimaciones como verdades)", async () => {
    const { output } = await provider.generateSaleProposal({
      ...airpods,
      productName: "Mesa de pino",
    });
    const proposal = saleProposalSchema.parse(output);

    expect(proposal.assumptions.join(" ")).toMatch(/No consultamos precios/);
    expect(proposal.categorySlug).toBeNull();
  });
});
