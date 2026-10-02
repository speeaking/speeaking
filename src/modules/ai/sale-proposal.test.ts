import { describe, expect, it } from "vitest";
import { PROPOSAL_FINAL_CHECK, SELLER_COPY_RULES, saleProposalTask } from "./tasks/sale-proposal";
import {
  knownCategorySlug,
  listingTitle,
  parseSellerText,
  saleProposalSchema,
  sellerTextForModel,
  withoutCostMentions,
} from "./sale-proposal";

/** Marcas de redacción (`withoutCostMentions`, `redactPersonalData`): nunca deben llegar al modelo. */
const MARKER = /\[(?:costo|teléfono|correo|liga|usuario|cuenta)\]/i;

/** El caso real del 2026-10-02 (qwen/qwen3.5-9b, sale-proposal@4). */
const bolsas = {
  text: "Vendo 8 bolsas de piel café, hechas a mano. Me salen en $650 cada una y quiero venderlas a $1,199.",
  productName: "bolsas de piel café",
  quantity: 8,
  priceCents: 119_900,
  costCents: 65_000,
  city: null,
  hasPhoto: false,
};

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

  it("entiende los ejemplos del formulario: «me cuesta $180» no es el precio", () => {
    expect(
      parseSellerText(
        "Vendo 20 pasteles de tres leches, me cuesta $180 hacer cada uno y los vendo a $450.",
      ),
    ).toEqual({
      productName: "pasteles de tres leches",
      quantity: 20,
      costCents: 18_000,
      priceCents: 45_000,
    });
    // Ejemplos genéricos y hechos a mano, sin marcas de terceros (revisión del video, 2026-10-02).
    expect(
      parseSellerText(
        "Tengo 30 velas aromáticas de soya. Me costaron $45 cada una y quiero venderlas a $120.",
      ),
    ).toEqual({
      productName: "velas aromáticas de soya",
      quantity: 30,
      costCents: 4_500,
      priceCents: 12_000,
    });
    expect(
      parseSellerText(
        "Vendo 12 macetas de barro, pintadas a mano. Me salen en $60 cada una y las doy a $150.",
      ),
    ).toEqual({
      productName: "macetas de barro",
      quantity: 12,
      costCents: 6_000,
      priceCents: 15_000,
    });
  });

  it("«a $» cuenta como precio solo si «a» es una palabra suelta", () => {
    expect(
      parseSellerText("Vendo 8 bolsas de piel, me salen en $650 y las doy a $1,199."),
    ).toMatchObject({ costCents: 65_000, priceCents: 119_900 });
    expect(parseSellerText("Vendo 4 lámparas; me cuesta $300 cada una")).toMatchObject({
      costCents: 30_000,
      priceCents: null,
    });
  });

  it("prefiere el precio con palabra clave («precio», «la dejo en») a un «a $» suelto", () => {
    // Evaluación del 2026-10-02: el «a $45» del costo («Me salen a $45 c/u») salía como precio.
    expect(
      parseSellerText(
        "Tengo 30 labiales mate de larga duración, varios tonos. Me salen a $45 c/u, precio $120 c/u.",
      ),
    ).toEqual({
      productName: "labiales mate de larga duración",
      quantity: 30,
      costCents: 4_500,
      priceCents: 12_000,
    });
    expect(
      parseSellerText(
        "Vendo una guitarra acústica Yamaha C40 en buen estado, la compré en $2,800 y la dejo en $1,900.",
      ),
    ).toMatchObject({ costCents: 280_000, priceCents: 190_000 });
    expect(parseSellerText("Vendo mi bicicleta de montaña, lo dejo en $1,900.")).toMatchObject({
      costCents: null,
      priceCents: 190_000,
    });
  });

  it("nunca toma como precio el monto del costo", () => {
    expect(parseSellerText("Me salen a $45 c/u.")).toMatchObject({
      costCents: 4_500,
      priceCents: null,
    });
    expect(parseSellerText("Vendo en Puebla; me cuesta $300 cada una.")).toMatchObject({
      costCents: 30_000,
      priceCents: null,
    });
  });

  it.each([
    // «vendo en / doy a / dejo en» seguido de un número que no es el precio (revisión del 2026-10-02):
    // el formulario lo escribía en «Precio c/u».
    [
      "Vendo en Guadalajara 15 playeras de anime, me cuestan $120 y las doy a $259.",
      12_000,
      25_900,
    ],
    ["Vendo en CDMX 20 termos Stanley, precio $599.", null, 59_900],
    ["Vendo en Monterrey 3 bicicletas rodada 26 a $2,500.", null, 250_000],
    ["Vendo a domicilio en Puebla, 12 cajas, costo $80, precio $150.", 8_000, 15_000],
    ["Vendo en buen estado 2 sillas a $450.", null, 45_000],
    ["Vendo a 10 minutos del centro, 5 sillas, precio $450.", null, 45_000],
    ["Vendo en 3 colores: negro, rojo y azul. Precio $199.", null, 19_900],
    ["Te doy a escoger entre 4 colores, precio $199.", null, 19_900],
    ["Doy a 2 cuadras del metro. Precio $350.", null, 35_000],
    ["Las dejo en 2 días si me avisas. Precio $350, costo $200.", 20_000, 35_000],
  ])(
    "un número cerca de «vendo en / doy a / dejo en» no es el precio: «%s»",
    (text, cost, price) => {
      expect(parseSellerText(text)).toMatchObject({ costCents: cost, priceCents: price });
    },
  );

  it("el verbo de venta sí anuncia el precio si el monto va justo después", () => {
    expect(parseSellerText("Tengo 10 bolsas, las doy a 350, me salen en 200.")).toMatchObject({
      costCents: 20_000,
      priceCents: 35_000,
    });
    expect(parseSellerText("Vendo 4 lámparas, las dejo en 900 c/u")).toMatchObject({
      priceCents: 90_000,
    });
    expect(parseSellerText("Tengo 5 sillas y las vendo en 1200 pesos")).toMatchObject({
      priceCents: 120_000,
    });
    expect(parseSellerText("quiero venderlos a 3499 y me costaron 2400")).toMatchObject({
      costCents: 240_000,
      priceCents: 349_900,
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
    // Ni la marca: el modelo la copiaba a la descripción pública («Me salen en [costo] cada una»).
    expect(user).not.toMatch(MARKER);
    expect(user).toContain("Tengo 10 bocinas.");
  });
});

describe("sellerTextForModel (lo que ve el modelo del texto del vendedor)", () => {
  const secret = (request: { costCents: number; quantity: number; priceCents: number }) => ({
    costCents: request.costCents,
    quantity: request.quantity,
    priceCents: request.priceCents,
  });

  it("quita la cláusula entera del costo, sin dejar una marca que el modelo pueda copiar", () => {
    expect(sellerTextForModel(bolsas.text, secret(bolsas))).toBe(
      "Vendo 8 bolsas de piel café, hechas a mano.",
    );
    expect(
      sellerTextForModel(
        "Tengo 50 AirPods Pro 2. Me costaron $2,400 y quiero venderlos a $3,499.",
        { costCents: 240_000, quantity: 50, priceCents: 349_900 },
      ),
    ).toBe("Tengo 50 AirPods Pro 2.");
  });

  it("conserva lo demás y deja la puntuación en orden", () => {
    expect(
      sellerTextForModel(
        "Vendo 20 pasteles de tres leches, me cuesta $180 hacer cada uno y los vendo a $450. Los hago en Coyoacán.",
        { costCents: 18_000, quantity: 20, priceCents: 45_000 },
      ),
    ).toBe("Vendo 20 pasteles de tres leches. Los hago en Coyoacán.");
    // Los montos con comas o decimales no parten la cláusula.
    expect(
      sellerTextForModel("Salsa macha de 250 ml, hecha en casa. Costo $32.50, precio $89.50.", {
        costCents: 3_250,
        quantity: 40,
        priceCents: 8_950,
      }),
    ).toBe("Salsa macha de 250 ml, hecha en casa. Precio $89.50.");
  });

  it("también quita las cláusulas con datos de contacto (SEC-29), no solo los datos", () => {
    const text = sellerTextForModel(
      "Vendo termos Stanley de 1.2 litros, colores pastel. Mándame WhatsApp al 55 1234 5678 o escríbeme a ventas@termos.mx. Costo $380, precio $599.",
      { costCents: 38_000, quantity: 15, priceCents: 59_900 },
    );
    expect(text).toBe("Vendo termos Stanley de 1.2 litros, colores pastel. Precio $599.");
    expect(text).not.toMatch(MARKER);
  });

  it("sin puntuación (escrito en el celular), conserva lo que va antes del costo o del contacto", () => {
    // Revisión del 2026-10-02: la cláusula era TODO el texto y al modelo no le llegaba nada.
    const bolsasText = sellerTextForModel(
      "Vendo 8 bolsas de piel café hechas a mano con forro de tela me salen en $650 y las vendo a $1,199",
      secret(bolsas),
    );
    expect(bolsasText).toBe("Vendo 8 bolsas de piel café hechas a mano con forro de tela");

    const termos = sellerTextForModel(
      "Vendo termos Stanley de 1.2 litros colores pastel mándame whats al 55 1234 5678 precio $599",
      { costCents: 38_000, quantity: 15, priceCents: 59_900 },
    );
    expect(termos).toBe("Vendo termos Stanley de 1.2 litros colores pastel");

    // «y a mí me salen…»: no deja la conjunción ni el «a mí» colgando; el punto final se queda.
    expect(
      sellerTextForModel(
        "Hago pasteles de tres leches con fresas naturales y a mí me salen en $180 cada uno.",
        { costCents: 18_000, quantity: 20, priceCents: 45_000 },
      ),
    ).toBe("Hago pasteles de tres leches con fresas naturales.");
    // Corta en la palabra más cercana a la marca: el «celular» del producto no anuncia el contacto.
    expect(
      sellerTextForModel("Vendo celular Samsung A15 nuevo mándame whats al 55 1234 5678", {
        costCents: 200_000,
        quantity: 5,
        priceCents: 349_900,
      }),
    ).toBe("Vendo celular Samsung A15 nuevo");
    expect(
      sellerTextForModel("Vendo fundas para celular de piel me costaron 80 c/u", {
        costCents: 8_000,
        quantity: 30,
        priceCents: 19_900,
      }),
    ).toBe("Vendo fundas para celular de piel");
    for (const text of [bolsasText, termos]) {
      expect(text).not.toMatch(MARKER);
      expect(text).not.toMatch(/650|1234|5678|salen|whats|mándame/i);
    }
  });

  it("si no hay palabra que anuncie el dato oculto, o lo de antes no dice nada, quita la cláusula entera", () => {
    expect(
      sellerTextForModel("Tengo 10 bocinas portátiles con luces di $24,000 por todas", {
        costCents: 240_000,
        quantity: 10,
        priceCents: 349_900,
      }),
    ).toBe("");
    expect(
      sellerTextForModel("Tengo 10 bocinas. A mí me sale en $2,400, precio $3,499.", {
        costCents: 240_000,
        quantity: 10,
        priceCents: 349_900,
      }),
    ).toBe("Tengo 10 bocinas. Precio $3,499.");
  });

  it("al modelo le llegan los detalles del producto aunque el vendedor no puntúe", () => {
    const { user } = saleProposalTask.messages({
      ...bolsas,
      text: "Vendo 8 bolsas de piel café hechas a mano con forro de tela me salen en $650 y las vendo a $1,199",
      categories: [],
    });
    expect(user).toContain("hechas a mano con forro de tela");
    expect(user).not.toContain("(sin más detalles)");
    expect(user).not.toMatch(/650|me salen/i);
  });

  it("si solo hablaba del costo, no queda nada", () => {
    expect(
      sellerTextForModel("Me costaron $2,400.", {
        costCents: 240_000,
        quantity: 1,
        priceCents: 349_900,
      }),
    ).toBe("");
  });
});

describe("listingTitle (título de la publicación: mayúscula inicial por código, P2)", () => {
  it.each([
    ["bolsas de piel café", "Bolsas de piel café"],
    ["bolsa de piel café hecha a mano", "Bolsa de piel café hecha a mano"],
    ["ácido hialurónico 50 ml", "Ácido hialurónico 50 ml"],
    ["  tenis   nike  ", "Tenis nike"],
    // Marcas y modelos con mayúsculas propias se respetan.
    ["iPhone 17 Pro", "iPhone 17 Pro"],
    ["eBook Kindle", "eBook Kindle"],
    ["Bocina JBL Flip 6", "Bocina JBL Flip 6"],
  ])("«%s» → «%s»", (name, title) => {
    expect(listingTitle(name)).toBe(title);
  });

  // Los títulos del 2026-10-02 (qwen/qwen3.5-9b, sale-proposal@5), con el nombre y el texto de cada caso.
  const jamaica = [
    "aguas de jamaica de litro",
    "Tengo 20 aguas de jamaica de litro, naturales y bien frías. Me salen en $18 cada una y las vendo a $45.",
  ];
  const playeras = [
    "playeras estampadas de anime",
    "Vendo 15 playeras estampadas de anime, tallas CH a G. A mí me cuesta $120 cada una y las doy a $259.",
  ];
  const labiales = [
    "labiales mate de larga duración",
    "Tengo 30 labiales mate de larga duración, varios tonos. Me salen a $45 c/u, precio $120 c/u.",
  ];
  const guitarra = [
    "guitarra acústica Yamaha C40",
    "Vendo una guitarra acústica Yamaha C40 en buen estado, la compré en $2,800 y la dejo en $1,900.",
  ];
  const audifonos = [
    "audífonos Sony WH-1000XM4",
    "Vendo 5 audífonos Sony WH-1000XM4, originales y sellados. Los vendo a $5,499.",
  ];

  it.each([
    ["Agua de Jamaica de Litro", "Agua de jamaica de litro", jamaica],
    ["Playera Estampada de Anime", "Playera estampada de anime", playeras],
    ["Labial Mate de Larga Duración", "Labial mate de larga duración", labiales],
    ["Labial Mate", "Labial mate", labiales],
    ["Bolsa De Piel Hecha A Mano", "Bolsa de piel hecha a mano", ["bolsas de piel"]],
  ])("sin mayúsculas de título: «%s» → «%s»", (name, title, sources) => {
    expect(listingTitle(name, sources)).toBe(title);
  });

  it.each([
    // Como las escribió el vendedor (en el nombre confirmado o en su texto).
    ["Guitarra Acústica Yamaha C40", "Guitarra acústica Yamaha C40", guitarra],
    ["Audífonos Sony WH-1000XM4", "Audífonos Sony WH-1000XM4", audifonos],
    ["Playera Anime Talla CH", "Playera anime talla CH", playeras],
    // Siglas y mayúsculas propias, aunque el vendedor las escriba en minúsculas.
    ["Bocina JBL Flip 6", "Bocina JBL flip 6", ["bocina jbl flip 6"]],
    ["Cable USB-C De Carga Rápida", "Cable USB-C de carga rápida", ["cable usb-c de carga rápida"]],
    ["Funda Para iPhone 17", "Funda para iPhone 17", ["funda para iphone 17"]],
    ["Playera Talla G", "Playera talla G", ["playeras de anime"]],
  ])("marcas, modelos y siglas se respetan: «%s» → «%s»", (name, title, sources) => {
    expect(listingTitle(name, sources)).toBe(title);
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

describe("prompt de «Vende con IA» (sale-proposal@6): precio por pieza, título y descripción", () => {
  const { system, user } = saleProposalTask.messages({ ...bolsas, categories: [] });

  it("sube la versión del prompt", () => {
    expect(saleProposalTask.promptVersion).toBe("sale-proposal@6");
  });

  it("los datos dicen que el precio es por pieza y que las piezas son existencias, no un lote", () => {
    expect(user).toContain('"precioPorPieza":"$1,199"');
    expect(user).toContain('"existencias":8');
    expect(user).not.toMatch(/"precio"|"piezas"/);
    expect(system).toMatch(
      /\$1,199 es el precio de UNA pieza y el único que puedes escribir, nunca como precio de varias/,
    );
    expect(system).toMatch(/Las 8 piezas son existencias, no un lote/);
  });

  it("los textos no dicen cuántas piezas hay, y la revisión final lo recuerda al último", () => {
    expect(system).toMatch(/no un lote: no digas cuántas hay/);
    expect(PROPOSAL_FINAL_CHECK).toMatch(
      /El precio es por pieza: no digas que paga varias ni cuántas piezas hay/,
    );
    expect(user.endsWith(PROPOSAL_FINAL_CHECK)).toBe(true);
  });

  it("productName es un título en singular y description describe el producto para quien compra", () => {
    expect(system).toMatch(
      /productName: título en singular \(«Bolsa de piel», no «bolsas de piel»\)/,
    );
    expect(system).toMatch(
      /description: describe el producto para quien compra, sin copiar el texto del vendedor ni su primera persona/,
    );
  });

  it("el texto del vendedor llega sin la cláusula del costo y sin marcas", () => {
    expect(user).toContain("Vendo 8 bolsas de piel café, hechas a mano.");
    expect(user).not.toMatch(MARKER);
    expect(user).not.toMatch(/650|Me salen/);
  });
});

describe("prompt de «Vende con IA» (reglas de siempre)", () => {
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

  it("los llamados sugeridos no tienen género (el video: «Bolsa… Aparta el tuyo»)", () => {
    expect(SELLER_COPY_RULES).toContain("«Pídelo aquí» o «Haz tu pedido aquí»");
    expect(PROPOSAL_FINAL_CHECK).toContain("«Pídelo aquí» o «Haz tu pedido aquí»");
    for (const text of [SELLER_COPY_RULES, PROPOSAL_FINAL_CHECK, system, user]) {
      expect(text).not.toMatch(/aparta (?:el tuyo|la tuya)/i);
    }
  });

  it("no dice que la plataforma comprueba datos y prohíbe afirmarlo (el video: «la plataforma verifica»)", () => {
    expect(SELLER_COPY_RULES).toMatch(
      /Nunca digas que la plataforma verifica, revisa o garantiza algo/,
    );
    expect(system).not.toMatch(/cuando los comprueba/);
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
