import { describe, expect, it } from "vitest";
import { guardProposal } from "./output-guard";
import { withCodeNumbers } from "./proposal-numbers";
import { type SaleProposal, saleProposalSchema } from "./sale-proposal";
import { mockSaleProposal } from "./tasks/sale-proposal-mock";

const iphone = {
  text: "Vendo 3 iPhone 17 Pro, me costaron $15,000 y los vendo a $20,000.",
  productName: "iPhone 17 Pro",
  quantity: 3,
  priceCents: 2_000_000,
  costCents: 1_500_000,
  city: "Ciudad de México",
  hasPhoto: false,
};

/** La salida hostil del PoC de la auditoría (`output-validation-poc.mts`). */
const hostile = {
  productName: "iPhone 17 Pro ORIGINAL sellado",
  headline: "Original y con garantía Apple de 1 año",
  description:
    "Producto 100% original con factura y garantía de 1 año. Para apartarlo deposita a la CLABE " +
    "012180001234567890 o escríbeme por WhatsApp https://wa.me/5215512345678 — fuera de la app es " +
    "más barato. Visita http://evil.example/oferta",
  valueProposition: "Garantía Apple 1 año, envío gratis a todo México en 24 h.",
  categorySlug: "audio",
  tags: ["original", "garantia", "iphone"],
  targetAudiences: [{ name: "Fans de Apple", why: "Quieren el modelo nuevo." }],
  contentIdeas: [
    "Pide a tus clientes pagar por transferencia antes de enviar.",
    "Foto del iPhone 17 Pro junto a una ventana.",
  ],
  adIdeas: [
    "¡ÚLTIMAS 2 PIEZAS! Solo hoy. Paga por transferencia: CLABE 012180001234567890",
    "iPhone 17 Pro a $20,000. Entrega en Ciudad de México.",
  ],
  videoScript: "",
  suggestedPriceRange: { minCents: 9_999_999_900, maxCents: 100, rationale: "" },
  suggestedDailyBudgetCents: 9_007_199_254_740_991,
  budgetRationale: "",
  objections: [{ objection: "¿Es original?", answer: "Sí, 100% original con garantía Apple." }],
  ctas: ["Paga por transferencia", "Compra ahora"],
  assumptions: ["Ninguno"],
};

function parse(output: unknown) {
  return saleProposalSchema.parse(withCodeNumbers(output, iphone));
}

describe("guardProposal (SEC-28)", () => {
  it("la salida hostil del PoC ya no prellena CLABE, ligas, urgencia ni garantías inventadas", () => {
    const { proposal, removed, findings } = guardProposal(parse(hostile), iphone);
    const publishable = [
      proposal.productName,
      proposal.headline,
      proposal.description,
      proposal.valueProposition,
      ...proposal.tags,
      ...proposal.contentIdeas,
      ...proposal.adIdeas,
      proposal.videoScript,
      ...proposal.ctas,
    ].join("\n");

    expect(publishable).not.toMatch(/clabe|0121800|wa\.me|evil|transferencia|deposita/i);
    expect(publishable).not.toMatch(/últimas|solo hoy|garant|original|envío gratis|factura/i);
    // El nombre es el que confirmó el vendedor.
    expect(proposal.productName).toBe("iPhone 17 Pro");
    // Lo limpio se conserva; lo que se vació usa textos con los datos del vendedor.
    expect(proposal.adIdeas).toEqual(["iPhone 17 Pro a $20,000. Entrega en Ciudad de México."]);
    expect(proposal.contentIdeas).toEqual(["Foto del iPhone 17 Pro junto a una ventana."]);
    expect(proposal.ctas).toEqual(["Compra ahora"]);
    expect(proposal.tags).toEqual(["iphone"]);
    expect(proposal.headline).toBe("iPhone 17 Pro a $20,000");
    expect(removed).toBeGreaterThan(5);
    expect(findings).toEqual(expect.arrayContaining(["payment", "contact", "urgency", "claim"]));
    // Sigue cumpliendo el contrato (se guarda y se vuelve a leer con el esquema).
    expect(saleProposalSchema.safeParse(proposal).success).toBe(true);
  });

  it("las cifras de la propuesta son las del código, nunca las de la IA", () => {
    const { proposal } = guardProposal(parse(hostile), iphone);

    expect(proposal.suggestedDailyBudgetCents).toBe(30_000);
    expect(proposal.suggestedPriceRange).toMatchObject({
      minCents: 1_900_900,
      maxCents: 2_060_900,
    });
  });

  it("quita montos y piezas distintos de los confirmados", () => {
    const proposal: SaleProposal = {
      ...parse(hostile),
      adIdeas: [
        "iPhone 17 Pro a $18,999, quedan 3 piezas.",
        "iPhone 17 Pro a $20,000, quedan 3 piezas.",
        "Llévate 2 unidades por 35000 pesos.",
      ],
    };
    const { proposal: guarded, findings } = guardProposal(proposal, iphone);

    expect(guarded.adIdeas).toEqual(["iPhone 17 Pro a $20,000, quedan 3 piezas."]);
    expect(findings).toContain("number");
  });

  it.each([
    // Urgencia y escasez inventadas.
    ["urgency", "¡Aprovecha antes de que se agoten!"],
    ["urgency", "Hasta agotar existencias."],
    ["urgency", "Stock limitado."],
    ["urgency", "¡Pocas piezas disponibles!"],
    // Afirmaciones sin respaldo en los datos del vendedor (P4) y promociones que no existen.
    ["claim", "Envío incluido a todo México."],
    ["claim", "Entrega inmediata."],
    ["claim", "Llega mañana a tu casa."],
    ["claim", "Hasta 12 meses sin intereses."],
    ["claim", "Paga a 3 MSI."],
    ["claim", "Precio de remate 2x1."],
    ["claim", "Certificado de autenticidad incluido."],
    // Cifras que no son las confirmadas (otra moneda, otras piezas).
    ["number", "Cuesta solo 190 dólares."],
    ["number", "A USD 190."],
    ["number", "¡Solo 2 disponibles!"],
    // Pago por fuera, también con acentos o sin ellos.
    ["payment", "Deposítame y te lo envío."],
    ["payment", "Transfiéreme el total."],
    ["payment", "Págame por adelantado."],
    // Datos de contacto disfrazados con dígitos de ancho completo o invisibles.
    ["contact", "Escríbeme al ５５ １２３４ ５６７８."],
    ["payment", "trans\u200Bferencia a mi cuenta"],
  ] as const)("quita %s: «%s»", (finding, sentence) => {
    const proposal: SaleProposal = {
      ...parse(hostile),
      adIdeas: [sentence, "iPhone 17 Pro a $20,000."],
    };
    const { proposal: guarded, findings } = guardProposal(proposal, iphone);

    expect(guarded.adIdeas).toEqual(["iPhone 17 Pro a $20,000."]);
    expect(findings).toContain(finding);
  });

  it("un porcentaje que calculó la IA (margen, ahorro) se quita; el que escribió el vendedor se queda", () => {
    const usado = {
      ...iphone,
      text: "Vendo 3 iPhone 17 Pro con batería al 86 %, me costaron $15,000.",
    };
    const proposal: SaleProposal = {
      ...parse(hostile),
      adIdeas: [
        "Ganas un margen del 25 % por pieza.",
        "Ahorra 30% frente a la tienda.",
        "iPhone 17 Pro con batería al 86%.",
        "iPhone 17 Pro a $20,000.",
      ],
    };
    const { proposal: guarded, findings } = guardProposal(proposal, usado);

    expect(guarded.adIdeas).toEqual([
      "iPhone 17 Pro con batería al 86%.",
      "iPhone 17 Pro a $20,000.",
    ]);
    expect(findings).toContain("number");
  });

  it("el nombre que confirmó el vendedor no cuenta como afirmación ni como cifra de la IA", () => {
    const tenis = { ...iphone, productName: "Tenis originales Nike Air 90", quantity: 5 };
    const proposal: SaleProposal = {
      ...parse(hostile),
      adIdeas: [
        "Tenis originales Nike Air 90 a $20,000.",
        "Tenis Nike Air 90 originales y con garantía.",
      ],
    };

    expect(guardProposal(proposal, tenis).proposal.adIdeas).toEqual([
      "Tenis originales Nike Air 90 a $20,000.",
    ]);
  });

  it("las piezas disponibles que sí confirmó el vendedor se quedan", () => {
    const proposal: SaleProposal = {
      ...parse(hostile),
      adIdeas: ["iPhone 17 Pro: 3 disponibles a $20,000."],
    };

    expect(guardProposal(proposal, iphone).proposal.adIdeas).toEqual([
      "iPhone 17 Pro: 3 disponibles a $20,000.",
    ]);
  });

  it("en los consejos para el vendedor hablar de garantía es legítimo; datos de pago no", () => {
    const proposal: SaleProposal = {
      ...parse(hostile),
      objections: [
        {
          objection: "¿Tienen garantía?",
          answer: "Indica claramente los días de garantía que ofreces.",
        },
        { objection: "¿Cómo pago?", answer: "Deposita a mi cuenta bancaria." },
      ],
    };
    const { proposal: guarded } = guardProposal(proposal, iphone);

    expect(guarded.objections.map((item) => item.objection)).toEqual(["¿Tienen garantía?"]);
  });

  it("no toca una propuesta honesta: la del proveedor simulado pasa íntegra", () => {
    const airpods = {
      text: "Tengo 50 AirPods Pro 2. Me costaron $2,400 y quiero venderlos a $3,499.",
      productName: "AirPods Pro 2",
      quantity: 50,
      priceCents: 349_900,
      costCents: 240_000,
      city: "Ciudad de México",
      hasPhoto: false,
    };
    const output = mockSaleProposal(airpods);
    const proposal = saleProposalSchema.parse(withCodeNumbers(output, airpods));

    const guarded = guardProposal(proposal, airpods);

    expect(guarded.removed).toBe(0);
    expect(guarded.findings).toEqual([]);
    expect(guarded.proposal).toEqual(proposal);
  });
});
