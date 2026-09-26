import type { Prisma } from "@/generated/prisma/client";
import { feedViewersInPeriod } from "@/modules/analytics/platform-aggregates";
import { revertSettingChange } from "@/modules/platform/apply";
import {
  addDays,
  type Day,
  dayEnd,
  dayRange,
  dayStart,
  isFrozenDay,
  mexicoDay,
} from "@/modules/platform/calendar";
import type { Client } from "@/modules/platform/client";
import { getTunable } from "@/modules/platform/tunables";
import { parseEvaluation, trailEntry, updateEvaluation } from "./decision-record";
import { stopStaleExperimentsOn } from "./experiments";
import {
  breachReason,
  evaluateGuardrails,
  guardrailMetrics,
  type Guardrails,
  guardrailsSchema,
  maxWatchDaysOf,
  noEvidenceNote,
  watchOutcome,
} from "./guardrails";
import { loadMetricRows } from "./metric-rows";
import { ASSUMED_ICC, designEffect } from "./stats";
import { windowClusterSize } from "./threshold";
import { aggregateWindow, aggregateWindows } from "./windows";

/**
 * Monitor de salvaguardas (plan-90-dias.md §2.4): después de CUALQUIER cambio aplicado (automático o
 * aprobado), compara la línea base (días completos antes del cambio) con lo observado después. Si una
 * salvaguarda se rompe tras la exposición mínima (pasa su umbral Y es significativa, ADR-037),
 * revierte SOLO: restaura el valor anterior, marca la decisión REVERTED y deja el motivo. Revertir es
 * seguro en cualquier modo de autonomía. La significancia toma en cuenta cuánto varían los días
 * entre sí (`WindowValue.dispersion`): antes contra después no cancela los días atípicos.
 *
 * Corre una vez al día con la operación diaria (las métricas son diarias: correrlo cada hora no
 * agregaría datos). Deja de vigilar cuando revierte, cuando pasan los días de vigilancia con todo
 * evaluado y sin daño («sin daño detectado») o, a lo más, al cumplirse la ventana máxima (28 días)
 * aunque falten datos («sin evidencia de daño con esta muestra»): nada se vigila para siempre.
 *
 * Congelamientos: los días del Buen Fin y del 12 al 25 de diciembre no entran en las comparaciones
 * relativas (la temporada las confunde); los límites absolutos (p. ej. 30 % de comercio) sí aplican.
 */

/** Exposición: impresiones visibles de personas con sesión (las anónimas no cuentan, ADR-037). */
const EXPOSURE_METRIC = "feed.impressions.visible";

export type MonitorSummary = {
  watched: number;
  reverted: number;
  pending: number;
  /** Cerradas sin daño detectado tras los días de vigilancia. */
  completed: number;
  /** Cerradas al cumplirse la ventana máxima sin datos suficientes: sin evidencia de daño. */
  closedWithoutEvidence: number;
};

export type WindowPlan = {
  baselineDays: Day[];
  /** Días observados comparables (sin congelamientos). */
  comparableDays: Day[];
  /** Todos los días observados (para los límites absolutos). */
  observedDays: Day[];
};

/**
 * Días de línea base y observados para un cambio aplicado el `appliedDay`, hasta `lastDay` (y a lo
 * más la ventana máxima de vigilancia).
 */
export function monitorWindows(
  appliedDay: Day,
  lastDay: Day,
  guardrails: Pick<Guardrails, "baselineDays" | "monitorDays" | "maxWatchDays">,
): WindowPlan {
  const baselineDays = dayRange(
    addDays(appliedDay, -guardrails.baselineDays),
    addDays(appliedDay, -1),
  ).filter((day) => !isFrozenDay(day));
  const lastObserved = [lastDay, addDays(appliedDay, maxWatchDaysOf(guardrails))].sort()[0]!;
  const observedDays =
    lastObserved > appliedDay ? dayRange(addDays(appliedDay, 1), lastObserved) : [];
  return {
    baselineDays,
    comparableDays: observedDays.filter((day) => !isFrozenDay(day)),
    observedDays,
  };
}

export async function runGuardrailMonitor(
  client: Client,
  now: Date = new Date(),
): Promise<MonitorSummary> {
  const lastDay = addDays(mexicoDay(now), -1);
  const summary: MonitorSummary = {
    watched: 0,
    reverted: 0,
    pending: 0,
    completed: 0,
    closedWithoutEvidence: 0,
  };
  const decisions = await client.platformDecision.findMany({
    where: { status: "APPLIED", appliedAt: { not: null } },
    select: {
      id: true,
      settingKey: true,
      appliedAt: true,
      guardrails: true,
      evaluation: true,
    },
    orderBy: { appliedAt: "asc" },
  });

  for (const decision of decisions) {
    const tunable = getTunable(decision.settingKey);
    const parsed = guardrailsSchema.safeParse(decision.guardrails);
    if (!tunable || !parsed.success || !decision.appliedAt) continue;
    const guardrails = parsed.data;
    const appliedDay = mexicoDay(decision.appliedAt);
    if (isFinal(decision.evaluation)) continue;
    summary.watched++;

    const windows = monitorWindows(appliedDay, lastDay, guardrails);
    const metrics = [...guardrailMetrics(guardrails), EXPOSURE_METRIC, tunable.primaryMetric];
    const rows = await loadMetricRows(
      client,
      metrics,
      windows.baselineDays[0] ?? appliedDay,
      windows.observedDays.at(-1) ?? appliedDay,
    );
    const evaluation = evaluateGuardrails(guardrails, {
      baseline: aggregateWindows(rows, metrics, windows.baselineDays),
      comparable: aggregateWindows(rows, metrics, windows.comparableDays),
      absolute: aggregateWindows(rows, metrics, windows.observedDays),
      exposure: aggregateWindow(rows, EXPOSURE_METRIC, windows.observedDays).value ?? 0,
      // El de cada ventana tal como se compara: los días comparables (sin congelamientos) para las
      // relativas y todos los observados para los límites absolutos.
      designEffect: {
        baseline: await windowDesignEffect(client, windows.baselineDays),
        comparable: await windowDesignEffect(client, windows.comparableDays),
        absolute: await windowDesignEffect(client, windows.observedDays),
      },
    });
    const measuredImpact = impactOf(rows, tunable.primaryMetric, windows);
    const outcome = watchOutcome(evaluation, windows.observedDays.length, guardrails);

    if (outcome === "revert") {
      const reason = breachReason(evaluation);
      const result = await revertSettingChange(client, {
        decisionId: decision.id,
        actor: "SYSTEM",
        reason,
        now,
        trail: (current) =>
          updateEvaluation(current, {
            guardrails: { ...evaluation, final: true },
            trail: [trailEntry("auto_reverted", "SYSTEM", now, { note: reason })],
          }),
      });
      if (result.ok) {
        summary.reverted++;
        await client.platformDecision.update({
          where: { id: decision.id },
          data: { measuredImpact },
        });
        await stopStaleExperimentsOn(client, decision.settingKey, { actor: "SYSTEM", now });
        continue;
      }
      // Alguien cambió el ajuste después: se deja constancia y no se pisa el cambio más reciente.
      await client.platformDecision.update({
        where: { id: decision.id },
        data: {
          measuredImpact,
          // Se deja de vigilar: la decisión más reciente sobre el ajuste tiene su propio monitor.
          evaluation: updateEvaluation(decision.evaluation, {
            guardrails: { ...evaluation, final: true },
            trail: [
              trailEntry("held", "SYSTEM", now, {
                note: `Salvaguarda rota, pero no se revirtió: ${result.message}`,
              }),
            ],
          }),
        },
      });
      continue;
    }

    if (evaluation.status === "pending") summary.pending++;
    const final = outcome === "no_harm" || outcome === "no_evidence";
    if (outcome === "no_harm") summary.completed++;
    if (outcome === "no_evidence") summary.closedWithoutEvidence++;
    const days = windows.observedDays.length;
    await client.platformDecision.update({
      where: { id: decision.id },
      data: {
        measuredImpact,
        evaluation: updateEvaluation(decision.evaluation, {
          guardrails: final ? { ...evaluation, final, conclusion: outcome } : evaluation,
          trail: final
            ? [
                trailEntry("monitor_closed", "SYSTEM", now, {
                  note:
                    outcome === "no_harm"
                      ? `Vigilancia terminada tras ${days} días: ninguna salvaguarda empeoró de forma significativa.`
                      : noEvidenceNote(evaluation, days),
                }),
              ]
            : [],
        }),
      },
    });
  }
  return summary;
}

/**
 * Efecto de diseño de una ventana de días (1 + (m − 1)·ρ, ρ = 0.05), con m = impresiones visibles
 * con persona ÷ personas distintas en TODA la ventana, como el analista. Sin días o sin personas
 * suficientes, el supuesto del plan (m = 20).
 */
async function windowDesignEffect(client: Client, days: readonly Day[]): Promise<number> {
  const first = days[0];
  const last = days.at(-1);
  const period =
    first && last
      ? await feedViewersInPeriod(client, dayStart(first), dayEnd(last))
      : { viewers: 0, personalImpressions: 0 };
  return designEffect(windowClusterSize(period).m, ASSUMED_ICC);
}

/** ¿La vigilancia de esta decisión ya terminó (revertida o completada sin problemas)? */
function isFinal(evaluation: unknown): boolean {
  const guardrails = parseEvaluation(evaluation).guardrails as { final?: unknown } | undefined;
  return guardrails?.final === true;
}

/** Impacto medido en la métrica principal: línea base contra lo observado (días comparables). */
function impactOf(
  rows: Parameters<typeof aggregateWindow>[0],
  metric: string,
  windows: WindowPlan,
): Prisma.InputJsonValue {
  const baseline = aggregateWindow(rows, metric, windows.baselineDays);
  const observed = aggregateWindow(rows, metric, windows.comparableDays);
  const change =
    baseline.value && observed.value !== null ? observed.value / baseline.value - 1 : null;
  return {
    metric,
    baseline: baseline.value,
    observed: observed.value,
    relativeChange: change,
    baselineSample: baseline.sample,
    observedSample: observed.sample,
    observedDays: windows.observedDays.length,
  };
}
