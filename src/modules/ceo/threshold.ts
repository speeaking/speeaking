import { addDays, type Day } from "@/modules/platform/calendar";
import {
  ASSUMED_BASE_RATE,
  ASSUMED_ICC,
  ASSUMED_IMPRESSIONS_PER_PERSON,
  designEffect,
  MIN_DETECTABLE_RELATIVE_LIFT,
  requiredSamplePerVariant,
} from "./stats";

/**
 * Umbral de tráfico (plan-90-dias.md §2.4, ADR-033 «no se decide con ruido»): la autonomía de riesgo
 * bajo y los experimentos solo actúan si se pueden juntar 2 × la muestra mínima por variante en
 * ≤ 14 días, sostenido durante las 2 últimas semanas (que también sirven de 7 días de línea base).
 */

export const THRESHOLD_WINDOW_DAYS = 14;
export const THRESHOLD_VARIANTS = 2;
/** Muestra mínima en la línea base para usar la tasa medida en lugar de la supuesta. */
const MIN_BASELINE_FOR_MEASURED_RATE = 1_000;
/** Personas mínimas para usar las impresiones por persona medidas. */
const MIN_VIEWERS_FOR_MEASURED_M = 30;

/**
 * Tamaño del clúster (m) del efecto de diseño para una VENTANA de varios días: impresiones con
 * persona ÷ personas DISTINTAS en toda la ventana. No es el promedio por persona y día: quien regresa
 * varios días junta más impresiones correlacionadas, y usar el diario subestimaría la varianza (y
 * daría valores p demasiado chicos). Sin personas suficientes, el supuesto del plan (m = 20).
 */
export function windowClusterSize(period: { viewers: number; personalImpressions: number }): {
  m: number;
  source: "measured" | "assumed";
} {
  if (
    period.viewers >= MIN_VIEWERS_FOR_MEASURED_M &&
    period.personalImpressions >= period.viewers
  ) {
    return { m: period.personalImpressions / period.viewers, source: "measured" };
  }
  return { m: ASSUMED_IMPRESSIONS_PER_PERSON, source: "assumed" };
}

export type SampleAssumptions = {
  baselineRate: number;
  baselineRateSource: "measured" | "assumed";
  impressionsPerPerson: number;
  impressionsPerPersonSource: "measured" | "assumed";
  icc: number;
  designEffect: number;
  relativeLift: number;
  minSamplePerVariant: number;
};

/**
 * Muestra mínima por variante (impresiones) para la métrica principal: con la tasa y las impresiones
 * por persona medidas si hay datos suficientes; si no, los supuestos del plan (2.0 %, m = 20, ρ = 0.05
 * → ≈ 41,000).
 */
export function minSampleFor(measured: {
  baselineRate?: number | null;
  baselineSample?: number;
  impressionsPerPerson?: number | null;
  viewers?: number;
  icc?: number | null;
}): SampleAssumptions {
  const useRate =
    measured.baselineRate !== null &&
    measured.baselineRate !== undefined &&
    measured.baselineRate > 0 &&
    (measured.baselineSample ?? 0) >= MIN_BASELINE_FOR_MEASURED_RATE;
  const useM =
    measured.impressionsPerPerson !== null &&
    measured.impressionsPerPerson !== undefined &&
    measured.impressionsPerPerson >= 1 &&
    (measured.viewers ?? 0) >= MIN_VIEWERS_FOR_MEASURED_M;
  const baselineRate = useRate ? measured.baselineRate! : ASSUMED_BASE_RATE;
  const impressionsPerPerson = useM
    ? measured.impressionsPerPerson!
    : ASSUMED_IMPRESSIONS_PER_PERSON;
  const icc = Math.max(ASSUMED_ICC, measured.icc ?? 0);
  const deff = designEffect(impressionsPerPerson, icc);
  return {
    baselineRate,
    baselineRateSource: useRate ? "measured" : "assumed",
    impressionsPerPerson,
    impressionsPerPersonSource: useM ? "measured" : "assumed",
    icc,
    designEffect: deff,
    relativeLift: MIN_DETECTABLE_RELATIVE_LIFT,
    minSamplePerVariant: requiredSamplePerVariant({
      baselineRate,
      relativeLift: MIN_DETECTABLE_RELATIVE_LIFT,
      designEffect: deff,
    }),
  };
}

export type ThresholdAssessment = {
  met: boolean;
  /** Hay tráfico suficiente (aunque el umbral no se cumpla porque aún no es visible). */
  enoughTraffic: boolean;
  /** Las impresiones son visibles (T5, `FEED_IMPRESSIONS_ARE_VISIBLE`); si no, nunca se cumple. */
  impressionsVisible: boolean;
  minSamplePerVariant: number;
  /** ⌈2 × muestra ÷ 14⌉ impresiones al día (≈ 5,900 con los supuestos del plan). */
  requiredPerDay: number;
  /** Impresiones de la semana más reciente y de la anterior. */
  lastWeek: number;
  previousWeek: number;
  /** Días con fila en las 2 semanas. */
  daysWithData: number;
  reason: string;
};

export const NOT_VISIBLE_REASON =
  "El umbral se mide en impresiones visibles y estas cifras son piezas servidas: no se da por cumplido.";

/**
 * ¿Se cumple el umbral al cierre de `lastDay`? `dailyImpressions` trae las impresiones CON PERSONA
 * del feed por día (las únicas que se asignan a una variante; los días sin fila cuentan 0). Cada una
 * de las dos últimas semanas debe alcanzar 7 × el mínimo diario. `impressionsVisible` dice si esas
 * impresiones ya son visibles (T5): si no, el umbral no se cumple (plan-90-dias.md §2.4: «se mide en
 * impresiones visibles, no en piezas servidas»).
 */
export function assessTrafficThreshold(input: {
  lastDay: Day;
  dailyImpressions: ReadonlyMap<Day, number>;
  minSamplePerVariant: number;
  impressionsVisible: boolean;
}): ThresholdAssessment {
  const requiredPerDay = Math.ceil(
    (THRESHOLD_VARIANTS * input.minSamplePerVariant) / THRESHOLD_WINDOW_DAYS,
  );
  let lastWeek = 0;
  let previousWeek = 0;
  let daysWithData = 0;
  for (let offset = 0; offset < THRESHOLD_WINDOW_DAYS; offset++) {
    const value = input.dailyImpressions.get(addDays(input.lastDay, -offset));
    if (value !== undefined) daysWithData++;
    if (offset < 7) lastWeek += value ?? 0;
    else previousWeek += value ?? 0;
  }
  const weekly = requiredPerDay * 7;
  const enoughTraffic = lastWeek >= weekly && previousWeek >= weekly;
  const met = enoughTraffic && input.impressionsVisible;
  const integer = new Intl.NumberFormat("es-MX");
  const counts = `${integer.format(lastWeek)} y ${integer.format(previousWeek)} impresiones visibles de personas con sesión en las dos últimas semanas`;
  return {
    met,
    enoughTraffic,
    impressionsVisible: input.impressionsVisible,
    minSamplePerVariant: input.minSamplePerVariant,
    requiredPerDay,
    lastWeek,
    previousWeek,
    daysWithData,
    reason: met
      ? `Umbral cumplido: ${counts} (mínimo ${integer.format(weekly)} cada una).`
      : enoughTraffic
        ? `${NOT_VISIBLE_REASON} Hay ${counts}.`
        : `Tráfico insuficiente: ${counts}; hacen falta ${integer.format(weekly)} en cada una (${integer.format(requiredPerDay)} al día).${input.impressionsVisible ? "" : ` ${NOT_VISIBLE_REASON}`}`,
  };
}
