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
    // Urgencia suave y escasez falsa (reevaluación del 2026-10-02): hay 3 en existencia.
    ["urgency", "No te quedes con las ganas."],
    ["urgency", "Aprovecha mientras haya."],
    ["urgency", "Aprovéchalo mientras dure."],
    ["urgency", "Única pieza a $20,000."],
    ["urgency", "Es el único disponible."],
    ["urgency", "Único par en existencia."],
    ["urgency", "Solo hay uno, a $20,000."],
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
    // «mientras» o «aprovecha» sin prisa tampoco.
    expect(hasUrgency("Toma la foto mientras haya luz natural.")).toBe(false);
    expect(hasUrgency("Aprovecha su bolsillo interior para tus llaves.")).toBe(false);
    for (const cta of ["Haz tu pedido aquí", "Aparta aquí", "Espera tu pedido con gusto."]) {
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
    // El costo oculto cuenta como cifra; las existencias y el lote, aparte (aviso y evaluación).
    expect(findings).toEqual(expect.arrayContaining(["number", "stock"]));
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
    expect(findings).toContain("stock");
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
    expect(findings).toContain("stock");
  });

  // Reevaluación en vivo del 2026-10-02: el pronombre en plural junto al precio también es el lote.
  it.each([
    "Llévatelas por $1,199.",
    "Cómpralas por $1,199.",
    "Apártalas hoy por $1,199.",
    "Te las dejo en $1,199.",
    "Las doy a $1,199.",
    "Todas a $1,199.",
    "Todas por solo $1,199.",
  ])("con 2 piezas o más, quita el pronombre en plural junto a un precio: «%s»", (sentence) => {
    const proposal = parseFor(
      { ...bolsasOutput, adIdeas: [sentence, "Bolsa de piel café a $1,199."] },
      bolsas,
    );
    const { proposal: guarded, findings } = guardProposal(proposal, bolsas);

    expect(guarded.adIdeas).toEqual(["Bolsa de piel café a $1,199."]);
    expect(findings).toContain("stock");
  });

  it.each([
    // El plural es del nombre de UN producto: un par de tenis, unas botas, unos audífonos.
    ["Tenis Nike Air Max 90", "Llévatelos por $1,199."],
    ["Botas vaqueras de piel", "Llévatelas por $1,199."],
    ["Audífonos de diadema inalámbricos", "Cómpralos por $1,199."],
    ["Audífonos de diadema inalámbricos", "Te los dejo en $1,199."],
    // Singular, o con el precio por pieza dicho.
    ["bolsas de piel café", "Llévatela por $1,199."],
    ["bolsas de piel café", "Llévatelas a $1,199 cada una."],
    ["bolsas de piel café", "Todas a $1,199 por pieza."],
    // «para todas» no habla del lote, ni un verbo que no es de compra.
    ["bolsas de piel café", "Un regalo para todas a $1,199."],
    ["bolsas de piel café", "Combínalas con todo, a $1,199."],
  ])("con 8 piezas de «%s» conserva «%s»", (productName, sentence) => {
    const facts = { ...bolsas, productName };
    const proposal = parseFor({ ...bolsasOutput, adIdeas: [sentence] }, facts);

    expect(guardProposal(proposal, facts).proposal.adIdeas).toEqual([sentence]);
  });

  it("el pronombre que no es del producto en plural sí cuenta («Funda para audífonos… llévatelas»)", () => {
    const facts = { ...bolsas, productName: "Funda para audífonos" };
    const proposal = parseFor(
      { ...bolsasOutput, adIdeas: ["Llévatelas por $1,199.", "Funda para audífonos a $1,199."] },
      facts,
    );

    expect(guardProposal(proposal, facts).proposal.adIdeas).toEqual([
      "Funda para audífonos a $1,199.",
    ]);
  });

  it.each([
    // «Pieza única» es de calidad (cada una es distinta), no escasez; ni el material ni una talla.
    "Cada bolsa es una pieza única, a $1,199.",
    "Son piezas únicas con un acabado especial.",
    "Hecha de una única pieza de piel, a $1,199.",
    "Solo hay una talla, a $1,199.",
  ])("no es escasez falsa: conserva «%s»", (sentence) => {
    const facts = bolsas;
    const proposal = parseFor({ ...bolsasOutput, adIdeas: [sentence] }, facts);

    expect(guardProposal(proposal, facts).proposal.adIdeas).toEqual([sentence]);
  });

  it.each([
    // Sin precio en la frase, o «todos» que no habla del producto.
    [8, "Todas nuestras bolsas son de piel."],
    [8, "Bolsa de piel café para todos los días, a $1,199."],
    [8, "Combina con todo, a $1,199."],
    // Con una sola pieza no hay lote que confundir.
    [1, "Todas las bolsas de piel café por $1,199."],
    [1, "Llévatelas por $1,199."],
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
    expect(findings).toContain("stock");
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
    expect(findings).toContain("stock");
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
    // Posesivos y quien lo hace (reevaluación del 2026-10-02).
    "Nuestras bolsas son de piel café.",
    "Hechas por mí en mi taller.",
    "Las hago yo misma.",
    "Las hacemos a mano, una por una.",
    "Mi taller está en Oaxaca.",
    "Te la dejo con un acabado especial.",
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
    expect(findings).toContain("voice");
  });

  it("«Mi» de una marca o «yo-yo» no son la voz del vendedor", () => {
    const rules = (productName: string) => ({
      productName,
      allowedCents: new Set<number>(),
      quantity: null,
      claimKinds: [],
      noSellerVoice: true,
    });

    expect(
      textFindings("Se sincroniza con la app Mi Fitness.", rules("Reloj Xiaomi Mi Band 8")),
    ).toEqual(new Set());
    expect(
      textFindings("Xiaomi Mi Band 8 con pantalla AMOLED.", rules("xiaomi mi band 8")),
    ).toEqual(new Set());
    expect(textFindings("Un yo-yo de madera que gira suave.", rules("Juguete de madera"))).toEqual(
      new Set(),
    );
    expect(textFindings("Hechas por mí en mi taller.", rules("Bolsa de piel"))).toEqual(
      new Set(["voice"]),
    );
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

  // Reevaluación del 2026-10-02: el título pasaba en plural o en la voz del vendedor.
  const titleOf = (productName: string, facts: typeof bolsas) =>
    guardProposal(parseFor({ ...mockSaleProposal(facts), productName }, facts), facts);
  const jamaica = {
    ...bolsas,
    text: "Tengo 20 aguas de jamaica de litro. Me salen en $18 y las vendo a $45.",
    productName: "aguas de jamaica de litro",
    quantity: 20,
    priceCents: 4_500,
    costCents: 1_800,
  };

  it.each([
    ["voice", "Vendo bolsa de piel café"],
    ["voice", "Tengo bolsas de piel café"],
    ["voice", "Nuestra bolsa de piel café"],
    ["stock", "Bolsa de piel café en total"],
    ["stock", "Lote de bolsa de piel café"],
    ["stock", "Bolsas de piel café hechas a mano"],
    ["stock", "Hermosas bolsas de piel café"],
    ["stock", "Las bolsas de piel café"],
  ] as const)("un título con «%s» se cambia por el nombre del vendedor: «%s»", (finding, title) => {
    const { proposal, removed, findings } = titleOf(title, bolsas);

    expect(proposal.productName).toBe("Bolsas de piel café");
    expect(removed).toBe(1);
    expect(findings).toEqual([finding]);
  });

  it("un título en plural de la IA no pasa con 2 piezas o más, aunque el vendedor escriba en plural", () => {
    const { proposal, findings } = titleOf("Aguas de jamaica", jamaica);

    expect(proposal.productName).toBe("Aguas de jamaica de litro");
    expect(findings).toEqual(["stock"]);
    // Con una pieza no hay lote que confundir.
    const one = { ...jamaica, quantity: 1 };
    expect(titleOf("Aguas de jamaica", one).proposal.productName).toBe("Aguas de jamaica");
  });

  it("el nombre del vendedor copiado tal cual es suyo: no cuenta como frase quitada", () => {
    const { proposal, removed } = titleOf("bolsas de piel café", bolsas);

    expect(proposal.productName).toBe("Bolsas de piel café");
    expect(removed).toBe(0);
  });

  it.each([
    // El plural es del nombre de UN producto, o la palabra termina en «s» y es singular.
    ["Tenis Nike Air Max 90", "Tenis Nike Air Max 90 blancos"],
    ["audífonos Sony WH-1000XM4", "Audífonos Sony WH-1000XM4 inalámbricos"],
    ["botas vaqueras", "Botas vaqueras de piel"],
    ["AirPods Pro 2", "Nuevos AirPods Pro 2"],
    ["Cubrebocas KN95", "Cubrebocas KN95 en caja"],
    ["paraguas plegable", "Paraguas plegable negro"],
    ["pastel tres leches", "Tres leches de fresa"],
    ["tenis adidas superstar", "Adidas Superstar blancos"],
  ])("con 8 piezas de «%s», el título singular «%s» se queda", (productName, title) => {
    const facts = { ...bolsas, productName, text: productName };
    const { proposal, removed } = titleOf(title, facts);

    expect(proposal.productName).toBe(title);
    expect(removed).toBe(0);
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

describe("guardProposal: la plataforma no verifica nada (P4)", () => {
  // El caso real del 2026-10-02 (qwen/qwen3.5-9b, sale-proposal@5), en «Lo que te van a preguntar».
  const real =
    "El vendedor indica que es de piel, pero la plataforma verifica estos detalles con las fotos.";
  /** Reglas de los consejos para el vendedor: sin afirmaciones P4 que revisar. */
  const advice = {
    productName: "bolsas de piel café",
    allowedCents: new Set<number>(),
    quantity: null,
    claimKinds: [],
  };

  it("quita el caso real de «Lo que te van a preguntar»", () => {
    const proposal = parseFor(
      {
        ...bolsasOutput,
        objections: [
          { objection: "¿Es piel genuina?", answer: real },
          { objection: "¿Es de piel?", answer: "Muestra de cerca la textura de la piel." },
        ],
      },
      bolsas,
    );
    const { proposal: guarded, findings } = guardProposal(proposal, bolsas);

    expect(guarded.objections).toEqual([
      { objection: "¿Es de piel?", answer: "Muestra de cerca la textura de la piel." },
    ]);
    expect(findings).toContain("claim");
  });

  it.each([
    real,
    "La plataforma revisa que la piel sea real.",
    "speeaking revisa cada publicación antes de mostrarla.",
    "Speeaking verifica el material con las fotos.",
    "La plataforma se encarga de verificar la autenticidad.",
    "La plataforma te garantiza una compra segura.",
    "Verificamos cada bolsa antes de publicarla.",
    "Lo revisamos antes de que llegue a tus manos.",
    "Hemos comprobado el material de cada pieza.",
    "Nuestro equipo revisa cada pieza.",
    "Material comprobado por la plataforma.",
    "Producto verificado por speeaking.",
    "Piel certificada por expertos.",
    "Compra con la garantía de speeaking.",
  ])("quita «%s» de lo que ve quien compra y de los consejos", (sentence) => {
    const proposal = parseFor(
      {
        ...bolsasOutput,
        description: `${sentence} Son piezas únicas con un acabado especial.`,
        adIdeas: [sentence, "Bolsa de piel café a $1,199."],
        contentIdeas: [sentence, "Foto de la bolsa con luz natural."],
        budgetRationale: `Empieza con poco y mide. ${sentence}`,
        objections: [
          { objection: "¿Es de piel?", answer: sentence },
          { objection: "¿Por qué ese precio?", answer: "Explica que cada pieza es hecha a mano." },
        ],
        assumptions: [sentence, "Usamos los datos que confirmaste."],
      },
      bolsas,
    );
    const { proposal: guarded, findings } = guardProposal(proposal, bolsas);

    expect(guarded.description).toBe("Son piezas únicas con un acabado especial.");
    expect(guarded.adIdeas).toEqual(["Bolsa de piel café a $1,199."]);
    expect(guarded.contentIdeas).toEqual(["Foto de la bolsa con luz natural."]);
    expect(guarded.budgetRationale).toBe("Empieza con poco y mide.");
    expect(guarded.objections.map((item) => item.objection)).toEqual(["¿Por qué ese precio?"]);
    expect(guarded.assumptions).toEqual(["Usamos los datos que confirmaste."]);
    expect(findings).toContain("claim");
    expect(textFindings(sentence, advice)).toEqual(new Set(["claim"]));
  });

  it.each([
    // Lo que hace quien compra o quien vende, no la plataforma.
    "Revisa las fotos y pregunta cualquier detalle antes de comprar.",
    "El vendedor puede mostrar el ticket.",
    "Muestra el ticket para que quien compra lo compruebe.",
    "Verifica las medidas antes de comprar.",
    "Comprueba tú mismo la textura con fotos de cerca.",
    "Responde solo con lo que puedas comprobar (factura, empaque sellado).",
    // Lo que la plataforma NO hace, dicho con honestidad.
    "La plataforma no verifica materiales: muestra fotos de cerca.",
    "Nosotros no revisamos el material; enséñalo en fotos.",
    // «La plataforma» como lugar, no como quien revisa.
    "Dentro de la plataforma revisa con quien compra la talla.",
    "Acuerda la entrega dentro de la plataforma y revisa la talla con quien compra.",
    "Sube tus fotos a la plataforma revisando que se vean bien.",
    // El producto, no la plataforma: la app de un reloj, un equipo usado, zapatos de plataforma.
    "La app revisa tu ritmo cardiaco todo el día.",
    "El equipo se revisó y funciona perfecto.",
    "La plataforma te asegura estabilidad al caminar.",
    // «garantía» sin la plataforma (en los consejos es legítimo).
    "El presupuesto sugerido es una prueba inicial, no una garantía de ventas.",
  ])("conserva «%s»", (sentence) => {
    expect(textFindings(sentence, advice).size).toBe(0);
    const proposal = parseFor(
      {
        ...bolsasOutput,
        objections: [{ objection: "¿Es de piel?", answer: sentence }],
        assumptions: [sentence],
      },
      bolsas,
    );
    const { proposal: guarded } = guardProposal(proposal, bolsas);

    expect(guarded.objections).toEqual(proposal.objections);
    expect(guarded.assumptions).toEqual(proposal.assumptions);
  });
});

describe("guardProposal: escasez falsa (P12, regla 3)", () => {
  it("quita el caso real: «Única pieza disponible» en el titular con 8 en existencia", () => {
    // qwen/qwen3.5-9b, sale-proposal@6 (2026-10-02): el titular va grande en el video promocional.
    const proposal = parseFor(
      { ...bolsasOutput, headline: "Bolsa de piel café hecha a mano. Única pieza disponible." },
      bolsas,
    );
    const { proposal: guarded, findings } = guardProposal(proposal, bolsas);

    expect(guarded.headline).toBe("Bolsa de piel café hecha a mano.");
    expect(findings).toContain("urgency");
  });

  it.each([
    "Única pieza disponible.",
    "Única pieza por $1,199.",
    "Es la única pieza que tengo.",
    "Una única pieza disponible.",
    "Pieza única disponible.",
    "Última pieza.",
    "Últimas unidades.",
    "Última unidad disponible.",
    "Solo queda una.",
    "Sólo me queda 1.",
    "Solo nos quedan dos.",
    "Solo hay una.",
    "Solo hay 1 disponible.",
    "Solo tengo una pieza.",
    "Me queda una sola.",
    "Queda solo una.",
    "Quedan pocas.",
    "Quedan poquitas.",
    "Es la única que queda.",
    "Solo una disponible.",
  ])("quita «%s» de todo: lo publicable y los consejos", (sentence) => {
    expect(hasUrgency(sentence)).toBe(true);
    const proposal = parseFor(
      {
        ...bolsasOutput,
        description: `${sentence} Son piezas únicas con un acabado especial.`,
        adIdeas: [sentence, "Bolsa de piel café a $1,199."],
        objections: [
          { objection: "¿Cuántas tienes?", answer: sentence },
          { objection: "¿Por qué ese precio?", answer: "Explica que cada pieza es hecha a mano." },
        ],
      },
      bolsas,
    );
    const { proposal: guarded, findings } = guardProposal(proposal, bolsas);

    expect(guarded.description).toBe("Son piezas únicas con un acabado especial.");
    expect(guarded.adIdeas).toEqual(["Bolsa de piel café a $1,199."]);
    expect(guarded.objections.map((item) => item.objection)).toEqual(["¿Por qué ese precio?"]);
    expect(findings).toContain("urgency");
  });

  it.each([
    // «Pieza única» es irrepetible (hecha a mano), no la última disponible.
    "Pieza única hecha a mano.",
    "Bolsa de piel café, pieza única hecha a mano.",
    "Cada pieza es única.",
    "Una pieza única para tu estilo.",
    // Hechura: de una sola pieza de piel.
    "Estilo y artesanía en una sola pieza.",
    "Cortada en una única pieza de piel.",
    // «Solo queda…» o «solo hay una…» que no habla de existencias.
    "Solo queda elegir tu color.",
    "Solo te queda pedirla.",
    "Solo queda una cosa: elegir tu tono.",
    "Solo hay una talla: unitalla.",
    "¿Y si no me queda?",
  ])("conserva «%s»", (sentence) => {
    expect(hasUrgency(sentence)).toBe(false);
    const proposal = parseFor(
      {
        ...bolsasOutput,
        description: `${sentence} Son piezas únicas con un acabado especial.`,
        objections: [{ objection: "¿Es de piel?", answer: sentence }],
      },
      bolsas,
    );
    const { proposal: guarded } = guardProposal(proposal, bolsas);

    expect(guarded.description).toBe(proposal.description);
    expect(guarded.objections).toEqual(proposal.objections);
  });
});

describe("guardProposal: lo que se atribuye al vendedor debe estar en su texto (P4)", () => {
  // El caso real del 2026-10-02 (qwen/qwen3.5-9b, sale-proposal@6): el vendedor nunca dijo «original».
  const real =
    "Al ser una pieza hecha a mano, cada una es única. El vendedor menciona que es original, pero te sugiero pedirle fotos de cerca.";
  const honest = { objection: "¿Es de piel?", answer: "Muestra de cerca la textura de la piel." };
  /** Las bolsas, pero el vendedor sí escribió «originales». */
  const originales = {
    ...bolsas,
    text: "Vendo 8 bolsas originales de piel café. Me salen en $650 cada una y quiero venderlas a $1,199.",
  };

  it("quita el caso real de «Lo que te van a preguntar»", () => {
    const proposal = parseFor(
      { ...bolsasOutput, objections: [{ objection: "¿Es original?", answer: real }, honest] },
      bolsas,
    );
    const { proposal: guarded, findings } = guardProposal(proposal, bolsas);

    expect(guarded.objections).toEqual([honest]);
    expect(findings).toContain("claim");
  });

  it.each([
    "El vendedor menciona que es original.",
    "El vendedor asegura que son auténticas.",
    "La vendedora dice que es nueva.",
    "Según el vendedor, tiene garantía.",
    "Es de marca, según la vendedora.",
    "El vendedor también comenta que trae factura.",
    "Quien vende afirma que está sellada.",
    "El vendedor dijo que es de gamuza.",
    // «piel» sí la escribió; «original», no.
    "El vendedor indica que es de piel y original.",
  ])("quita «%s» (el vendedor no lo escribió) de todo, también de los consejos", (sentence) => {
    const proposal = parseFor(
      {
        ...bolsasOutput,
        description: `${sentence} Son piezas únicas con un acabado especial.`,
        objections: [{ objection: "¿Es original?", answer: sentence }, honest],
        assumptions: [sentence, "Usamos los datos que confirmaste."],
        budgetRationale: `Empieza con poco y mide. ${sentence}`,
      },
      bolsas,
    );
    const { proposal: guarded, findings } = guardProposal(proposal, bolsas);

    expect(guarded.description).toBe("Son piezas únicas con un acabado especial.");
    expect(guarded.objections).toEqual([honest]);
    expect(guarded.assumptions).toEqual(["Usamos los datos que confirmaste."]);
    expect(guarded.budgetRationale).toBe("Empieza con poco y mide.");
    expect(findings).toContain("claim");
  });

  it.each([
    // Lo escribió (o su sinónimo: «elaborado a mano» por «hechas a mano»).
    "El vendedor indica que es de piel.",
    "La vendedora dice que son hechas a mano.",
    "El vendedor indica que es un producto elaborado a mano.",
    // Lo que sigue a «pero» o a «, lo que» ya no se le atribuye.
    "El vendedor indica que es de piel, pero pídele la factura.",
    "El vendedor indica que son piezas hechas a mano, lo que implica un proceso artesanal.",
    // No le atribuye nada.
    "El vendedor no menciona que sea original: pídele fotos.",
    "El vendedor puede mostrar el ticket si lo tiene.",
  ])("conserva «%s» con el texto de las bolsas", (sentence) => {
    const proposal = parseFor(
      {
        ...bolsasOutput,
        // La pregunta de quien compra («¿Es original?») no es parte de lo que se atribuye.
        objections: [{ objection: "¿Es original o es de piel?", answer: sentence }],
        assumptions: [sentence],
      },
      bolsas,
    );
    const { proposal: guarded } = guardProposal(proposal, bolsas);

    expect(guarded.objections).toEqual(proposal.objections);
    expect(guarded.assumptions).toEqual(proposal.assumptions);
  });

  it("«El vendedor indica que es de piel» también se queda en la descripción", () => {
    const description =
      "El vendedor indica que es de piel. Son piezas únicas con un acabado especial.";
    const proposal = parseFor({ ...bolsasOutput, description }, bolsas);

    expect(guardProposal(proposal, bolsas).proposal.description).toBe(description);
  });

  it("si el vendedor escribió «original», atribuírselo en los consejos es fiel; publicarlo sigue sin respaldo", () => {
    const sentence = "La vendedora dice que es original.";
    const proposal = parseFor(
      {
        ...bolsasOutput,
        description: `${sentence} Son piezas únicas con un acabado especial.`,
        objections: [{ objection: "¿Es original?", answer: sentence }],
        assumptions: [sentence],
      },
      originales,
    );
    const { proposal: guarded } = guardProposal(proposal, originales);

    expect(guarded.objections).toEqual(proposal.objections);
    expect(guarded.assumptions).toEqual(proposal.assumptions);
    // Lo publicable no repite «original» aunque lo diga el vendedor (regla 10, P4).
    expect(guarded.description).toBe("Son piezas únicas con un acabado especial.");
  });

  it("se revisa con el texto del vendedor y el nombre que confirmó; sin texto, solo cuenta el nombre", () => {
    const rules = {
      productName: "bolsas de piel café",
      allowedCents: new Set<number>(),
      quantity: null,
      claimKinds: [],
    };
    const sentence = "El vendedor menciona que es original.";

    expect(textFindings(sentence, { ...rules, sellerText: bolsas.text })).toEqual(
      new Set(["claim"]),
    );
    expect(textFindings(sentence, { ...rules, sellerText: originales.text }).size).toBe(0);
    // Sin `sellerText` (p. ej. el kit de anuncios) no se revisan las atribuciones.
    expect(textFindings(sentence, rules).size).toBe(0);

    const { text: _text, ...withoutText } = originales;
    const named = { ...withoutText, productName: "bolsas originales de piel" };
    const proposal = parseFor(
      { ...bolsasOutput, objections: [{ objection: "¿Es original?", answer: sentence }, honest] },
      originales,
    );
    expect(guardProposal(proposal, named).proposal.objections).toHaveLength(2);
    expect(guardProposal(proposal, withoutText).proposal.objections).toEqual([honest]);
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
      // Llamados sin pronombre: «Bolsa… Aparta el tuyo» y «Pídelo aquí» no concordaban (2026-10-02).
      expect(text).not.toMatch(/p[ií]delo|el tuyo|la tuya/i);
    }
    expect(proposal.adIdeas).toContain(
      `¿Buscabas ${proposal.productName}? Precio justo y trato directo. Aparta aquí.`,
    );
  });
});
