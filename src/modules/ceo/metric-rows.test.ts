import { describe, expect, it } from "vitest";
import {
  FEED_IMPRESSIONS_ARE_VISIBLE,
  VISIBLE_IMPRESSIONS_SINCE,
} from "@/modules/analytics/platform-aggregates";
import { addDays, dayRange } from "@/modules/platform/calendar";
import { DEFAULT_GUARDRAILS, guardrailMetrics } from "./guardrails";
import { getMetric } from "./metric-catalog";
import { isComparableRow, personalImpressionsSeries } from "./metric-rows";
import { assessTrafficThreshold } from "./threshold";
import type { MetricRow } from "./windows";

/** Impresiones con persona por día (20 por persona), como las escribe la tarea diaria. */
function perViewerRows(days: string[], perDay: number): MetricRow[] {
  return days.map((day) => ({
    day,
    key: "feed.impressions.per_viewer",
    value: 20,
    sampleSize: perDay / 20,
  }));
}

describe("impresiones visibles (T5) en las métricas del motor", () => {
  it("el umbral de tráfico ya se mide en impresiones visibles", () => {
    expect(FEED_IMPRESSIONS_ARE_VISIBLE).toBe(true);
    expect(getMetric("feed.impressions.visible")?.definition).toMatch(/visibles/);
    // La pieza servida sigue como métrica aparte, sin decidir nada.
    expect(getMetric("feed.impressions.served")?.definition).toMatch(/ninguna decisión/);
  });

  it("las filas por impresión de antes de las visibles (piezas servidas) no se comparan", () => {
    const before = addDays(VISIBLE_IMPRESSIONS_SINCE, -1);
    expect(isComparableRow({ day: before, key: "feed.commerce.ctr" })).toBe(false);
    expect(isComparableRow({ day: before, key: "feed.impressions.visible" })).toBe(false);
    expect(isComparableRow({ day: VISIBLE_IMPRESSIONS_SINCE, key: "feed.commerce.ctr" })).toBe(
      true,
    );
    // Lo que no depende de la impresión se conserva.
    expect(isComparableRow({ day: before, key: "sellers.active" })).toBe(true);
    expect(isComparableRow({ day: before, key: "feed.impressions.served" })).toBe(true);
  });

  it("el tráfico SERVIDO de antes no cumple el umbral: hacen falta dos semanas de visibles", () => {
    const lastDay = addDays(VISIBLE_IMPRESSIONS_SINCE, 6);
    const days = dayRange(addDays(lastDay, -13), lastDay);
    const rows = perViewerRows(days, 60_000).filter(isComparableRow);
    const partial = assessTrafficThreshold({
      lastDay,
      dailyImpressions: personalImpressionsSeries(rows),
      minSamplePerVariant: 41_000,
      impressionsVisible: FEED_IMPRESSIONS_ARE_VISIBLE,
    });
    expect(partial).toMatchObject({ met: false, previousWeek: 0 });
    expect(partial.reason).toMatch(/^Tráfico insuficiente/);

    const later = addDays(VISIBLE_IMPRESSIONS_SINCE, 13);
    const visibleOnly = perViewerRows(dayRange(VISIBLE_IMPRESSIONS_SINCE, later), 6_000);
    const met = assessTrafficThreshold({
      lastDay: later,
      dailyImpressions: personalImpressionsSeries(visibleOnly.filter(isComparableRow)),
      minSamplePerVariant: 41_000,
      impressionsVisible: FEED_IMPRESSIONS_ARE_VISIBLE,
    });
    expect(met.met).toBe(true);
  });
});

describe("solo personas con sesión deciden (un robot sin cuenta no fuerza ni esconde una reversión)", () => {
  it("las visibles anónimas son una métrica aparte, descriptiva", () => {
    const anonymous = getMetric("feed.impressions.visible.anonymous");
    expect(anonymous).toMatchObject({ kind: "count", better: null });
    expect(anonymous?.definition).toMatch(/ninguna decisión/);
    expect(getMetric("feed.impressions.visible")?.definition).toMatch(/personas con sesión/);
  });

  it("ninguna salvaguarda usa una métrica que incluya tráfico anónimo", () => {
    const descriptive = [
      "feed.impressions.visible.anonymous",
      "feed.impressions.served",
      "product.visits",
      "not_interested.count",
    ];
    for (const metric of guardrailMetrics(DEFAULT_GUARDRAILS)) {
      expect(descriptive).not.toContain(metric);
      if (metric === "errors.5xx.rate") continue;
      expect(getMetric(metric)?.definition, metric).toMatch(/con sesión/);
    }
  });

  it("las filas redefinidas de antes del corte no se comparan", () => {
    const before = addDays(VISIBLE_IMPRESSIONS_SINCE, -1);
    for (const key of [
      "product.visits.per_active_seller",
      "feed.product_visits",
      "feed.impressions.visible.anonymous",
    ]) {
      expect(isComparableRow({ day: before, key })).toBe(false);
      expect(isComparableRow({ day: VISIBLE_IMPRESSIONS_SINCE, key })).toBe(true);
    }
    expect(isComparableRow({ day: before, key: "product.visits" })).toBe(true);
  });
});
