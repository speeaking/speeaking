import { describe, expect, it } from "vitest";
import { claimsIn, guardProposal, hasUrgency, textFindings } from "./output-guard";
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
    expect(proposal.headline).toBe("iPhone 17 Pro a $20,000 por pieza");
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
        "iPhone 17 Pro a $18,999.",
        "Llévate 2 unidades por 35000 pesos.",
        "iPhone 17 Pro a $20,000.",
      ],
    };
    const { proposal: guarded, findings } = guardProposal(proposal, iphone);

    expect(guarded.adIdeas).toEqual(["iPhone 17 Pro a $20,000."]);
    expect(findings).toContain("number");
  });

  it.each([
    // Urgencia y escasez inventadas.
    ["urgency", "¡Aprovecha antes de que se agoten!"],
    ["urgency", "Hasta agotar existencias."],
    ["urgency", "Stock limitado."],
    ["urgency", "¡Pocas piezas disponibles!"],
    ["urgency", "No esperes más, la variedad es limitada."],
    ["urgency", "No esperes para estrenarlo."],
    ["urgency", "Cantidad limitada."],
    ["urgency", "Las existencias son limitadas."],
    ["urgency", "Los tonos son pocos y el tiempo es limitado."],
    ["urgency", "Quedan 5 bolsas de piel."],
    ["urgency", "Solo nos quedan tres."],
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

  it("«garantía limitada» es una afirmación (P4), no urgencia; los llamados neutros de la regla 3 tampoco", () => {
    expect(hasUrgency("Garantía limitada de un año.")).toBe(false);
    expect(claimsIn("Garantía limitada de un año.")).toEqual(["warranty"]);
    // «quedan» sin un número no es escasez.
    expect(hasUrgency("Les quedan perfectas a todas.")).toBe(false);
    for (const cta of ["Pídelo aquí", "Aparta el tuyo", "Espera tu pedido con gusto."]) {
      expect(hasUrgency(cta)).toBe(false);
    }
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

  it("las piezas en existencia no van en lo publicable, pero sí en los consejos para el vendedor", () => {
    const proposal: SaleProposal = {
      ...parse(hostile),
      // «3 disponibles a $20,000» se lee como el precio de las 3; y las existencias cambian.
      adIdeas: ["iPhone 17 Pro: 3 disponibles a $20,000.", "iPhone 17 Pro a $20,000."],
      objections: [
        { objection: "¿Cuántos tienes?", answer: "Di que tienes 3 piezas, a $20,000 cada una." },
      ],
    };
    const { proposal: guarded } = guardProposal(proposal, iphone);

    expect(guarded.adIdeas).toEqual(["iPhone 17 Pro a $20,000."]);
    expect(guarded.objections).toEqual(proposal.objections);
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

/** El caso real del 2026-10-02 (qwen/qwen3.5-9b, sale-proposal@4): precio por pieza leído como lote. */
const bolsas = {
  text: "Vendo 8 bolsas de piel café, hechas a mano. Me salen en $650 cada una y quiero venderlas a $1,199.",
  productName: "bolsas de piel café",
  quantity: 8,
  priceCents: 119_900,
  costCents: 65_000,
  city: null,
  hasPhoto: false,
};

const bolsasOutput = {
  productName: "bolsas de piel café",
  headline: "8 bolsas de piel café hechas a mano por $1,199",
  description:
    "Tengo 8 bolsas de piel café hechas a mano disponibles. Me salen en [costo] cada una y las ofrezco a $1,199. Son piezas únicas con un acabado especial. Pídelo aquí.",
  valueProposition:
    "8 bolsas de piel café hechas a mano disponibles por $1,199. Un producto único con acabado especial.",
  categorySlug: null,
  tags: ["bolsas", "piel", "hecho a mano"],
  targetAudiences: [
    { name: "Quienes buscan accesorios artesanales", why: "Valoran el trabajo hecho a mano." },
  ],
  contentIdeas: ["Foto de la bolsa con luz natural."],
  adIdeas: [
    "8 bolsas de piel café hechas a mano por solo $1,199. Pídelo aquí.",
    "Bolsa de piel café hecha a mano, única y resistente. Aparta la tuya.",
  ],
  videoScript: "Muestra la bolsa de cerca y di su precio: $1,199.",
  suggestedPriceRange: { rationale: "Probar un rango ayuda a ver qué precio prefiere la gente." },
  budgetRationale: "Empieza con poco y mide.",
  objections: [
    {
      objection: "¿Por qué son tan caras?",
      answer: "El precio de $1,199 incluye las 8 bolsas de piel café hechas a mano.",
    },
  ],
  ctas: ["Pídelo aquí"],
  assumptions: [
    "Asumí que el precio de $1,199 es el total por las 8 piezas, ya que el texto no aclaró si es por unidad o por lote.",
  ],
};

function parseFor(output: unknown, facts: typeof bolsas) {
  return saleProposalSchema.parse(withCodeNumbers(output, facts));
}

/** Lo que ve quien compra: título, titular, descripción, anuncios (el texto del post), guion y llamados. */
function buyerFacing(proposal: SaleProposal) {
  return [
    proposal.productName,
    proposal.headline,
    proposal.description,
    proposal.valueProposition,
    ...proposal.adIdeas,
    proposal.videoScript,
    ...proposal.ctas,
  ];
}

describe("guardProposal: marcas de redacción (red de seguridad)", () => {
  it("ninguna frase con «[costo]» u otra marca llega a la propuesta, ni a los consejos", () => {
    const proposal = parseFor(
      {
        ...bolsasOutput,
        adIdeas: ["Escríbeme al [teléfono] y te la aparto.", "Bolsa de piel café a $1,199."],
        contentIdeas: ["Comparte tu [liga] en tus estados.", "Foto de la bolsa con luz natural."],
        objections: [
          { objection: "¿Por qué cuesta eso?", answer: "A mí me sale en [Costo] cada una." },
          { objection: "¿Es de piel?", answer: "Muestra de cerca la textura de la piel." },
        ],
        assumptions: ["Escríbeme a [correo].", "Usamos los datos que confirmaste."],
      },
      bolsas,
    );
    const { proposal: guarded, findings } = guardProposal(proposal, bolsas);

    expect(JSON.stringify(guarded)).not.toMatch(
      /\[\s*(?:costo|tel[eé]fono|correo|liga|usuario|cuenta)/i,
    );
    expect(guarded.description).toBe("Son piezas únicas con un acabado especial. Pídelo aquí.");
    expect(guarded.adIdeas).toEqual(["Bolsa de piel café a $1,199."]);
    expect(guarded.contentIdeas).toEqual(["Foto de la bolsa con luz natural."]);
    expect(guarded.objections.map((item) => item.objection)).toEqual(["¿Es de piel?"]);
    expect(guarded.assumptions).toEqual(["Usamos los datos que confirmaste."]);
    // El costo oculto es una cifra que no está en los datos; las demás marcas, contacto.
    expect(findings).toEqual(expect.arrayContaining(["number", "contact"]));
  });

  it("no confunde el «[PRECIO]» del kit de anuncios con una marca de redacción", () => {
    const rules = {
      productName: "Audífonos",
      allowedCents: new Set<number>(),
      quantity: null,
      claimKinds: [],
    };
    expect(textFindings("Audífonos inalámbricos a [PRECIO].", rules).size).toBe(0);
    expect(textFindings("Llámame al [teléfono].", rules)).toEqual(new Set(["contact"]));
    expect(textFindings("Deposita a la [cuenta].", rules)).toEqual(new Set(["payment"]));
  });
});

describe("guardProposal: precio por pieza y piezas en existencia (lo publicable)", () => {
  it("la propuesta real ya no dice a quien compra que $1,199 son las 8 bolsas", () => {
    const { proposal: guarded, findings } = guardProposal(parseFor(bolsasOutput, bolsas), bolsas);

    expect(guarded.headline).toBe("Bolsas de piel café a $1,199 por pieza");
    expect(guarded.description).toBe("Son piezas únicas con un acabado especial. Pídelo aquí.");
    expect(guarded.valueProposition).toBe("Un producto único con acabado especial.");
    expect(guarded.adIdeas).toEqual([
      "Bolsa de piel café hecha a mano, única y resistente. Aparta la tuya.",
    ]);
    expect(guarded.videoScript).toBe(bolsasOutput.videoScript);
    for (const text of buyerFacing(guarded)) {
      expect(text).not.toMatch(/(?<![\d,.$])8(?![\d,.])/);
      expect(text).not.toContain("[costo]");
    }
    expect(findings).toContain("number");
  });

  it("con 2 piezas o más, los textos que arma el código dicen que el precio es por pieza", () => {
    // Título rechazado y todo lo publicable vaciado: con el nombre en plural del vendedor,
    // «Bolsas de piel café a $1,199» se leía como el precio de todas (2026-10-02).
    const output = {
      ...bolsasOutput,
      productName: "Bolsa de piel café original",
      headline: "8 bolsas de piel café hechas a mano por $1,199",
      description: "Tengo 8 bolsas de piel café hechas a mano por $1,199.",
      valueProposition: "8 bolsas de piel café disponibles por $1,199.",
      adIdeas: ["8 bolsas de piel café por $1,199."],
      videoScript: "Di que son 8 bolsas por $1,199.",
    };
    const { proposal: guarded } = guardProposal(parseFor(output, bolsas), bolsas);

    expect(guarded.productName).toBe("Bolsas de piel café");
    expect(guarded.headline).toBe("Bolsas de piel café a $1,199 por pieza");
    expect(guarded.description).toBe(
      "Bolsas de piel café a $1,199 por pieza. Escríbeme para más detalles.",
    );
    expect(guarded.valueProposition).toBe(
      "Bolsas de piel café a $1,199 por pieza, con trato directo.",
    );
    expect(guarded.adIdeas).toEqual([
      "Bolsas de piel café a $1,199 por pieza. Escríbeme para apartarlo.",
    ]);
    expect(guarded.videoScript).toContain("su precio: $1,199 por pieza.");

    // Con una sola pieza no hay lote que confundir.
    const one = { ...bolsas, quantity: 1 };
    const single = guardProposal(parseFor({ ...output, headline: "Bolsa a $999" }, one), one);
    expect(single.proposal.headline).toBe("Bolsas de piel café a $1,199");
  });

  it.each([
    // Se lee como el precio del lote (o dice las existencias, que cambian con cada venta).
    [8, "8 bolsas de piel café por $1,199."],
    [8, "Llévate una de las 8 a $1,199."],
    [8, "Precio: $1,199. Hay 8 en existencia."],
    [8, "Tenemos 8 bolsas de piel café."],
    [8, "Quedan 8 disponibles."],
    [12, "Son 12 piezas y cada una cuesta $1,199."],
  ])("con %i en existencia quita «%s»", (quantity, sentence) => {
    const facts = { ...bolsas, quantity };
    const proposal = parseFor(
      { ...bolsasOutput, adIdeas: [sentence, "Bolsa de piel café a $1,199."] },
      facts,
    );
    const { proposal: guarded, findings } = guardProposal(proposal, facts);

    expect(guarded.adIdeas).toEqual(["Bolsa de piel café a $1,199."]);
    expect(findings).toContain("number");
  });

  it.each([
    // Medidas, tallas, rangos de segundos, composición del paquete y montos no son existencias.
    [3, "Bolsa de piel café de 3 kg a $1,199."],
    [8, "Bolsa de piel café talla 8 a $1,199."],
    [12, "8–12 s: di el precio ($1,199)."],
    [4, "Juego de 4 bolsas de piel café a $1,199."],
    [199, "Bolsa de piel café a $1,199."],
    [8, "Bolsa de piel café con 8 bolsillos interiores, a $1,199."],
    // Con una sola pieza no hay lote que confundir.
    [1, "1 bolsa de piel café a $1,199."],
  ])("con %i en existencia conserva «%s»", (quantity, sentence) => {
    const facts = { ...bolsas, quantity };
    const proposal = parseFor({ ...bolsasOutput, adIdeas: [sentence] }, facts);

    expect(guardProposal(proposal, facts).proposal.adIdeas).toEqual([sentence]);
  });

  it.each([
    "Todas las bolsas de piel café por $1,199.",
    "Todas nuestras bolsas hechas a mano a $1,199.",
    "El lote completo por $1,199.",
    "Bolsa de piel café hecha a mano: $1,199 en total.",
    "Llévate el paquete completo a $1,199.",
  ])("con 2 piezas o más, quita el lote junto a un precio: «%s»", (sentence) => {
    const proposal = parseFor(
      { ...bolsasOutput, adIdeas: [sentence, "Bolsa de piel café a $1,199."] },
      bolsas,
    );
    const { proposal: guarded, findings } = guardProposal(proposal, bolsas);

    expect(guarded.adIdeas).toEqual(["Bolsa de piel café a $1,199."]);
    expect(findings).toContain("number");
  });

  it.each([
    // Sin precio en la frase, o «todos» que no habla del producto.
    [8, "Todas nuestras bolsas son de piel."],
    [8, "Bolsa de piel café para todos los días, a $1,199."],
    [8, "Combina con todo, a $1,199."],
    // Con una sola pieza no hay lote que confundir.
    [1, "Todas las bolsas de piel café por $1,199."],
  ])("con %i en existencia conserva «%s»", (quantity, sentence) => {
    const facts = { ...bolsas, quantity };
    const proposal = parseFor({ ...bolsasOutput, adIdeas: [sentence] }, facts);

    expect(guardProposal(proposal, facts).proposal.adIdeas).toEqual([sentence]);
  });

  /** El caso de estrés del 2026-10-02: la cantidad con letra («ocho»), que el guardián no contaba. */
  const cojines = {
    text: "Tengo ocho cojines bordados a mano, me cuestan $150 y los vendo a $320.",
    productName: "cojines bordados a mano",
    quantity: 8,
    priceCents: 32_000,
    costCents: 15_000,
    city: null,
    hasPhoto: false,
  };
  const cojinAds = (facts: typeof cojines, sentence: string) =>
    guardProposal(
      parseFor({ ...bolsasOutput, adIdeas: [sentence, "Cojín bordado a mano a $320."] }, facts),
      facts,
    );

  it.each([
    [8, "Ocho cojines bordados a mano por $320."],
    [8, "Los ocho por $320."],
    [8, "Tenemos ocho cojines bordados a mano."],
    [15, "Llévate uno de los quince a $320."],
    [20, "Veinte cojines bordados, a $320."],
    [16, "Son dieciséis y cada uno cuesta $320."],
  ])("las existencias con letra también cuentan: con %i quita «%s»", (quantity, sentence) => {
    const { proposal: guarded, findings } = cojinAds({ ...cojines, quantity }, sentence);

    expect(guarded.adIdeas).toEqual(["Cojín bordado a mano a $320."]);
    expect(findings).toContain("number");
  });

  it.each([
    // Otro número, un atributo («con ocho flores») o una palabra del nombre confirmado.
    [12, "cojines bordados a mano", "Cojín bordado en ocho colores, a $320."],
    [8, "cojines bordados a mano", "Cojín con ocho flores bordadas, a $320."],
    [3, "pasteles de tres leches", "Pastel de tres leches a $320."],
  ])("con %i en existencia («%s») conserva «%s»", (quantity, productName, sentence) => {
    const facts = { ...cojines, quantity, productName };

    expect(cojinAds(facts, sentence).proposal.adIdeas).toEqual([
      sentence,
      "Cojín bordado a mano a $320.",
    ]);
  });

  // Revisión del 2026-10-02: variantes del caso real con otro nombre que el confirmado («bolsas de
  // piel café») o con el precio en otra frase pasaban intactas.
  it.each([
    "Tengo 8 bolsas de piel.",
    "Quedan 8 bolsas de piel hechas a mano.",
    "Hay 8 bolsas hechas a mano.",
    "Son ocho bolsas de piel, hechas a mano.",
    "Tenemos ocho hermosas bolsas hechas a mano.",
    "Contamos con 8 bolsas para ti.",
    "Hay ocho piezas, cada una distinta.",
    "Tenemos 8 en existencia.",
  ])("las existencias sin precio ni el nombre exacto también cuentan: quita «%s»", (sentence) => {
    const proposal = parseFor(
      { ...bolsasOutput, adIdeas: [sentence, "Bolsa de piel café a $1,199."] },
      bolsas,
    );
    const { proposal: guarded, findings } = guardProposal(proposal, bolsas);

    expect(guarded.adIdeas).toEqual(["Bolsa de piel café a $1,199."]);
    expect(findings).toContain("number");
  });

  it.each([
    ["Hay 8 bolsas de piel hechas a mano. Precio por pieza: $1,199.", "Precio por pieza: $1,199."],
    ["Son ocho. Llévate la tuya por $1,199.", "Llévate la tuya por $1,199."],
    ["Elige una de las 8. Cada una cuesta $1,199.", "Cada una cuesta $1,199."],
    ["Precio por pieza: $1,199. Hay ocho en existencia.", "Precio por pieza: $1,199."],
  ])(
    "con el precio en otra frase del mismo campo, quita la de las existencias: «%s»",
    (description, kept) => {
      const proposal = parseFor({ ...bolsasOutput, description, headline: description }, bolsas);
      const { proposal: guarded } = guardProposal(proposal, bolsas);

      expect(guarded.description).toBe(kept);
      expect(guarded.headline).toBe(kept);
    },
  );

  it.each([
    // Medidas, atributos y otros números junto al precio en otra frase; o sin precio en el campo.
    "Mide 8 cm de alto. Precio: $1,199.",
    "Bolsa con 8 bolsillos interiores. Precio: $1,199.",
    "Cabe una laptop de 15 pulgadas. Precio: $1,199.",
    "Bolsa de piel café de 8 compartimentos.",
    "Combina con 8 de cada 10 atuendos de oficina.",
  ])("con 8 en existencia, conserva «%s»", (description) => {
    const proposal = parseFor({ ...bolsasOutput, description }, bolsas);

    expect(guardProposal(proposal, bolsas).proposal.description).toBe(description);
  });
});

describe("guardProposal: descripción y propuesta de valor sin la primera persona del vendedor", () => {
  it.each([
    "Tengo bolsas de piel café hechas a mano.",
    "Vendo bolsas de piel café de excelente calidad.",
    "Me salen muy bien, por eso el precio es justo.",
    "Me cuesta hacerlas, pero valen la pena.",
    "Me cuestan más que las de fábrica.",
    "Me costaron más, pero el precio es justo.",
    "Las ofrezco con un acabado especial.",
    "Por ahora no cuento con más colores.",
    // La primera persona en plural (revisión del 2026-10-02).
    "Tenemos bolsas hechas a mano.",
    "Las ofrecemos con un acabado especial.",
    "Las vendemos con acabado especial.",
    "Contamos con varios tonos de piel.",
    "Nos salen caras, pero valen la pena.",
    "Nos cuesta hacerlas, pero valen la pena.",
    "Nos costaron más que las de fábrica.",
  ])("quita «%s»", (sentence) => {
    const proposal = parseFor(
      {
        ...bolsasOutput,
        description: `${sentence} Son piezas únicas con un acabado especial.`,
        valueProposition: `${sentence} Un producto único con acabado especial.`,
      },
      bolsas,
    );
    const { proposal: guarded, findings } = guardProposal(proposal, bolsas);

    expect(guarded.description).toBe("Son piezas únicas con un acabado especial.");
    expect(guarded.valueProposition).toBe("Un producto único con acabado especial.");
    expect(findings).toContain("number");
  });

  it("conserva la voz de quien compra en una pregunta, y la del vendedor en el post y los consejos", () => {
    const proposal = parseFor(
      {
        ...bolsasOutput,
        headline: "Bolsa de piel café hecha a mano",
        description:
          "¿Y cuánto me cuesta? Solo $1,199. Cuánto me cuesta con envío? Pregunta. Son piezas únicas.",
        valueProposition: "Un producto único con acabado especial.",
        adIdeas: ["Vendo bolsas de piel café hechas a mano. Pídelo aquí."],
        objections: [
          { objection: "¿Cuántas tienes?", answer: "Di que tienes varias, a $1,199 cada una." },
          {
            objection: "¿Por qué ese precio?",
            answer: "Di: «tengo pocas porque las hago a mano».",
          },
        ],
      },
      bolsas,
    );
    const { proposal: guarded, removed } = guardProposal(proposal, bolsas);

    expect(guarded.description).toBe(proposal.description);
    expect(guarded.valueProposition).toBe(proposal.valueProposition);
    expect(guarded.adIdeas).toEqual(proposal.adIdeas);
    expect(guarded.objections).toEqual(proposal.objections);
    expect(removed).toBe(0);
  });
});

describe("guardProposal: productName es un título de publicación", () => {
  const withTitle = (productName: string) =>
    guardProposal(parseFor({ ...bolsasOutput, productName }, bolsas), bolsas).proposal;

  it("usa el título que redactó la IA (singular) y con él arma los textos de respaldo", () => {
    const guarded = withTitle("Bolsa de piel café hecha a mano");

    expect(guarded.productName).toBe("Bolsa de piel café hecha a mano");
    expect(guarded.headline).toBe("Bolsa de piel café hecha a mano a $1,199 por pieza");
  });

  it("el código pone la mayúscula inicial, también al nombre del vendedor de respaldo", () => {
    expect(withTitle("bolsa de piel café").productName).toBe("Bolsa de piel café");
    expect(withTitle("bolsas de piel café").productName).toBe("Bolsas de piel café");
  });

  it.each([
    ["con cifras que no están en el nombre confirmado", "8 bolsas de piel café"],
    ["de otro producto", "Cartera de cuero negra"],
    ["con afirmaciones sin respaldo", "Bolsa de piel café original"],
    ["con el precio", "Bolsa de piel café a $1,199"],
  ])("un título %s se cambia por el nombre que confirmó el vendedor", (_reason, title) => {
    expect(withTitle(title).productName).toBe("Bolsas de piel café");
  });

  it("las marcas con mayúsculas propias no se tocan", () => {
    expect(guardProposal(parse(hostile), iphone).proposal.productName).toBe("iPhone 17 Pro");
  });

  it("sin mayúsculas de título (2026-10-02), salvo las que escribió el vendedor: marcas y modelos", () => {
    const jamaica = {
      ...bolsas,
      text: "Tengo 20 aguas de jamaica de litro, naturales y bien frías. Me salen en $18 cada una y las vendo a $45.",
      productName: "aguas de jamaica de litro",
      quantity: 20,
      priceCents: 4_500,
      costCents: 1_800,
    };
    const guitarra = {
      ...bolsas,
      text: "Vendo una guitarra acústica Yamaha C40 en buen estado, la compré en $2,800 y la dejo en $1,900.",
      productName: "guitarra acústica Yamaha C40",
      quantity: 1,
      priceCents: 190_000,
      costCents: 280_000,
    };
    const title = (productName: string, facts: typeof bolsas) =>
      guardProposal(parseFor({ ...bolsasOutput, productName }, facts), facts).proposal.productName;

    expect(title("Agua de Jamaica de Litro", jamaica)).toBe("Agua de jamaica de litro");
    expect(title("Guitarra Acústica Yamaha C40", guitarra)).toBe("Guitarra acústica Yamaha C40");
  });
});

describe("la propuesta simulada sigue las reglas nuevas", () => {
  it.each([
    bolsas,
    { ...bolsas, productName: "Control DualSense para PS5", quantity: 12, priceCents: 139_900 },
    { ...bolsas, productName: "Laptop Lenovo IdeaPad Ryzen 5", quantity: 3, priceCents: 899_900 },
    { ...bolsas, productName: "Pan de muerto mediano", quantity: 8, priceCents: 8_500 },
  ])("$productName ($quantity piezas) pasa el guardián sin cambios", (request) => {
    const proposal = parseFor(mockSaleProposal(request), request);
    const guarded = guardProposal(proposal, request);

    expect(guarded.removed).toBe(0);
    expect(guarded.findings).toEqual([]);
    expect(guarded.proposal).toEqual(proposal);
    for (const text of buyerFacing(proposal)) {
      expect(text).not.toMatch(new RegExp(String.raw`(?<![\d,.$–-])${request.quantity}\s+(?!s\b)`));
    }
  });
});
