import { VISIBLE_IMPRESSIONS_SINCE } from "@/modules/analytics/platform-aggregates";
import { type Day, dayToDbDate, dbDateToDay } from "@/modules/platform/calendar";
import type { Client } from "@/modules/platform/client";
import { VISIBLE_IMPRESSION_METRICS } from "./metric-catalog";
import type { MetricRow } from "./windows";

/**
 * ¿La fila se puede comparar con las demás? Las métricas por impresión de días anteriores a T5
 * contaban piezas SERVIDAS (varias veces más que las visibles): mezclarlas inventaría cambios.
 */
export function isComparableRow(row: Pick<MetricRow, "day" | "key">): boolean {
  return !(VISIBLE_IMPRESSION_METRICS.has(row.key) && row.day < VISIBLE_IMPRESSIONS_SINCE);
}

/**
 * Filas de `DailyMetric` de las llaves pedidas entre dos días (ambos incluidos), sin las filas por
 * impresión de antes de las impresiones visibles (`isComparableRow`).
 */
export async function loadMetricRows(
  client: Client,
  keys: readonly string[],
  from: Day,
  to: Day,
  dimension = "",
): Promise<MetricRow[]> {
  const rows = await client.dailyMetric.findMany({
    where: {
      key: { in: [...keys] },
      dimension,
      day: { gte: dayToDbDate(from), lte: dayToDbDate(to) },
    },
    select: { day: true, key: true, value: true, sampleSize: true },
    orderBy: { day: "asc" },
  });
  return rows
    .map((row) => ({
      day: dbDateToDay(row.day),
      key: row.key,
      value: row.value,
      sampleSize: row.sampleSize,
    }))
    .filter(isComparableRow);
}

/** Valor por día de una métrica de conteo. */
export function dailySeries(rows: readonly MetricRow[], key: string): Map<Day, number> {
  return new Map(rows.filter((row) => row.key === key).map((row) => [row.day, row.value]));
}

/**
 * Impresiones VISIBLES CON PERSONA por día (numerador de `feed.impressions.per_viewer`, igual a
 * `feed.impressions.visible` desde que esta cuenta solo a personas con sesión). Es la unidad del
 * umbral de tráfico: solo quien tiene sesión se asigna a un experimento (el tráfico anónimo, incluidos
 * robots y pruebas automatizadas sin cuenta, nunca cuenta para decidir).
 */
export function personalImpressionsSeries(rows: readonly MetricRow[]): Map<Day, number> {
  return new Map(
    rows
      .filter((row) => row.key === "feed.impressions.per_viewer")
      .map((row) => [row.day, Math.round(row.value * row.sampleSize)]),
  );
}
