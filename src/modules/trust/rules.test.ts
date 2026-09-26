import { describe, expect, it } from "vitest";
import { detectBrands } from "./brands";
import { detectCounterfeitTerms } from "./keywords";
import { DEFAULT_REFERENCE_PRICES, matchReferencePrice } from "./reference-prices";
import {
  AI_MAX_WEIGHT,
  analyzeListing,
  combineWithAi,
  type EvaluationContext,
  evaluateRules,
  levelForScore,
  type ListingInput,
  median,
  MIN_COMPARABLES,
  parseSignals,
} from "./rules";
import { normalizeForRules } from "./text";

const NOW = new Date("2026-09-26T18:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function listing(overrides: Partial<ListingInput> = {}): ListingInput {
  return {
    title: "AirPods Pro 2",
    description: "Audífonos con cancelación de ruido, nuevos y sellados.",
    tags: [],
    priceCents: 450_000,
    currency: "MXN",
    condition: "NEW",
    authenticity: "DECLARED_ORIGINAL",
    ...overrides,
  };
}

function context(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    comparablePricesCents: [],
    // Tienda con historia y ventas: la regla de tienda nueva no aplica salvo que se pida.
    seller: { createdAt: new Date(NOW.getTime() - 400 * DAY), completedSales: 12 },
    counterfeitReports: 0,
    referencePrices: DEFAULT_REFERENCE_PRICES,
    now: NOW,
    ...overrides,
  };
}

const rulesOf = (result: ReturnType<typeof evaluateRules>) => result.signals.map((s) => s.rule);

describe("texto y marcas", () => {
  it("normaliza sin acentos ni signos y busca palabras completas", () => {
    expect(normalizeForRules("¡RÉPLICA  AAA+ de AirPods!")).toBe(" replica aaa+ de airpods ");
    expect(detectCounterfeitTerms(normalizeForRules("Clonar llaves")).strong).toEqual([]);
    expect(detectCounterfeitTerms(normalizeForRules("Es un clon")).strong).toEqual(["clon"]);
  });

  it("distingue la marca del producto de una compatibilidad o un parecido", () => {
    expect(detectBrands(normalizeForRules("AirPods Pro 2 sellados")).item).toEqual(["apple"]);
    expect(detectBrands(normalizeForRules("Funda compatible con AirPods Pro"))).toEqual({
      item: [],
      resemblance: [],
      accessory: ["apple"],
    });
    expect(detectBrands(normalizeForRules("Cargador rápido para iPhone")).item).toEqual([]);
    expect(detectBrands(normalizeForRules("Audífonos tipo AirPods")).resemblance).toEqual([
      "apple",
    ]);
  });

  it("«AAA» de pilas, «1:1» o «inspirado en» sin marca no son señales", () => {
    expect(detectCounterfeitTerms(normalizeForRules("Pilas AAA recargables"))).toEqual({
      strong: [],
      weak: [],
    });
    const analysis = analyzeListing({
      title: "Maqueta escala 1:1 inspirada en la naturaleza",
      description: "Decoración.",
      tags: [],
    });
    expect(
      evaluateRules(
        listing({ title: "Maqueta", authenticity: "NOT_APPLICABLE" }),
        context(),
        analysis,
      ).signals,
    ).toEqual([]);
  });
});

describe("regla de precio", () => {
  it("con menos de 5 productos parecidos no compara contra la mediana", () => {
    const few = Array.from({ length: MIN_COMPARABLES - 1 }, () => 1_000_000);
    const result = evaluateRules(
      listing({ title: "Bocina Bose SoundLink", priceCents: 100_000 }),
      context({ comparablePricesCents: few }),
    );
    expect(result.signals).toEqual([]);
    expect(result.level).toBe("LOW");
  });

  it("con 5 o más, un precio muy por debajo de la mediana es señal fuerte (cifras del código)", () => {
    const result = evaluateRules(
      listing({ title: "Bocina Bose SoundLink", priceCents: 100_000, authenticity: "GENERIC" }),
      context({ comparablePricesCents: [500_000, 520_000, 480_000, 510_000, 490_000] }),
    );
    const [signal] = result.signals;
    expect(signal).toMatchObject({
      rule: "price_below_comparables",
      weight: 0.4,
      data: { medianCents: 500_000, stores: 5, percentLower: 80 },
    });
    expect(signal?.message).toBe(
      "El precio ($1,000) es 80 % menor que la mediana de productos parecidos en otras 5 tiendas ($5,000).",
    );
    expect(result.level).toBe("MEDIUM");
  });

  it("un precio algo menor (60 % o más de la mediana) no es señal", () => {
    const result = evaluateRules(
      listing({ title: "Bocina Bose SoundLink", priceCents: 300_000, authenticity: "GENERIC" }),
      context({ comparablePricesCents: [500_000, 500_000, 500_000, 500_000, 500_000] }),
    );
    expect(result.signals).toEqual([]);
  });

  it("usa la referencia aproximada para artículos conocidos; un usado se compara con la mitad", () => {
    const reference = matchReferencePrice(
      normalizeForRules("AirPods Pro 2"),
      ["apple"],
      "USED_GOOD",
      DEFAULT_REFERENCE_PRICES,
    );
    expect(reference).toMatchObject({ floorCents: 125_000, isNew: false });
    expect(reference?.entry.id).toBe("airpods-pro");

    const mild = evaluateRules(listing({ priceCents: 200_000 }), context());
    expect(mild.signals[0]).toMatchObject({ rule: "price_below_reference", weight: 0.2 });
    expect(mild.signals[0]?.message).toBe(
      "El precio ($2,000) está por debajo de la referencia aproximada para AirPods Pro nuevos (desde $2,500).",
    );
  });

  it("el precio cuenta una sola vez aunque salten la referencia y la mediana", () => {
    const result = evaluateRules(
      listing({ priceCents: 30_000, authenticity: "GENERIC" }),
      context({ comparablePricesCents: [400_000, 420_000, 380_000, 410_000, 390_000] }),
    );
    expect(result.signals.filter((s) => s.rule.startsWith("price_"))).toHaveLength(1);
  });

  it("un accesorio «para AirPods» no se compara contra el precio de los AirPods", () => {
    const result = evaluateRules(
      listing({ title: "Funda para AirPods Pro", priceCents: 15_000, authenticity: "GENERIC" }),
      context(),
    );
    expect(result.signals).toEqual([]);
  });
});

describe("palabras de imitación", () => {
  it("«réplica AAA» con marca lleva por sí sola a riesgo alto", () => {
    const result = evaluateRules(
      listing({ title: "AirPods Pro réplica AAA", priceCents: 450_000, authenticity: "GENERIC" }),
      context(),
    );
    expect(result.signals).toEqual([
      expect.objectContaining({
        rule: "counterfeit_terms",
        weight: 0.6,
        message:
          "La publicación usa palabras que suelen describir imitaciones («réplica», «AAA») junto con la marca Apple.",
      }),
    ]);
    expect(result.level).toBe("HIGH");
  });

  it("sin marca, «réplica» apenas suma (réplica de un monumento)", () => {
    const result = evaluateRules(
      listing({
        title: "Réplica de la Torre Eiffel",
        description: "Figura decorativa de metal.",
        priceCents: 30_000,
        authenticity: "NOT_APPLICABLE",
      }),
      context(),
    );
    expect(result.signals.map((s) => [s.rule, s.weight])).toEqual([["counterfeit_terms", 0.2]]);
    expect(result.level).toBe("LOW");
  });

  it("«tipo AirPods» y «genéricos» con marca son riesgo medio", () => {
    const resemblance = evaluateRules(
      listing({ title: "Audífonos tipo AirPods", priceCents: 30_000, authenticity: "GENERIC" }),
      context(),
    );
    expect(resemblance.signals[0]).toMatchObject({ rule: "counterfeit_terms", weight: 0.45 });
    expect(resemblance.level).toBe("MEDIUM");

    const generic = evaluateRules(
      listing({ title: "AirPods genéricos", priceCents: 450_000, authenticity: "GENERIC" }),
      context(),
    );
    expect(generic.level).toBe("MEDIUM");
  });

  it("las palabras también cuentan en la descripción", () => {
    const result = evaluateRules(
      listing({ title: "Tenis Nike Air Force 1", description: "Calidad espejo, igualitos." }),
      context(),
    );
    expect(rulesOf(result)).toContain("counterfeit_terms");
  });

  it("negarlas no cuenta: «100 % originales, no réplica» es lo que escribe un vendedor honesto", () => {
    for (const title of [
      "AirPods Pro 2 100% originales, no réplica",
      "AirPods Pro 2 originales, no es una réplica",
      "AirPods Pro 2 originales, no son clones ni copia 1:1",
      "Tenis Nike Air Force 1 originales, cero réplicas, nada de AAA",
      "Tenis Nike Air Force 1 originales, sin clones",
    ]) {
      const result = evaluateRules(listing({ title }), context());
      expect(result.signals, title).toEqual([]);
      expect(result.level, title).toBe("LOW");
    }
    expect(detectCounterfeitTerms(normalizeForRules("no es réplica ni clon"))).toEqual({
      strong: [],
      weak: [],
    });
  });

  it("la negación de otra palabra no salva a «réplica»", () => {
    const result = evaluateRules(
      listing({ title: "AirPods Pro 2 no es original, es réplica" }),
      context(),
    );
    expect(
      result.signals.find((signal) => signal.rule === "counterfeit_terms")?.data,
    ).toMatchObject({ terms: "réplica" });
    expect(result.level).toBe("HIGH");
    // Si aparece negada y también afirmada, cuenta.
    expect(
      detectCounterfeitTerms(normalizeForRules("no es réplica barata, es réplica AAA")).strong,
    ).toEqual(["réplica"]);
  });
});

describe("declaración de original, tienda nueva y reportes", () => {
  it("original declarado + precio o palabras suma el conflicto; solo, no", () => {
    expect(evaluateRules(listing(), context()).signals).toEqual([]);
    const conflict = evaluateRules(listing({ priceCents: 200_000 }), context());
    expect(rulesOf(conflict)).toEqual(["price_below_reference", "original_claim_conflict"]);
    expect(conflict.score).toBe(0.4);
    expect(conflict.level).toBe("MEDIUM");
  });

  it("tienda de menos de 14 días sin ventas con un artículo de marca caro", () => {
    const fresh = { createdAt: new Date(NOW.getTime() - 3 * DAY), completedSales: 0 };
    const result = evaluateRules(listing({ priceCents: 450_000 }), context({ seller: fresh }));
    expect(result.signals).toEqual([
      expect.objectContaining({ rule: "new_seller_high_value", weight: 0.15 }),
    ]);
    expect(result.level).toBe("LOW");
    // Con una venta entregada, o barato, o sin marca: no aplica.
    expect(
      evaluateRules(listing(), context({ seller: { ...fresh, completedSales: 1 } })).signals,
    ).toEqual([]);
    expect(
      evaluateRules(
        listing({ title: "Lámpara LED", priceCents: 450_000 }),
        context({ seller: fresh }),
      ).signals,
    ).toEqual([]);
  });

  it("los reportes suman, pero solos nunca cambian lo que ve quien compra (riesgo bajo)", () => {
    const one = evaluateRules(listing(), context({ counterfeitReports: 1 }));
    expect(one.signals[0]).toMatchObject({ rule: "buyer_reports", weight: 0.1 });
    expect(one.level).toBe("LOW");
    // Muchas cuentas reportando (quizá creadas contra un competidor) no bastan por sí solas.
    const many = evaluateRules(listing(), context({ counterfeitReports: 40 }));
    expect(many.score).toBe(0.25);
    expect(many.level).toBe("LOW");
    // Sí refuerzan otra señal: precio bajo la referencia + reportes → riesgo medio.
    const withPrice = evaluateRules(
      listing({ title: "AirPods Pro 2", priceCents: 200_000, authenticity: "GENERIC" }),
      context({ counterfeitReports: 3 }),
    );
    expect(withPrice.signals.map((signal) => signal.rule)).toEqual([
      "price_below_reference",
      "buyer_reports",
    ]);
    expect(withPrice.level).toBe("MEDIUM");
  });
});

describe("puntaje y nivel", () => {
  it("el ejemplo del fundador: «AirPods Pro réplica AAA» como original a $300 es riesgo alto", () => {
    const result = evaluateRules(
      listing({ title: "AirPods Pro réplica AAA", priceCents: 30_000 }),
      context(),
    );
    expect(rulesOf(result)).toEqual([
      "price_below_reference",
      "counterfeit_terms",
      "original_claim_conflict",
    ]);
    expect(result.score).toBe(1);
    expect(result.level).toBe("HIGH");
    expect(result.signals.every((s) => !/falso/i.test(s.message))).toBe(true);
  });

  it("umbrales: medio desde 0.3 y alto desde 0.6", () => {
    expect(levelForScore(0.299)).toBe("LOW");
    expect(levelForScore(0.3)).toBe("MEDIUM");
    expect(levelForScore(0.6)).toBe("HIGH");
  });

  it("mediana con cantidad par e impar", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
  });

  it("es determinista", () => {
    const input = listing({ title: "AirPods Pro réplica AAA", priceCents: 30_000 });
    expect(evaluateRules(input, context())).toEqual(evaluateRules(input, context()));
  });

  it("lee señales guardadas e ignora lo que no tiene su forma", () => {
    expect(parseSignals([{ rule: "x", weight: 0.2, message: "m" }, { rule: 1 }, "otro"])).toEqual([
      { rule: "x", weight: 0.2, message: "m" },
    ]);
    expect(parseSignals(null)).toEqual([]);
  });
});

describe("señal de la IA", () => {
  const rules = (score: number) => ({
    signals: score > 0 ? [{ rule: "counterfeit_terms" as const, weight: score, message: "" }] : [],
    score,
    level: levelForScore(score),
  });

  it("sin señales de reglas no suma nada: la IA nunca actúa sola", () => {
    expect(combineWithAi(rules(0), 0.15)).toEqual({ score: 0, level: "LOW" });
  });

  it("su peso tiene tope y nunca lleva de riesgo bajo a alto", () => {
    expect(combineWithAi(rules(0.2), 1)).toEqual({ score: 0.2 + AI_MAX_WEIGHT, level: "MEDIUM" });
    expect(combineWithAi(rules(0.29), 0.15).level).toBe("MEDIUM");
  });

  it("puede reforzar un riesgo medio que ya vieron las reglas", () => {
    expect(combineWithAi(rules(0.45), 0.15)).toEqual({ score: 0.6, level: "HIGH" });
  });
});
