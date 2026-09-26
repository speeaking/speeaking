/**
 * Estadística determinista del motor de automejora (P2: el código decide, nunca la IA).
 * plan-90-dias.md §2.4: prueba z de dos proporciones con α = 0.05 y potencia 80 %, corregida por el
 * efecto de diseño de agrupar impresiones por persona (1 + (m − 1)·ρ), y análisis por persona con
 * errores robustos por clúster. Todo en funciones puras y probadas.
 */

export const DEFAULT_ALPHA = 0.05;
export const DEFAULT_POWER = 0.8;
/** Correlación dentro de la persona supuesta por el plan (se recalcula si la medida es mayor). */
export const ASSUMED_ICC = 0.05;
/** Impresiones por persona supuestas por el plan cuando aún no hay medición. */
export const ASSUMED_IMPRESSIONS_PER_PERSON = 20;
/** CTR base supuesto por el plan cuando aún no hay medición. */
export const ASSUMED_BASE_RATE = 0.02;
/** Efecto mínimo que se quiere detectar: 2.0 % → 2.4 % = +20 % relativo. */
export const MIN_DETECTABLE_RELATIVE_LIFT = 0.2;

/** Función de error (Abramowitz y Stegun 7.1.26, error < 1.5e-7). */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-a * a);
  return sign * y;
}

/** Φ(z): distribución normal estándar acumulada. */
export function normalCdf(z: number): number {
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Φ⁻¹(p) (algoritmo de Acklam, error relativo < 1.2e-9 tras un paso de Newton). */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError("p debe estar entre 0 y 1.");
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  let x: number;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  } else if (p <= 1 - low) {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x =
      -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  // Un paso de Newton sobre Φ para pulir.
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/** Efecto de diseño por agrupar m observaciones por persona con correlación ρ: 1 + (m − 1)·ρ. */
export function designEffect(meanClusterSize: number, icc: number): number {
  return 1 + Math.max(0, meanClusterSize - 1) * Math.max(0, icc);
}

export type ProportionTest = {
  rateA: number;
  rateB: number;
  /** rateB − rateA */
  difference: number;
  /** (rateB − rateA) ÷ rateA; `null` si rateA = 0. */
  relativeChange: number | null;
  standardError: number;
  z: number;
  /** Bilateral. */
  pValue: number;
  /** Intervalo de 95 % de la diferencia. */
  ci95: [number, number];
  designEffect: number;
};

/**
 * Prueba z de dos proporciones (A = línea base o control, B = reciente o tratamiento). La varianza
 * de cada lado se multiplica por su efecto de diseño (`designEffectA`/`designEffectB`; si no se dan,
 * `designEffect` para ambos). Con muestras vacías devuelve `null`. `designEffect` en el resultado es
 * el mayor de los dos.
 */
export function twoProportionZTest(input: {
  successesA: number;
  trialsA: number;
  successesB: number;
  trialsB: number;
  designEffect?: number;
  designEffectA?: number;
  designEffectB?: number;
}): ProportionTest | null {
  const { trialsA, trialsB } = input;
  if (!(trialsA > 0 && trialsB > 0)) return null;
  const deffA = Math.max(1, input.designEffectA ?? input.designEffect ?? 1);
  const deffB = Math.max(1, input.designEffectB ?? input.designEffect ?? 1);
  // Una tasa por impresión nunca pasa de 1 para la prueba (p. ej. varias acciones por impresión).
  const rateA = Math.min(1, Math.max(0, input.successesA / trialsA));
  const rateB = Math.min(1, Math.max(0, input.successesB / trialsB));
  const pooled = (rateA * trialsA + rateB * trialsB) / (trialsA + trialsB);
  const pooledSe = Math.sqrt(pooled * (1 - pooled) * (deffA / trialsA + deffB / trialsB));
  const unpooledSe = Math.sqrt(
    (rateA * (1 - rateA) * deffA) / trialsA + (rateB * (1 - rateB) * deffB) / trialsB,
  );
  const deff = Math.max(deffA, deffB);
  const difference = rateB - rateA;
  const z = pooledSe > 0 ? difference / pooledSe : 0;
  const margin = 1.959963984540054 * unpooledSe;
  return {
    rateA,
    rateB,
    difference,
    relativeChange: rateA > 0 ? difference / rateA : null,
    standardError: pooledSe,
    z,
    pValue: pooledSe > 0 ? 2 * (1 - normalCdf(Math.abs(z))) : 1,
    ci95: [difference - margin, difference + margin],
    designEffect: deff,
  };
}

/**
 * Muestra por variante para detectar el cambio de `baselineRate` a `baselineRate × (1 + lift)` con
 * prueba bilateral: [z₁₋α/₂·√(2p̄q̄) + z₁₋β·√(p₀q₀ + p₁q₁)]² ÷ (p₁ − p₀)², por el efecto de diseño.
 * Con los supuestos del plan (2.0 % → 2.4 %, ρ = 0.05, m = 20) da ≈ 41,000 impresiones.
 */
export function requiredSamplePerVariant(input: {
  baselineRate: number;
  relativeLift?: number;
  alpha?: number;
  power?: number;
  designEffect?: number;
}): number {
  const p0 = Math.min(0.99, Math.max(1e-6, input.baselineRate));
  const p1 = Math.min(0.999, p0 * (1 + (input.relativeLift ?? MIN_DETECTABLE_RELATIVE_LIFT)));
  const zAlpha = normalQuantile(1 - (input.alpha ?? DEFAULT_ALPHA) / 2);
  const zBeta = normalQuantile(input.power ?? DEFAULT_POWER);
  const mean = (p0 + p1) / 2;
  const numerator =
    zAlpha * Math.sqrt(2 * mean * (1 - mean)) + zBeta * Math.sqrt(p0 * (1 - p0) + p1 * (1 - p1));
  const base = (numerator * numerator) / ((p1 - p0) * (p1 - p0));
  return Math.ceil(base * Math.max(1, input.designEffect ?? 1));
}

/** Una persona en el análisis: numerador y denominador de la métrica (p. ej. visitas e impresiones). */
export type Cluster = { x: number; n: number };

export type ClusteredRatio = {
  /** Σx ÷ Σn */
  ratio: number;
  x: number;
  n: number;
  /** Personas con n > 0. */
  clusters: number;
  /** Varianza del cociente con errores robustos por clúster (linealización, corrección k/(k−1)). */
  variance: number;
};

export function clusteredRatio(clusters: readonly Cluster[]): ClusteredRatio | null {
  const valid = clusters.filter((cluster) => cluster.n > 0);
  const k = valid.length;
  const n = valid.reduce((sum, cluster) => sum + cluster.n, 0);
  const x = valid.reduce((sum, cluster) => sum + cluster.x, 0);
  if (k < 2 || n <= 0) return null;
  const ratio = x / n;
  const residuals = valid.reduce((sum, cluster) => sum + (cluster.x - ratio * cluster.n) ** 2, 0);
  const variance = (k / (k - 1)) * (residuals / (n * n));
  return { ratio, x, n, clusters: k, variance };
}

/**
 * Correlación dentro de la persona (ρ) con el estimador ANOVA para datos binarios con clústeres de
 * tamaño distinto. `null` si no hay datos suficientes. Las tasas por persona se recortan a [0, 1].
 */
export function estimateIcc(clusters: readonly Cluster[]): number | null {
  const valid = clusters.filter((cluster) => cluster.n > 0);
  const k = valid.length;
  const total = valid.reduce((sum, cluster) => sum + cluster.n, 0);
  if (k < 2 || total - k <= 0) return null;
  const successes = valid.reduce((sum, cluster) => sum + Math.min(cluster.x, cluster.n), 0);
  const p = successes / total;
  let between = 0;
  let within = 0;
  for (const cluster of valid) {
    const pi = Math.min(1, cluster.x / cluster.n);
    between += cluster.n * (pi - p) ** 2;
    within += cluster.n * pi * (1 - pi);
  }
  const msb = between / (k - 1);
  const msw = within / (total - k);
  const n0 =
    (total - valid.reduce((sum, cluster) => sum + cluster.n * cluster.n, 0) / total) / (k - 1);
  const denominator = msb + (n0 - 1) * msw;
  if (!(denominator > 0)) return null;
  return Math.min(1, Math.max(0, (msb - msw) / denominator));
}

export type ClusteredComparison = ProportionTest & {
  control: ClusteredRatio;
  treatment: ClusteredRatio;
  /** Error estándar robusto por clúster (antes de tomar el mayor con el del efecto de diseño). */
  clusterStandardError: number;
  /** ρ usada: la mayor entre la supuesta y la medida. */
  icc: number;
  meanClusterSize: number;
};

/**
 * Compara control contra tratamiento con la persona como unidad. Para no decidir con ruido, el error
 * estándar es el MAYOR entre el robusto por clúster y el de la prueba z con efecto de diseño
 * (ρ = máx(0.05, ρ medida)).
 */
export function compareClusteredRatios(
  controlClusters: readonly Cluster[],
  treatmentClusters: readonly Cluster[],
): ClusteredComparison | null {
  const control = clusteredRatio(controlClusters);
  const treatment = clusteredRatio(treatmentClusters);
  if (!control || !treatment) return null;
  const all = [...controlClusters, ...treatmentClusters];
  const measured = estimateIcc(all);
  const icc = Math.max(ASSUMED_ICC, measured ?? 0);
  const meanClusterSize = (control.n + treatment.n) / (control.clusters + treatment.clusters);
  const deff = designEffect(meanClusterSize, icc);
  const ztest = twoProportionZTest({
    successesA: control.x,
    trialsA: control.n,
    successesB: treatment.x,
    trialsB: treatment.n,
    designEffect: deff,
  });
  if (!ztest) return null;
  const clusterSe = Math.sqrt(control.variance + treatment.variance);
  const se = Math.max(clusterSe, ztest.standardError);
  const difference = treatment.ratio - control.ratio;
  const z = se > 0 ? difference / se : 0;
  const margin = 1.959963984540054 * se;
  return {
    ...ztest,
    rateA: control.ratio,
    rateB: treatment.ratio,
    difference,
    relativeChange: control.ratio > 0 ? difference / control.ratio : null,
    standardError: se,
    z,
    pValue: se > 0 ? 2 * (1 - normalCdf(Math.abs(z))) : 1,
    ci95: [difference - margin, difference + margin],
    control,
    treatment,
    clusterStandardError: clusterSe,
    icc,
    meanClusterSize,
  };
}

/** Intervalo de 95 % de una proporción con efecto de diseño (aproximación normal). */
export function proportionInterval(
  successes: number,
  trials: number,
  deff = 1,
): { rate: number; low: number; high: number } | null {
  if (!(trials > 0)) return null;
  const rate = Math.min(1, Math.max(0, successes / trials));
  const margin = 1.959963984540054 * Math.sqrt(((rate * (1 - rate)) / trials) * Math.max(1, deff));
  return { rate, low: Math.max(0, rate - margin), high: Math.min(1, rate + margin) };
}

// ───────────────────────── Pruebas unilaterales (salvaguardas) ─────────────────────────

/**
 * Valor p unilateral de un estadístico z en la dirección del DAÑO: `increase` = ¿subió?
 * (1 − Φ(z)); `decrease` = ¿bajó? (Φ(z)).
 */
export function oneSidedPValue(z: number, direction: "increase" | "decrease"): number {
  return direction === "increase" ? 1 - normalCdf(z) : normalCdf(z);
}

export type RateTest = {
  rateA: number;
  rateB: number;
  /** (rateB − rateA) ÷ rateA; `null` si rateA = 0. */
  relativeChange: number | null;
  z: number;
  standardError: number;
};

/**
 * Comparación de dos tasas de conteo (Poisson) con exposición distinta: p. ej. visitas por
 * vendedor-día antes y después de un cambio. La varianza de cada lado, λ̂ ÷ exposición con λ̂
 * combinada, se multiplica por su efecto de diseño (las visitas de una misma persona no son
 * independientes). `null` sin exposición en algún lado.
 */
export function poissonRateZTest(input: {
  countA: number;
  exposureA: number;
  countB: number;
  exposureB: number;
  designEffectA?: number;
  designEffectB?: number;
}): RateTest | null {
  const { countA, exposureA, countB, exposureB } = input;
  if (!(exposureA > 0 && exposureB > 0)) return null;
  const deffA = Math.max(1, input.designEffectA ?? 1);
  const deffB = Math.max(1, input.designEffectB ?? 1);
  const rateA = Math.max(0, countA) / exposureA;
  const rateB = Math.max(0, countB) / exposureB;
  const pooled = (Math.max(0, countA) + Math.max(0, countB)) / (exposureA + exposureB);
  const standardError = Math.sqrt(pooled * (deffA / exposureA + deffB / exposureB));
  const z = standardError > 0 ? (rateB - rateA) / standardError : 0;
  return {
    rateA,
    rateB,
    relativeChange: rateA > 0 ? (rateB - rateA) / rateA : null,
    z,
    standardError,
  };
}

/**
 * ¿La tasa observada está por encima de un límite (H₀: tasa ≤ límite)? Prueba z unilateral con el
 * efecto de diseño. `kind = "proportion"`: éxitos de `trials` (varianza límite·(1 − límite));
 * `"rate"`: conteo por unidad de exposición (varianza límite, Poisson). `null` sin muestra o con un
 * límite fuera de rango.
 */
export function aboveLimitTest(input: {
  kind: "proportion" | "rate";
  successes: number;
  trials: number;
  limit: number;
  designEffect?: number;
}): { rate: number; z: number; pValue: number } | null {
  const { successes, trials, limit } = input;
  if (!(trials > 0) || !(limit > 0) || (input.kind === "proportion" && limit >= 1)) return null;
  const deff = Math.max(1, input.designEffect ?? 1);
  const rate = Math.max(0, successes) / trials;
  const variance = input.kind === "proportion" ? limit * (1 - limit) : limit;
  const standardError = Math.sqrt((variance * deff) / trials);
  const z = (rate - limit) / standardError;
  return { rate, z, pValue: 1 - normalCdf(z) };
}

// ───────────────────────── Sobredispersión (cuasi-verosimilitud) ─────────────────────────

/** χ² de Pearson de una tasa entre unidades y sus grados de libertad (se suman para combinar). */
export type Dispersion = { chi2: number; df: number };

/** Grados de libertad mínimos para usar la sobredispersión medida (al menos 3 unidades). */
export const MIN_DISPERSION_DF = 2;

/**
 * Sobredispersión de una tasa entre unidades (días o personas): χ² de Pearson alrededor de la tasa
 * común de las unidades. χ² ÷ gl ≈ 1 es lo que supone la prueba (binomial en las proporciones,
 * Poisson en los conteos); más de 1, que las unidades varían más de lo que explica el azar: días
 * atípicos (quincena, un puente) o una sola persona con muchos reportes. Las pruebas lo usan como
 * factor de varianza (cuasi-binomial o cuasi-Poisson). `null` con menos de 2 unidades con
 * denominador o sin eventos (no hay variación que medir). En las proporciones, lo de cada unidad se
 * recorta a su denominador (como la prueba, que nunca pasa de 1 por impresión).
 */
export function pearsonDispersion(
  units: readonly Cluster[],
  kind: "proportion" | "rate",
): Dispersion | null {
  const valid = units.filter((unit) => unit.n > 0 && Number.isFinite(unit.x));
  if (valid.length < 2) return null;
  const successes = (unit: Cluster) =>
    kind === "proportion" ? Math.min(Math.max(0, unit.x), unit.n) : Math.max(0, unit.x);
  const total = valid.reduce((sum, unit) => sum + unit.n, 0);
  const rate = valid.reduce((sum, unit) => sum + successes(unit), 0) / total;
  const unitVariance = kind === "proportion" ? rate * (1 - rate) : rate;
  if (!(unitVariance > 0)) return null;
  const chi2 = valid.reduce(
    (sum, unit) => sum + (successes(unit) - unit.n * rate) ** 2 / (unit.n * unitVariance),
    0,
  );
  return { chi2, df: valid.length - 1 };
}

/** Factor de varianza de una sobredispersión (χ² ÷ gl); `null` con menos de `MIN_DISPERSION_DF`. */
export function dispersionFactor(dispersion: Dispersion | null | undefined): number | null {
  if (!dispersion || dispersion.df < MIN_DISPERSION_DF) return null;
  return dispersion.chi2 / dispersion.df;
}

/**
 * Factor de varianza de un lado de una prueba: el mayor entre su efecto de diseño y la
 * sobredispersión medida en sus unidades; si ese lado tiene muy pocas (p. ej. 1 o 2 días observados),
 * la del otro lado (la variación entre días es de la métrica, no del cambio). Sin ninguna medida, el
 * efecto de diseño; nunca menos de 1. Así la sobredispersión solo puede hacer la prueba MÁS
 * conservadora.
 */
export function varianceFactor(
  deff: number,
  own?: Dispersion | null,
  other?: Dispersion | null,
): number {
  return Math.max(1, deff, dispersionFactor(own) ?? dispersionFactor(other) ?? 1);
}
