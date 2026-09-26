import type { Day } from "@/modules/platform/calendar";
import { getMetric } from "./metric-catalog";
import { type Dispersion, pearsonDispersion } from "./stats";

/** Fila de `DailyMetric` ya leída (total, `dimension = ""`, o de una variante). */
export type MetricRow = { day: Day; key: string; value: number; sampleSize: number };

export type WindowValue = {
  /** Valor de la ventana: suma (conteos) o cociente ponderado (tasas). `null` sin muestra. */
  value: number | null;
  /** Σ sampleSize (el denominador en las tasas). */
  sample: number;
  /** Σ numeradores (valor × muestra) en las tasas; la suma en los conteos. */
  numerator: number;
  /** Días con fila dentro de la ventana. */
  days: number;
  /**
   * Solo tasas: cuánto varían las unidades de la ventana (días en el monitor, personas en un
   * experimento) alrededor de su tasa común (`pearsonDispersion`). Las pruebas lo usan como factor de
   * varianza si pasa del efecto de diseño. Sin él (`undefined`/`null`), solo el efecto de diseño.
   */
  dispersion?: Dispersion | null;
};

const EMPTY: WindowValue = { value: null, sample: 0, numerator: 0, days: 0 };

/**
 * Qué prueba corresponde a una tasa: proporción por impresión («percent», «por mil»; binomial) o
 * conteo por unidad de exposición (p. ej. visitas por vendedor activo; Poisson).
 */
export function rateKind(key: string): "proportion" | "rate" {
  const format = getMetric(key)?.format;
  return format === "percent" || format === "per1k" ? "proportion" : "rate";
}

/**
 * Agrega una métrica sobre un conjunto de días. Los días sin fila no suman (no se inventa un 0 en una
 * tasa); en un conteo, la ausencia equivale a 0 porque la tarea escribe todos los conteos del día.
 */
export function aggregateWindow(
  rows: readonly MetricRow[],
  key: string,
  days: readonly Day[],
): WindowValue {
  const wanted = new Set(days);
  const matching = rows.filter((row) => row.key === key && wanted.has(row.day));
  if (matching.length === 0) return EMPTY;
  const kind = getMetric(key)?.kind ?? "rate";
  const sample = matching.reduce((sum, row) => sum + row.sampleSize, 0);
  if (kind === "count") {
    const total = matching.reduce((sum, row) => sum + row.value, 0);
    return { value: total, sample, numerator: total, days: matching.length };
  }
  const numerator = matching.reduce((sum, row) => sum + row.value * row.sampleSize, 0);
  // Cada día es una unidad: sus éxitos (las «por mil» regresan a conteos) sobre su denominador.
  const scale = getMetric(key)?.format === "per1k" ? 1000 : 1;
  const dispersion = pearsonDispersion(
    matching.map((row) => ({ x: (row.value * row.sampleSize) / scale, n: row.sampleSize })),
    rateKind(key),
  );
  return {
    value: sample > 0 ? numerator / sample : null,
    sample,
    numerator,
    days: matching.length,
    dispersion,
  };
}

export function aggregateWindows(
  rows: readonly MetricRow[],
  keys: readonly string[],
  days: readonly Day[],
): Map<string, WindowValue> {
  return new Map(keys.map((key) => [key, aggregateWindow(rows, key, days)]));
}

/** Éxitos de una tasa para una prueba de proporciones (las «por mil» se regresan a conteos). */
export function successesOf(key: string, window: WindowValue): number {
  return getMetric(key)?.format === "per1k" ? window.numerator / 1000 : window.numerator;
}
