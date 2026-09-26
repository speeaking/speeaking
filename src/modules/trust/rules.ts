import { z } from "zod";
import type { Authenticity, ProductCondition, RiskLevel } from "@/generated/prisma/enums";
import { formatCount, formatMoney } from "@/lib/format";
import { brandById, type BrandMentions, detectBrands } from "./brands";
import { detectCounterfeitTerms, type KeywordMatches } from "./keywords";
import {
  matchReferencePrice,
  REFERENCE_PRICES_LABEL,
  type ReferencePrice,
} from "./reference-prices";
import { normalizeForRules } from "./text";

/**
 * Motor de reglas de RIESGO de falsificación (P2: lo decide código determinista y probado, no la
 * IA). Detecta señales y las explica en español claro; nunca afirma que algo sea falso ni certifica
 * que sea original. El resultado es un nivel de riesgo (LOW, MEDIUM, HIGH) que decide qué ve quien
 * compra y si se le pide una prueba al vendedor (`status.ts`).
 *
 * Si cambian pesos, umbrales o reglas, sube `RULES_VERSION`: queda guardada con cada revisión.
 */
export const RULES_VERSION = "v2";

/** Puntaje (0–1) a partir del cual el riesgo es medio o alto. */
export const RISK_THRESHOLDS = { medium: 0.3, high: 0.6 } as const;

export const WEIGHTS = {
  /** Precio muy por debajo (menos de la mitad de la referencia o 40 % de la mediana). */
  priceStrong: 0.4,
  /** Precio por debajo (bajo la referencia o menos del 60 % de la mediana). */
  priceMild: 0.2,
  /** «réplica», «calidad original»… junto a una marca: por sí solo lleva a riesgo alto. */
  termsStrongWithBrand: 0.6,
  /** «AAA», «1:1», «tipo AirPods»… junto a una marca. */
  termsWeakWithBrand: 0.45,
  /** «réplica» sin marca (p. ej. «réplica de la Torre Eiffel»): apenas una señal. */
  termsStrongWithoutBrand: 0.2,
  /** Se declara original y además saltó el precio o las palabras. */
  claimConflict: 0.2,
  /** Tienda nueva sin ventas entregadas con un artículo de marca caro. */
  newSellerHighValue: 0.15,
} as const;

/**
 * Peso por reportes de compradores (0, 1, 2, 3 o más). Solos se quedan por debajo del riesgo medio:
 * reportes sin revisar (quizá de cuentas creadas para perjudicar a un competidor) nunca cambian por
 * sí mismos lo que ve quien compra; van a la cola del equipo y solo refuerzan otras señales.
 */
export const REPORT_WEIGHTS = [0, 0.1, 0.2, 0.25] as const;

/**
 * Mínimo de TIENDAS distintas para comparar precios. Cada tienda aporta un solo precio (la mediana
 * de los suyos): así una sola cuenta con muchas publicaciones no decide la mediana (agrupar por
 * persona). Con menos tiendas, la mediana no dice nada.
 */
export const MIN_COMPARABLES = 5;
export const COMPARABLE_RATIO = { strong: 0.4, mild: 0.6 } as const;
export const REFERENCE_RATIO = { strong: 0.5, mild: 1 } as const;
export const NEW_SELLER_DAYS = 14;
/** «Alto valor» para la regla de tienda nueva: $2,000 MXN. */
export const HIGH_VALUE_CENTS = 200_000;
/** Moneda de las referencias y de la comparación de precios. */
const PRICE_CURRENCY = "MXN";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RuleId =
  | "price_below_comparables"
  | "price_below_reference"
  | "counterfeit_terms"
  | "original_claim_conflict"
  | "new_seller_high_value"
  | "buyer_reports";

/** Señal que se activó. `message` se le muestra al vendedor y al equipo (nunca a quien compra). */
export type TrustSignal = {
  rule: RuleId;
  weight: number;
  message: string;
  /** Cifras detrás del mensaje, calculadas por código (P2). */
  data?: Record<string, number | string>;
};

const storedSignalSchema = z.object({
  rule: z.string(),
  weight: z.number(),
  message: z.string(),
});

/** Señales guardadas en `AuthenticityCheck.signals` (JSON): lo que no tenga la forma se ignora. */
export function parseSignals(value: unknown): { rule: string; weight: number; message: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = storedSignalSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export type ListingInput = {
  title: string;
  description: string;
  tags: readonly string[];
  priceCents: number;
  currency: string;
  condition: ProductCondition;
  authenticity: Authenticity;
};

export type ListingAnalysis = {
  /** Título y etiquetas normalizados (ahí se decide la marca del producto). */
  titleText: string;
  /** Marcas del título y las etiquetas. */
  titleBrands: BrandMentions;
  /** Marcas de todo el texto (título, descripción y etiquetas). */
  textBrands: BrandMentions;
  terms: KeywordMatches;
};

export type EvaluationContext = {
  /** Un precio por tienda (centavos, misma moneda; la mediana de sus productos parecidos: misma
   * categoría y marca, activos, visibles, del mismo tipo de condición), solo de OTRAS tiendas. */
  comparablePricesCents: readonly number[];
  seller: { createdAt: Date; completedSales: number };
  /** Personas distintas que reportaron posible falsificación (sin contar reportes descartados). */
  counterfeitReports: number;
  referencePrices: readonly ReferencePrice[];
  now: Date;
};

export type RulesResult = { signals: TrustSignal[]; score: number; level: RiskLevel };

export function analyzeListing(input: Pick<ListingInput, "title" | "description" | "tags">) {
  const titleText = normalizeForRules([input.title, ...input.tags].join(" "));
  const allText = normalizeForRules([input.title, input.description, ...input.tags].join(" "));
  const textBrands = detectBrands(allText);
  const terms = detectCounterfeitTerms(allText);
  // «tipo AirPods» también es una palabra de imitación (junto a una marca, por definición).
  const resemblance = textBrands.resemblance.map((id) => `tipo ${brandById(id)?.name ?? id}`);
  return {
    titleText,
    titleBrands: detectBrands(titleText),
    textBrands,
    terms: { strong: terms.strong, weak: [...terms.weak, ...resemblance] },
  } satisfies ListingAnalysis;
}

/** Marca principal del producto (la primera del título o las etiquetas), o `null`. */
export function primaryBrandId(analysis: ListingAnalysis): string | null {
  return analysis.titleBrands.item[0] ?? null;
}

/** Mediana (P2). `null` si no hay valores. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

export function levelForScore(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.high) return "HIGH";
  if (score >= RISK_THRESHOLDS.medium) return "MEDIUM";
  return "LOW";
}

/** Suma de pesos con tope 1, redondeada a milésimas (evita 0.6000000001). */
export function scoreOf(weights: readonly number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return Math.round(Math.min(1, Math.max(0, total)) * 1000) / 1000;
}

function quote(labels: readonly string[]) {
  return labels.map((label) => `«${label}»`).join(", ");
}

function priceSignal(
  input: ListingInput,
  analysis: ListingAnalysis,
  context: EvaluationContext,
): TrustSignal | null {
  if (input.currency !== PRICE_CURRENCY || input.priceCents <= 0) return null;
  const price = formatMoney(input.priceCents, input.currency);
  const candidates: TrustSignal[] = [];

  const reference = matchReferencePrice(
    analysis.titleText,
    analysis.titleBrands.item,
    input.condition,
    context.referencePrices,
  );
  if (reference && input.priceCents < reference.floorCents * REFERENCE_RATIO.mild) {
    const strong = input.priceCents < reference.floorCents * REFERENCE_RATIO.strong;
    candidates.push({
      rule: "price_below_reference",
      weight: strong ? WEIGHTS.priceStrong : WEIGHTS.priceMild,
      message: `El precio (${price}) está ${strong ? "muy " : ""}por debajo de la ${REFERENCE_PRICES_LABEL} para ${reference.entry.label} ${reference.isNew ? "nuevos" : "usados"} (desde ${formatMoney(reference.floorCents, PRICE_CURRENCY)}).`,
      data: {
        priceCents: input.priceCents,
        referenceFloorCents: reference.floorCents,
        referenceId: reference.entry.id,
      },
    });
  }

  const comparables = context.comparablePricesCents;
  const middle = comparables.length >= MIN_COMPARABLES ? median(comparables) : null;
  if (middle !== null && middle > 0) {
    const ratio = input.priceCents / middle;
    if (ratio < COMPARABLE_RATIO.mild) {
      const strong = ratio < COMPARABLE_RATIO.strong;
      const percentLower = Math.round((1 - ratio) * 100);
      candidates.push({
        rule: "price_below_comparables",
        weight: strong ? WEIGHTS.priceStrong : WEIGHTS.priceMild,
        message: `El precio (${price}) es ${percentLower} % menor que la mediana de productos parecidos en otras ${formatCount(comparables.length, "tienda", "tiendas")} (${formatMoney(middle, PRICE_CURRENCY)}).`,
        data: {
          priceCents: input.priceCents,
          medianCents: middle,
          stores: comparables.length,
          percentLower,
        },
      });
    }
  }
  // Es la misma señal (precio) vista de dos formas: cuenta una vez, la más fuerte. En empate gana
  // la referencia curada, que compara contra el mismo artículo.
  return candidates.reduce<TrustSignal | null>(
    (best, candidate) => (!best || candidate.weight > best.weight ? candidate : best),
    null,
  );
}

function termsSignal(analysis: ListingAnalysis): TrustSignal | null {
  const { strong, weak } = analysis.terms;
  const brandId = analysis.textBrands.item[0] ?? analysis.textBrands.resemblance[0] ?? null;
  const brand = brandId ? (brandById(brandId)?.name ?? brandId) : null;
  if (brand && (strong.length > 0 || weak.length > 0)) {
    const labels = [...strong, ...weak];
    return {
      rule: "counterfeit_terms",
      weight: strong.length > 0 ? WEIGHTS.termsStrongWithBrand : WEIGHTS.termsWeakWithBrand,
      message: `La publicación usa palabras que suelen describir imitaciones (${quote(labels)}) junto con la marca ${brand}.`,
      data: { terms: labels.join(", "), brand },
    };
  }
  if (strong.length > 0) {
    return {
      rule: "counterfeit_terms",
      weight: WEIGHTS.termsStrongWithoutBrand,
      message: `La publicación usa palabras que suelen describir imitaciones (${quote(strong)}).`,
      data: { terms: strong.join(", ") },
    };
  }
  return null;
}

function newSellerSignal(
  input: ListingInput,
  analysis: ListingAnalysis,
  context: EvaluationContext,
): TrustSignal | null {
  const brandId = primaryBrandId(analysis);
  if (!brandId || input.priceCents < HIGH_VALUE_CENTS) return null;
  const ageDays = Math.floor((context.now.getTime() - context.seller.createdAt.getTime()) / DAY_MS);
  if (ageDays >= NEW_SELLER_DAYS || context.seller.completedSales > 0) return null;
  return {
    rule: "new_seller_high_value",
    weight: WEIGHTS.newSellerHighValue,
    message: `Tienda con menos de ${NEW_SELLER_DAYS} días y sin ventas entregadas, con un artículo de ${brandById(brandId)?.name ?? brandId} de ${formatMoney(input.priceCents, input.currency)}.`,
    data: { sellerAgeDays: ageDays, priceCents: input.priceCents },
  };
}

function reportsSignal(context: EvaluationContext): TrustSignal | null {
  const count = Math.max(0, Math.floor(context.counterfeitReports));
  if (count === 0) return null;
  return {
    rule: "buyer_reports",
    weight: REPORT_WEIGHTS[Math.min(count, REPORT_WEIGHTS.length - 1)]!,
    message: `${formatCount(count, "reporte", "reportes")} de compradores por posible falsificación.`,
    data: { reports: count },
  };
}

/** Aplica todas las reglas. Puro: el mismo producto y contexto dan siempre el mismo resultado. */
export function evaluateRules(
  input: ListingInput,
  context: EvaluationContext,
  analysis: ListingAnalysis = analyzeListing(input),
): RulesResult {
  const signals: TrustSignal[] = [];
  const price = priceSignal(input, analysis, context);
  if (price) signals.push(price);
  const terms = termsSignal(analysis);
  if (terms) signals.push(terms);
  if (input.authenticity === "DECLARED_ORIGINAL" && (price || terms)) {
    signals.push({
      rule: "original_claim_conflict",
      weight: WEIGHTS.claimConflict,
      message:
        "Se declara original, pero el precio o las palabras de la publicación no coinciden con lo que se espera de un original.",
    });
  }
  const newSeller = newSellerSignal(input, analysis, context);
  if (newSeller) signals.push(newSeller);
  const reports = reportsSignal(context);
  if (reports) signals.push(reports);

  const score = scoreOf(signals.map((signal) => signal.weight));
  return { signals, score, level: levelForScore(score) };
}

/** Peso máximo de la señal de la IA: es un extra, nunca decide sola (`combineWithAi`). */
export const AI_MAX_WEIGHT = 0.15;

/**
 * Suma la señal de la IA a las reglas. La IA solo refuerza lo que las reglas ya vieron: sin
 * señales de reglas no suma nada, su peso tiene tope, y nunca lleva por sí sola a riesgo alto.
 */
export function combineWithAi(
  rules: Pick<RulesResult, "signals" | "score" | "level">,
  aiWeight: number,
): { score: number; level: RiskLevel } {
  if (rules.signals.length === 0 || !(aiWeight > 0)) {
    return { score: rules.score, level: rules.level };
  }
  const score = scoreOf([rules.score, Math.min(aiWeight, AI_MAX_WEIGHT)]);
  const level = levelForScore(score);
  return { score, level: level === "HIGH" && rules.level === "LOW" ? "MEDIUM" : level };
}
