import { z } from "zod";
import { formatMetricValue, getMetric, PENDING_METRICS } from "./metric-catalog";
import {
  ASSUMED_ICC,
  ASSUMED_IMPRESSIONS_PER_PERSON,
  aboveLimitTest,
  DEFAULT_ALPHA,
  designEffect,
  oneSidedPValue,
  poissonRateZTest,
  twoProportionZTest,
  varianceFactor,
} from "./stats";
import { rateKind, successesOf, type WindowValue } from "./windows";

/**
 * Salvaguardas (plan-90-dias.md §2.4, ADR-033 #13, ADR-037): tras aplicar un cambio, o entre las
 * variantes de un experimento, el código revierte solo si una salvaguarda se rompe después de la
 * exposición mínima. «Se rompe» exige DOS cosas: que el empeoramiento pase su umbral (p. ej. +25 %)
 * Y que sea estadísticamente significativo (prueba unilateral en la dirección del daño, α = 0.05).
 * La varianza de cada lado se multiplica por el MAYOR entre el efecto de diseño por persona que usa
 * el analista y la sobredispersión medida entre las unidades de la ventana (días en el monitor,
 * personas en un experimento; `pearsonDispersion`): comparar antes contra después no cancela los días
 * atípicos (quincena, puentes) como sí lo hace un experimento, y una sola cuenta con muchos reportes
 * no debe bastar para revertir. Con conteos bajos, un salto grande pero sin significancia no
 * revierte: se sigue vigilando hasta la ventana máxima. Los umbrales son una propuesta a calibrar con
 * la línea base; los fija el código, nunca la IA.
 *
 * Todas las métricas de las salvaguardas y la exposición cuentan SOLO a personas con sesión (y
 * personalización): las del feed, con `signedInFeedTotals`; las visitas por vendedor activo, con las
 * visitas con persona de `feedTotals` (`analytics/platform-aggregates.ts`). Un robot SIN CUENTA que
 * inunde impresiones o visitas anónimas no puede forzar ni esconder una reversión; uno con cuentas
 * sí cuenta (no hay detección de robots con cuenta, ADR-037 → Pendiente).
 */

/** Nivel de significancia (unilateral) para revertir. */
export const GUARDRAIL_ALPHA = DEFAULT_ALPHA;
/** Días máximos que se vigila un cambio sin datos suficientes antes de cerrar sin evidencia de daño. */
export const DEFAULT_MAX_WATCH_DAYS = 28;

const metricKey = z.string().min(1).max(100);

export const guardrailRuleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("relative"),
    metric: metricKey,
    direction: z.enum(["increase", "decrease"]),
    /** Cambio relativo máximo tolerado (0.25 = 25 %). */
    maxRelativeChange: z.number().positive().max(10),
    /** Muestra mínima (denominador) en cada lado para evaluar. */
    minSample: z.int().min(0),
    /**
     * Límite ABSOLUTO (en unidades de la métrica) cuando la línea base es 0 y no hay cambio
     * relativo que medir. Si falta, el de `ZERO_BASELINE_LIMITS`.
     */
    zeroBaselineMax: z.number().positive().optional(),
  }),
  z.object({
    type: z.literal("absolute"),
    metric: metricKey,
    /** Valor máximo tolerado (p. ej. 0.30 de contenido comercial). */
    max: z.number(),
    minSample: z.int().min(0),
  }),
]);

export type GuardrailRule = z.infer<typeof guardrailRuleSchema>;

export const guardrailsSchema = z.object({
  version: z.literal(1),
  /**
   * Impresiones visibles del feed DE PERSONAS CON SESIÓN observadas (o del tratamiento) antes de
   * emitir un veredicto. Las anónimas no cuentan (un robot sin cuenta no adelanta un veredicto).
   */
  minExposureImpressions: z.int().positive(),
  /** Días completos antes del cambio que forman la línea base. */
  baselineDays: z.int().min(1).max(60),
  /** Días que se vigila un cambio aplicado (si todo se pudo evaluar, termina aquí). */
  monitorDays: z.int().min(1).max(90),
  /**
   * Días máximos de vigilancia: si al cumplirse no hubo un empeoramiento significativo (p. ej. por
   * falta de muestra), se cierra con «sin evidencia de daño». Si falta, `DEFAULT_MAX_WATCH_DAYS`.
   */
  maxWatchDays: z.int().min(1).max(90).optional(),
  rules: z.array(guardrailRuleSchema).min(1).max(20),
});

export type Guardrails = z.infer<typeof guardrailsSchema>;

/**
 * Límites absolutos para las salvaguardas relativas cuya línea base es 0 [propuesta; calibrar]:
 * 1 reporte o 5 «No me interesa» por cada mil impresiones. Una métrica que debe BAJAR no puede
 * empeorar desde 0 y no necesita uno.
 */
export const ZERO_BASELINE_LIMITS: Readonly<Record<string, number>> = {
  "reports.per_1k_impressions": 1,
  "not_interested.per_1k_impressions": 5,
};

export const DEFAULT_GUARDRAILS: Guardrails = {
  version: 1,
  minExposureImpressions: 5_000,
  baselineDays: 7,
  monitorDays: 14,
  maxWatchDays: DEFAULT_MAX_WATCH_DAYS,
  rules: [
    {
      type: "relative",
      metric: "reports.per_1k_impressions",
      direction: "increase",
      maxRelativeChange: 0.25,
      minSample: 2_000,
      zeroBaselineMax: ZERO_BASELINE_LIMITS["reports.per_1k_impressions"],
    },
    {
      type: "relative",
      metric: "not_interested.per_1k_impressions",
      direction: "increase",
      maxRelativeChange: 0.15,
      minSample: 2_000,
      zeroBaselineMax: ZERO_BASELINE_LIMITS["not_interested.per_1k_impressions"],
    },
    { type: "absolute", metric: "feed.commerce.share", max: 0.3, minSample: 1_000 },
    // «La conversión baja más de 10 %»: conversión comercial del feed (visitas ÷ impresiones comerciales).
    {
      type: "relative",
      metric: "feed.commerce.ctr",
      direction: "decrease",
      maxRelativeChange: 0.1,
      minSample: 500,
    },
    { type: "absolute", metric: "errors.5xx.rate", max: 0.01, minSample: 1_000 },
    // ADR-033 #13: revertir si las visitas a producto por vendedor activo caen más de 15 %.
    {
      type: "relative",
      metric: "product.visits.per_active_seller",
      direction: "decrease",
      maxRelativeChange: 0.15,
      minSample: 7,
    },
  ],
};

/**
 * - `ok`: con muestra suficiente, dentro del límite (o fuera, pero mejorando).
 * - `breach`: pasa el límite Y es significativo: se revierte.
 * - `not_significant`: pasa el límite pero sin significancia (puede ser ruido): se sigue vigilando.
 * - `no_data`: sin muestra suficiente (nunca un 0 inventado ni un «todo bien»).
 * - `no_baseline`: línea base en 0 y sin límite absoluto para ese caso.
 */
export type CheckVerdict = "ok" | "breach" | "not_significant" | "no_data" | "no_baseline";

export type GuardrailCheck = {
  metric: string;
  label: string;
  type: GuardrailRule["type"];
  direction: "increase" | "decrease" | null;
  /** Cambio relativo máximo, valor máximo o, con línea base en 0, el límite absoluto usado. */
  limit: number;
  baseline: number | null;
  observed: number | null;
  /** Cambio relativo observado (observado ÷ línea base − 1). */
  change: number | null;
  /** Valor p unilateral en la dirección del daño (solo si pasó el límite). */
  pValue: number | null;
  /**
   * Factor de varianza del lado observado en esa prueba: el mayor entre el efecto de diseño y la
   * sobredispersión medida. `null` si no hubo prueba.
   */
  varianceFactor?: number | null;
  baselineSample: number;
  observedSample: number;
  verdict: CheckVerdict;
  /** Frase para la bitácora y la interfaz. */
  summary: string;
};

export type GuardrailEvaluation = {
  status: "pending" | "ok" | "breached";
  exposure: number;
  requiredExposure: number;
  checks: GuardrailCheck[];
  /** La vigilancia terminó: se revirtió o se cerró (ver `conclusion`). */
  final?: boolean;
  /**
   * Cómo se cerró sin revertir: `no_harm` = todo evaluado sin empeoramiento significativo;
   * `no_evidence` = llegó la ventana máxima sin datos (o significancia) para evaluarlo todo: no hay
   * evidencia de daño con esta muestra (no quiere decir que el cambio sea seguro).
   */
  conclusion?: "no_harm" | "no_evidence";
};

/** Efecto de diseño supuesto por el plan (m = 20, ρ = 0.05 → 1.95) si no se da uno medido. */
const ASSUMED_DESIGN_EFFECT = designEffect(ASSUMED_IMPRESSIONS_PER_PERSON, ASSUMED_ICC);

const percent = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("es-MX");

function pText(pValue: number | null) {
  return pValue === null ? "" : `p = ${pValue.toFixed(4)}`;
}

function describe(check: Omit<GuardrailCheck, "summary">): string {
  const { label, metric } = check;
  switch (check.verdict) {
    case "no_data":
      return `${label}: sin datos suficientes.`;
    case "no_baseline":
      return `${label}: sin línea base para comparar.`;
    default:
      break;
  }
  const significance =
    check.verdict === "breach"
      ? `; ${pText(check.pValue)}`
      : check.verdict === "not_significant"
        ? `, pero sin significancia estadística (${pText(check.pValue)}): se sigue vigilando`
        : "";
  if (check.type === "absolute" || check.change === null) {
    const zeroBaseline = check.type === "relative" ? " con la línea base en 0" : "";
    const verb = check.verdict === "ok" ? "dentro de" : "arriba de";
    return `${label}: ${formatMetricValue(metric, check.observed)}${zeroBaseline} (${verb} el límite de ${formatMetricValue(metric, check.limit)}${significance}).`;
  }
  const change = check.change;
  const moved = change >= 0 ? "subió" : "bajó";
  const verdict =
    check.verdict === "breach"
      ? "rebasa"
      : check.verdict === "not_significant"
        ? "arriba de"
        : "dentro de";
  return `${label}: ${moved} ${percent.format(Math.abs(change) * 100)} % (${verdict} el límite de ${percent.format(check.limit * 100)} %${significance}).`;
}

/** Las tasas por impresión son proporciones; las demás (p. ej. visitas por vendedor), conteos. */
function isProportion(metric: string) {
  return rateKind(metric) === "proportion";
}

/** Límite en unidades de la métrica → escala de la prueba (las «por mil» son proporciones ÷ 1000). */
function limitScale(metric: string) {
  return getMetric(metric)?.format === "per1k" ? 1 / 1000 : 1;
}

/** ¿El valor observado está significativamente por encima de `limit` (en unidades de la métrica)? */
function testAboveLimit(metric: string, window: WindowValue, limit: number, deff: number) {
  return aboveLimitTest({
    kind: isProportion(metric) ? "proportion" : "rate",
    successes: successesOf(metric, window),
    trials: window.sample,
    limit: limit * limitScale(metric),
    designEffect: deff,
  });
}

/** Valor p unilateral de que `observed` empeoró frente a `baseline` en `direction`. */
function degradationPValue(
  metric: string,
  direction: "increase" | "decrease",
  baseline: WindowValue,
  observed: WindowValue,
  deff: { baseline: number; comparable: number },
): number | null {
  const test = isProportion(metric)
    ? twoProportionZTest({
        successesA: successesOf(metric, baseline),
        trialsA: baseline.sample,
        successesB: successesOf(metric, observed),
        trialsB: observed.sample,
        designEffectA: deff.baseline,
        designEffectB: deff.comparable,
      })
    : poissonRateZTest({
        countA: baseline.numerator,
        exposureA: baseline.sample,
        countB: observed.numerator,
        exposureB: observed.sample,
        designEffectA: deff.baseline,
        designEffectB: deff.comparable,
      });
  return test ? oneSidedPValue(test.z, direction) : null;
}

function evaluateRule(
  rule: GuardrailRule,
  baseline: WindowValue | undefined,
  comparable: WindowValue | undefined,
  absolute: WindowValue | undefined,
  deff: { baseline: number; comparable: number; absolute: number },
): GuardrailCheck {
  const label = getMetric(rule.metric)?.label ?? rule.metric;
  if (rule.type === "absolute") {
    const observed = absolute ?? comparable;
    const value = observed?.value ?? null;
    const enough = observed !== undefined && value !== null && observed.sample >= rule.minSample;
    let verdict: CheckVerdict = "no_data";
    let pValue: number | null = null;
    let factor: number | null = null;
    if (enough) {
      if (value <= rule.max) {
        verdict = "ok";
      } else {
        factor = varianceFactor(
          absolute ? deff.absolute : deff.comparable,
          observed.dispersion,
          baseline?.dispersion,
        );
        pValue = testAboveLimit(rule.metric, observed, rule.max, factor)?.pValue ?? null;
        verdict = pValue !== null && pValue < GUARDRAIL_ALPHA ? "breach" : "not_significant";
      }
    }
    const base = {
      metric: rule.metric,
      label,
      type: rule.type,
      direction: null,
      limit: rule.max,
      baseline: baseline?.value ?? null,
      observed: value,
      change: null,
      pValue,
      varianceFactor: factor,
      baselineSample: baseline?.sample ?? 0,
      observedSample: observed?.sample ?? 0,
      verdict,
    } satisfies Omit<GuardrailCheck, "summary">;
    return { ...base, summary: describe(base) };
  }

  const before = baseline?.value ?? null;
  const after = comparable?.value ?? null;
  const enough =
    baseline !== undefined &&
    comparable !== undefined &&
    before !== null &&
    after !== null &&
    baseline.sample >= rule.minSample &&
    comparable.sample >= rule.minSample;
  let verdict: CheckVerdict = "no_data";
  let change: number | null = null;
  let pValue: number | null = null;
  let factor: number | null = null;
  let limit = rule.maxRelativeChange;
  if (enough) {
    const factors = {
      baseline: varianceFactor(deff.baseline, baseline.dispersion, comparable.dispersion),
      comparable: varianceFactor(deff.comparable, comparable.dispersion, baseline.dispersion),
    };
    if (before <= 0) {
      const zeroMax = rule.zeroBaselineMax ?? ZERO_BASELINE_LIMITS[rule.metric];
      if (rule.direction === "decrease") {
        // Desde 0 no puede bajar: no hay daño posible en esa dirección.
        verdict = "ok";
      } else if (zeroMax === undefined) {
        verdict = "no_baseline";
      } else {
        limit = zeroMax;
        if (after <= zeroMax) {
          verdict = "ok";
        } else {
          factor = factors.comparable;
          pValue = testAboveLimit(rule.metric, comparable, zeroMax, factor)?.pValue ?? null;
          verdict = pValue !== null && pValue < GUARDRAIL_ALPHA ? "breach" : "not_significant";
        }
      }
    } else {
      change = after / before - 1;
      const beyond =
        rule.direction === "increase"
          ? change > rule.maxRelativeChange
          : change < -rule.maxRelativeChange;
      if (!beyond) {
        verdict = "ok";
      } else {
        factor = factors.comparable;
        pValue = degradationPValue(rule.metric, rule.direction, baseline, comparable, factors);
        verdict = pValue !== null && pValue < GUARDRAIL_ALPHA ? "breach" : "not_significant";
      }
    }
  }
  const base = {
    metric: rule.metric,
    label,
    type: rule.type,
    direction: rule.direction,
    limit,
    baseline: before,
    observed: after,
    change,
    pValue,
    varianceFactor: factor,
    baselineSample: baseline?.sample ?? 0,
    observedSample: comparable?.sample ?? 0,
    verdict,
  } satisfies Omit<GuardrailCheck, "summary">;
  return { ...base, summary: describe(base) };
}

/**
 * Evalúa las salvaguardas. `baseline` es la línea base (o el control); `comparable` lo observado en
 * días comparables (o el tratamiento); `absolute`, si se da, lo observado en TODOS los días (los
 * límites absolutos también aplican en congelamientos). `designEffect`: el de cada ventana
 * (1 + (m − 1)·ρ con m = impresiones por persona en ESA ventana, como el analista); si falta, el
 * supuesto del plan. Si una ventana trae su sobredispersión (`WindowValue.dispersion`) y es mayor,
 * manda esa. Sin la exposición mínima: `pending`.
 */
export function evaluateGuardrails(
  guardrails: Guardrails,
  windows: {
    baseline: ReadonlyMap<string, WindowValue>;
    comparable: ReadonlyMap<string, WindowValue>;
    absolute?: ReadonlyMap<string, WindowValue>;
    exposure: number;
    designEffect?: { baseline: number; comparable: number; absolute?: number };
  },
): GuardrailEvaluation {
  const deff = {
    baseline: windows.designEffect?.baseline ?? ASSUMED_DESIGN_EFFECT,
    comparable: windows.designEffect?.comparable ?? ASSUMED_DESIGN_EFFECT,
    absolute:
      windows.designEffect?.absolute ?? windows.designEffect?.comparable ?? ASSUMED_DESIGN_EFFECT,
  };
  const checks = guardrails.rules.map((rule) =>
    evaluateRule(
      rule,
      windows.baseline.get(rule.metric),
      windows.comparable.get(rule.metric),
      windows.absolute?.get(rule.metric),
      deff,
    ),
  );
  const status =
    windows.exposure < guardrails.minExposureImpressions
      ? "pending"
      : checks.some((check) => check.verdict === "breach")
        ? "breached"
        : "ok";
  return {
    status,
    exposure: windows.exposure,
    requiredExposure: guardrails.minExposureImpressions,
    checks,
  };
}

const NOT_RECORDED = new Set<string>(PENDING_METRICS.map((metric) => metric.key));

/**
 * Salvaguardas que todavía no se pudieron resolver (sin datos, sin línea base o sin significancia),
 * sin contar las métricas que aún no se registran (5xx): esas nunca tendrán datos y no deben
 * alargar la vigilancia.
 */
export function unresolvedChecks(evaluation: GuardrailEvaluation): GuardrailCheck[] {
  return evaluation.checks.filter(
    (check) =>
      check.verdict !== "ok" && check.verdict !== "breach" && !NOT_RECORDED.has(check.metric),
  );
}

export type WatchOutcome = "revert" | "no_harm" | "no_evidence" | "watching";

/**
 * Qué hace el monitor con la evaluación de hoy (ADR-037):
 * - `revert`: una salvaguarda se rompió (pasa su umbral y es significativa);
 * - `no_harm`: pasaron los días de vigilancia con todo evaluado y sin daño significativo;
 * - `no_evidence`: llegó la ventana máxima sin poder evaluarlo todo: se deja de vigilar;
 * - `watching`: se sigue vigilando.
 */
export function watchOutcome(
  evaluation: GuardrailEvaluation,
  observedDays: number,
  guardrails: Pick<Guardrails, "monitorDays" | "maxWatchDays">,
): WatchOutcome {
  if (evaluation.status === "breached") return "revert";
  const settled = evaluation.status === "ok" && unresolvedChecks(evaluation).length === 0;
  if (settled && observedDays >= guardrails.monitorDays) return "no_harm";
  if (observedDays >= maxWatchDaysOf(guardrails)) return "no_evidence";
  return "watching";
}

/** Ventana máxima de vigilancia (nunca menor que los días de vigilancia). */
export function maxWatchDaysOf(guardrails: Pick<Guardrails, "monitorDays" | "maxWatchDays">) {
  return Math.max(guardrails.monitorDays, guardrails.maxWatchDays ?? DEFAULT_MAX_WATCH_DAYS);
}

/** Motivo corto de una reversión: las salvaguardas rotas. */
export function breachReason(evaluation: GuardrailEvaluation): string {
  const breaches = evaluation.checks.filter((check) => check.verdict === "breach");
  return `Salvaguarda rota. ${breaches.map((check) => check.summary).join(" ")}`.slice(0, 900);
}

/** Nota de cierre sin evidencia de daño: qué no se pudo evaluar. */
export function noEvidenceNote(evaluation: GuardrailEvaluation, days: number): string {
  const pending = unresolvedChecks(evaluation).map((check) => check.label);
  const exposure =
    evaluation.status === "pending"
      ? ` Se juntaron ${integer.format(evaluation.exposure)} de ${integer.format(evaluation.requiredExposure)} impresiones de exposición mínima.`
      : "";
  const detail = pending.length > 0 ? ` Sin datos o sin significancia: ${pending.join(", ")}.` : "";
  return `Vigilancia cerrada tras ${days} días: sin evidencia de daño con esta muestra (no quiere decir que el cambio sea seguro).${exposure}${detail}`.slice(
    0,
    900,
  );
}

/** Métricas que una evaluación necesita leer. */
export function guardrailMetrics(guardrails: Guardrails): string[] {
  return [...new Set(guardrails.rules.map((rule) => rule.metric))];
}
