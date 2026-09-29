import { describe, expect, it } from "vitest";
import { PROPOSAL_FINAL_CHECK, saleProposalTask } from "./tasks/sale-proposal";
import {
  knownCategorySlug,
  parseSellerText,
  saleProposalSchema,
  withoutCostMentions,
} from "./sale-proposal";

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

describe("withoutCostMentions (H3: el costo nunca sale hacia el proveedor)", () => {
  const secret = { costCents: 240_000, quantity: 10, priceCents: 349_900 };

  it("quita el monto que sigue a una palabra de costo", () => {
    expect(withoutCostMentions("Me costaron $2,400 y los vendo a $3,499.")).toBe(
      "Me costaron [costo] y los vendo a $3,499.",
    );
    expect(withoutCostMentions("Pagué $2,400 por cada uno")).toBe("Pagué [costo] por cada uno");
    expect(withoutCostMentions("los conseguí en 2400 pesos")).toBe("los conseguí en [costo]");
  });

  it("con el costo confirmado, quita cualquier monto igual al costo o al costo total", () => {
    expect(
      withoutCostMentions("A mí me sale en $2,400, en total $24,000; precio $3,499.", secret),
    ).toBe("A mí me sale en [costo], en total [costo]; precio $3,499.");
    expect(withoutCostMentions("Di 24,000 pesos por el lote", secret)).toBe(
      "Di [costo] por el lote",
    );
    // Un número sin marca de dinero (piezas, modelos) no se toca, ni el precio de venta.
    expect(withoutCostMentions("Tengo 2400 piezas a $3,499", secret)).toBe(
      "Tengo 2400 piezas a $3,499",
    );
  });

  it("el mensaje al proveedor no lleva el costo aunque ninguna palabra lo anuncie", () => {
    const { system, user } = saleProposalTask.messages({
      text: "Tengo 10 bocinas. Di $24,000 por todas y las vendo a $3,499 cada una.",
      productName: "Bocina portátil",
      quantity: 10,
      priceCents: 349_900,
      costCents: 240_000,
      city: "Puebla",
      hasPhoto: false,
      categories: [{ slug: "audio", name: "Audio" }],
    });
    for (const text of [system, user]) {
      expect(text).not.toMatch(/24,000|2,400|240000|24000/);
    }
    expect(user).toContain("[costo]");
  });
});

describe("knownCategorySlug (la categoría que eligió el modelo)", () => {
  const categories = [
    { slug: "audio", name: "Audio" },
    { slug: "electronica", name: "Electrónica" },
    { slug: "ropa-y-moda", name: "Ropa y moda" },
  ];

  it("acepta el slug tal cual", () => {
    expect(knownCategorySlug("audio", categories)).toBe("audio");
  });

  it("normaliza la línea completa de la lista, mayúsculas y espacios", () => {
    expect(knownCategorySlug("audio: Audio", categories)).toBe("audio");
    expect(knownCategorySlug("  ROPA-Y-MODA ", categories)).toBe("ropa-y-moda");
  });

  it("reconoce el nombre en vez del slug, con o sin acentos", () => {
    expect(knownCategorySlug("Electrónica", categories)).toBe("electronica");
    expect(knownCategorySlug("ropa y moda", categories)).toBe("ropa-y-moda");
  });

  it("deja sin categoría lo vacío o lo que no existe", () => {
    expect(knownCategorySlug(null, categories)).toBeNull();
    expect(knownCategorySlug("", categories)).toBeNull();
    expect(knownCategorySlug("categoria-inventada", categories)).toBeNull();
  });
});

describe("prompt de «Vende con IA» (sale-proposal@4)", () => {
  const { system, user } = saleProposalTask.messages({
    text: "Tenis Nike originales, con garantía",
    productName: "Tenis Nike",
    quantity: 3,
    priceCents: 150_000,
    costCents: 90_000,
    city: "Ciudad de México",
    hasPhoto: true,
    categories: [],
  });

  it("prohíbe la urgencia más común y ofrece llamados neutros", () => {
    expect(system).toContain("no te quedes sin el tuyo");
    expect(system).toContain("Pídelo aquí");
  });

  it("no repite originalidad ni garantía aunque el vendedor las escriba (P4, P14)", () => {
    expect(system).toMatch(/Aunque el vendedor escriba que es original/);
    expect(system).toMatch(/No menciones envíos/);
  });

  it("cierra con la revisión final DESPUÉS del texto del vendedor", () => {
    expect(user.endsWith(PROPOSAL_FINAL_CHECK)).toBe(true);
    expect(user.indexOf("Tenis Nike originales")).toBeLessThan(user.indexOf(PROPOSAL_FINAL_CHECK));
  });
});
