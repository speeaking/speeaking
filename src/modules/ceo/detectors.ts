import type { RiskLevel } from "@/generated/prisma/enums";
import type { FeedPolicy } from "@/modules/feed/policy";
import type { Day } from "@/modules/platform/calendar";
import {
  classifyRisk,
  formatTunableValue,
  getTunable,
  readTunable,
  stepValue,
  type TunableKey,
} from "@/modules/platform/tunables";
import { formatMetricValue } from "./metric-catalog";
import {
  DEFAULT_ALPHA,
  proportionInterval,
  type ProportionTest,
  twoProportionZTest,
  varianceFactor,
} from "./stats";
import { successesOf, type WindowValue } from "./windows";

/**
 * Detectores del analista diario: comparan la ventana reciente (7 días) con la línea base (28 días
 * previos) con pruebas estadísticas deterministas y, si hay una señal clara, proponen UN paso dentro
 * de los límites del catálogo. La dirección es una hipótesis: la valida el experimento o las
 * salvaguardas. Nunca proponen nada de dinero (ADR-033).
 */

export type AnalystInput = {
  day: Day;
  recent: ReadonlyMap<string, WindowValue>;
  baseline: ReadonlyMap<string, WindowValue>;
  policy: FeedPolicy;
  /**
   * Efecto de diseño por agrupar impresiones por persona en la ventana reciente (1 + (m − 1)·ρ, con
   * m = impresiones por persona en TODA la ventana).
   */
  designEffect: number;
  /** El de la línea base (su ventana es más larga, así que m es mayor). Por omisión, `designEffect`. */
  baselineDesignEffect?: number;
};

export type ProposalCandidate = {
  detector: string;
  title: string;
  hypothesis: string;
  expectedImpact: string;
  settingKey: string | null;
  previousValue: number | null;
  newValue: number | null;
  risk: RiskLevel;
  /** Cifras (calculadas por código) que respaldan la propuesta. */
  facts: Record<string, number | string | null>;
};

/** Mínimos para considerar una ventana (días con datos y muestra). */
export const MIN_RECENT_DAYS = 5;
export const MIN_BASELINE_DAYS = 7;
const MIN_RECENT_SAMPLE = 1_000;
const MIN_BASELINE_SAMPLE = 2_000;
const MIN_COMMERCE_SAMPLE = 500;

type Comparison = { test: ProportionTest; recent: WindowValue; baseline: WindowValue };

function compare(input: AnalystInput, metric: string, minSample: number): Comparison | null {
  const recent = input.recent.get(metric);
  const baseline = input.baseline.get(metric);
  if (!recent || !baseline) return null;
  if (recent.days < MIN_RECENT_DAYS || baseline.days < MIN_BASELINE_DAYS) return null;
  if (recent.sample < minSample || baseline.sample < Math.max(minSample, MIN_BASELINE_SAMPLE)) {
    return null;
  }
  // Reciente contra línea base no cancela los días atípicos (quincena, puentes): si los días varían
  // más de lo que explica el azar, esa sobredispersión manda sobre el efecto de diseño.
  const test = twoProportionZTest({
    successesA: successesOf(metric, baseline),
    trialsA: baseline.sample,
    successesB: successesOf(metric, recent),
    trialsB: recent.sample,
    designEffectA: varianceFactor(
      input.baselineDesignEffect ?? input.designEffect,
      baseline.dispersion,
      recent.dispersion,
    ),
    designEffectB: varianceFactor(input.designEffect, recent.dispersion, baseline.dispersion),
  });
  return test ? { test, recent, baseline } : null;
}

function significant(test: ProportionTest, direction: "up" | "down", minRelative: number) {
  const change = test.relativeChange;
  if (change === null || test.pValue >= DEFAULT_ALPHA) return false;
  return direction === "up" ? change >= minRelative : change <= -minRelative;
}

const percent = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

function facts(
  metric: string,
  comparison: Comparison,
  extra: Record<string, number | string> = {},
) {
  return {
    metric,
    recent: comparison.recent.value,
    baseline: comparison.baseline.value,
    recentSample: comparison.recent.sample,
    baselineSample: comparison.baseline.sample,
    relativeChange: comparison.test.relativeChange,
    pValue: Number(comparison.test.pValue.toFixed(6)),
    z: Number(comparison.test.z.toFixed(4)),
    designEffect: Number(comparison.test.designEffect.toFixed(4)),
    ...extra,
  };
}

function settingChange(
  input: AnalystInput,
  key: TunableKey,
  direction: 1 | -1,
): { previousValue: number; newValue: number; from: string; to: string } | null {
  const tunable = getTunable(key);
  if (!tunable) return null;
  const previousValue = readTunable(input.policy, tunable);
  const newValue = stepValue(tunable, previousValue, direction);
  if (newValue === null) return null;
  return {
    previousValue,
    newValue,
    from: formatTunableValue(tunable, previousValue),
    to: formatTunableValue(tunable, newValue),
  };
}

type Detector = (input: AnalystInput) => ProposalCandidate | null;

/** El CTR comercial cayó: posible fatiga por ver comercio seguido → espaciarlo (riesgo MEDIO). */
const commerceCtrDrop: Detector = (input) => {
  const metric = "feed.commerce.ctr";
  const comparison = compare(input, metric, MIN_COMMERCE_SAMPLE);
  if (!comparison || !significant(comparison.test, "down", 0.1)) return null;
  const key = "feed.policy.commerceSlotEvery";
  const change = settingChange(input, key, 1);
  if (!change) return null;
  const drop = percent.format(Math.abs(comparison.test.relativeChange ?? 0) * 100);
  return {
    detector: "commerce_ctr_drop",
    title: `Espaciar las piezas comerciales (${change.from} → ${change.to})`,
    hypothesis: `La conversión comercial del feed bajó ${drop} % (de ${formatMetricValue(metric, comparison.baseline.value)} a ${formatMetricValue(metric, comparison.recent.value)}; p = ${comparison.test.pValue.toFixed(4)}). Puede ser fatiga por ver comercio muy seguido: espaciarlo podría recuperarla.`,
    expectedImpact: `Recuperar la conversión comercial hacia su línea base (${formatMetricValue(metric, comparison.baseline.value)}) sin bajar las visitas a producto por impresión.`,
    settingKey: key,
    previousValue: change.previousValue,
    newValue: change.newValue,
    risk: classifyRisk(key),
    facts: facts(metric, comparison),
  };
};

/** El contenido comercial visto se acerca al límite de 30 % → espaciarlo (riesgo MEDIO). */
const commerceShareHigh: Detector = (input) => {
  const metric = "feed.commerce.share";
  const recent = input.recent.get(metric);
  if (!recent || recent.days < MIN_RECENT_DAYS || recent.sample < MIN_RECENT_SAMPLE) return null;
  const interval = proportionInterval(
    recent.numerator,
    recent.sample,
    varianceFactor(input.designEffect, recent.dispersion),
  );
  if (!interval || interval.low <= 0.27) return null;
  const key = "feed.policy.commerceSlotEvery";
  const change = settingChange(input, key, 1);
  if (!change) return null;
  return {
    detector: "commerce_share_high",
    title: `Menos contenido comercial (${change.from} → ${change.to})`,
    hypothesis: `El contenido comercial visto está en ${formatMetricValue(metric, interval.rate)} (intervalo de 95 %: ${formatMetricValue(metric, interval.low)} a ${formatMetricValue(metric, interval.high)}), cerca del límite de 30 %. Espaciar las piezas comerciales mantiene el feed como red social primero.`,
    expectedImpact:
      "Bajar el contenido comercial visto por debajo de 27 % sin perder visitas a producto por impresión.",
    settingKey: key,
    previousValue: change.previousValue,
    newValue: change.newValue,
    risk: classifyRisk(key),
    facts: {
      metric,
      recent: interval.rate,
      low: interval.low,
      high: interval.high,
      recentSample: recent.sample,
      designEffect: Number(input.designEffect.toFixed(4)),
    },
  };
};

/** El CTR comercial subió y hay margen bajo el límite → un poco más de comercio (riesgo MEDIO). */
const commerceCtrRise: Detector = (input) => {
  const metric = "feed.commerce.ctr";
  const comparison = compare(input, metric, MIN_COMMERCE_SAMPLE);
  if (!comparison || !significant(comparison.test, "up", 0.1)) return null;
  const share = input.recent.get("feed.commerce.share");
  if (!share || share.value === null || share.value >= 0.22) return null;
  const key = "feed.policy.commerceSlotEvery";
  const change = settingChange(input, key, -1);
  if (!change) return null;
  const rise = percent.format((comparison.test.relativeChange ?? 0) * 100);
  return {
    detector: "commerce_ctr_rise",
    title: `Un poco más de exposición a vendedores (${change.from} → ${change.to})`,
    hypothesis: `La conversión comercial subió ${rise} % (de ${formatMetricValue(metric, comparison.baseline.value)} a ${formatMetricValue(metric, comparison.recent.value)}; p = ${comparison.test.pValue.toFixed(4)}) y el contenido comercial visto es ${formatMetricValue("feed.commerce.share", share.value)}. Hay interés: una pieza comercial más seguido podría dar más visitas a los vendedores.`,
    expectedImpact:
      "Más visitas a producto por impresión sin pasar de 30 % de contenido comercial ni subir «No me interesa».",
    settingKey: key,
    previousValue: change.previousValue,
    newValue: change.newValue,
    risk: classifyRisk(key),
    facts: facts(metric, comparison, { commerceShare: share.value }),
  };
};

/** La interacción cayó: el contenido puede sentirse viejo → más peso a lo reciente (riesgo BAJO). */
const engagementDrop: Detector = (input) => {
  const metric = "feed.engagement.rate";
  const comparison = compare(input, metric, MIN_RECENT_SAMPLE);
  if (!comparison || !significant(comparison.test, "down", 0.1)) return null;
  const key = "feed.policy.recencyHalfLifeHours";
  const change = settingChange(input, key, -1);
  if (!change) return null;
  const drop = percent.format(Math.abs(comparison.test.relativeChange ?? 0) * 100);
  return {
    detector: "engagement_drop",
    title: `Dar más peso a lo reciente (${change.from} → ${change.to})`,
    hypothesis: `La interacción por impresión bajó ${drop} % (de ${formatMetricValue(metric, comparison.baseline.value)} a ${formatMetricValue(metric, comparison.recent.value)}; p = ${comparison.test.pValue.toFixed(4)}). Si el feed muestra piezas viejas, acortar la vida media de la recencia lo refresca.`,
    expectedImpact: `Recuperar la interacción por impresión hacia ${formatMetricValue(metric, comparison.baseline.value)}.`,
    settingKey: key,
    previousValue: change.previousValue,
    newValue: change.newValue,
    risk: classifyRisk(key),
    facts: facts(metric, comparison),
  };
};

/** Subió «No me interesa»: demasiado contenido fuera de sus comunidades → menos exploración (BAJO). */
const notInterestedRise: Detector = (input) => {
  const metric = "not_interested.per_1k_impressions";
  const comparison = compare(input, metric, MIN_RECENT_SAMPLE);
  if (!comparison || !significant(comparison.test, "up", 0.15)) return null;
  const key = "feed.policy.explorationShare";
  const change = settingChange(input, key, -1);
  if (!change) return null;
  const rise = percent.format((comparison.test.relativeChange ?? 0) * 100);
  return {
    detector: "not_interested_rise",
    title: `Menos contenido de exploración (${change.from} → ${change.to})`,
    hypothesis: `«No me interesa» subió ${rise} % (de ${formatMetricValue(metric, comparison.baseline.value)} a ${formatMetricValue(metric, comparison.recent.value)}; p = ${comparison.test.pValue.toFixed(4)}). Mostrar menos piezas de fuera de sus comunidades podría bajarlo.`,
    expectedImpact: `Regresar «No me interesa» a su línea base (${formatMetricValue(metric, comparison.baseline.value)}).`,
    settingKey: key,
    previousValue: change.previousValue,
    newValue: change.newValue,
    risk: classifyRisk(key),
    facts: facts(metric, comparison),
  };
};

/** Suben los reportes: es de políticas y moderación → riesgo ALTO, solo propuesta, sin ajuste. */
const reportsRise: Detector = (input) => {
  const metric = "reports.per_1k_impressions";
  const comparison = compare(input, metric, MIN_RECENT_SAMPLE);
  if (!comparison || !significant(comparison.test, "up", 0.25)) return null;
  const rise = percent.format((comparison.test.relativeChange ?? 0) * 100);
  return {
    detector: "reports_rise",
    title: "Revisar la moderación: suben los reportes",
    hypothesis: `Los reportes por mil impresiones subieron ${rise} % (de ${formatMetricValue(metric, comparison.baseline.value)} a ${formatMetricValue(metric, comparison.recent.value)}; p = ${comparison.test.pValue.toFixed(4)}). Puede haber contenido o vendedores problemáticos nuevos.`,
    expectedImpact:
      "Revisar la cola de moderación y, si hace falta, ajustar políticas. Lo decide una persona.",
    settingKey: null,
    previousValue: null,
    newValue: null,
    risk: classifyRisk(null),
    facts: facts(metric, comparison),
  };
};

/** En orden de prioridad: si dos tocan el mismo ajuste, gana el primero. */
export const DETECTORS: readonly Detector[] = [
  commerceShareHigh,
  commerceCtrDrop,
  commerceCtrRise,
  notInterestedRise,
  engagementDrop,
  reportsRise,
];

/** Corre los detectores; a lo más una propuesta por ajuste (y una por detector). */
export function runDetectors(input: AnalystInput): ProposalCandidate[] {
  const bySetting = new Set<string>();
  const result: ProposalCandidate[] = [];
  for (const detector of DETECTORS) {
    const candidate = detector(input);
    if (!candidate) continue;
    const slot = candidate.settingKey ?? `detector:${candidate.detector}`;
    if (bySetting.has(slot)) continue;
    bySetting.add(slot);
    result.push(candidate);
  }
  return result;
}
