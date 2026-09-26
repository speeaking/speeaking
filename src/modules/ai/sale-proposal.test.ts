import { describe, expect, it } from "vitest";
import { parseSellerText, saleProposalSchema } from "./sale-proposal";

describe("parseSellerText (extracción determinista, P2)", () => {
  it("entiende el ejemplo de los AirPods", () => {
    expect(
      parseSellerText("Tengo 50 AirPods Pro 2. Me costaron $2,400 y quiero venderlos a $3,499."),
    ).toEqual({
      productName: "AirPods Pro 2",
      quantity: 50,
      costCents: 240_000,
      priceCents: 349_900,
    });
  });

  it("acepta variaciones comunes", () => {
    expect(parseSellerText("vendo 3 tenis nike, costo 900 pesos, precio 1500")).toEqual({
      productName: "tenis nike",
      quantity: 3,
      costCents: 90_000,
      priceCents: 150_000,
    });
  });

  it("no inventa números que la persona no escribió", () => {
    expect(parseSellerText("Quiero vender pasteles caseros")).toEqual({
      productName: "pasteles caseros",
      quantity: null,
      costCents: null,
      priceCents: null,
    });
  });
});

describe("saleProposalSchema", () => {
  it("rechaza propuestas incompletas de un proveedor de IA", () => {
    expect(saleProposalSchema.safeParse({ productName: "X" }).success).toBe(false);
  });
});
