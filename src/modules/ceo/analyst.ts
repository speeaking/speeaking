import type { Prisma } from "@/generated/prisma/client";
import {
  FEED_IMPRESSIONS_ARE_VISIBLE,
  feedViewersInPeriod,
} from "@/modules/analytics/platform-aggregates";
import { applySettingChange, readAutonomy, readFeedPolicySetting } from "@/modules/platform/apply";
import {
  addDays,
  type Day,
  dayEnd,
  dayRange,
  dayStart,
  freezePeriodFor,
  isFrozenDay,
  mexicoDay,
} from "@/modules/platform/calendar";
import type { Client } from "@/modules/platform/client";
import { getTunable, type Tunable } from "@/modules/platform/tunables";
import { decideAutomaticAction } from "./autonomy-policy";
import { trailEntry, updateEvaluation } from "./decision-record";
import { type ProposalCandidate, runDetectors } from "./detectors";
import { launchExperimentFromDecision, minSampleForTunable } from "./experiments";
import { DEFAULT_GUARDRAILS } from "./guardrails";
import { loadMetricRows, personalImpressionsSeries } from "./metric-rows";
import { type Narrator, writeNarrative } from "./narrative";
import { ASSUMED_ICC, designEffect } from "./stats";
import { assessTrafficThreshold, type ThresholdAssessment, windowClusterSize } from "./threshold";
import { aggregateWindows } from "./windows";

/**
 * Analista diario (IA CEO): lee SOLO agregados (`DailyMetric` y el conteo de personas distintas por
 * ventana para el efecto de diseño; nunca texto de personas), corre los detectores deterministas y
 * registra cada propuesta en `PlatformDecision` con hipótesis, ajuste, valores, riesgo (del catálogo),
 * salvaguardas e impacto esperado. Después decide con `decideAutomaticAction` si se aplica sola, se
 * prueba o se queda propuesta. Idempotente por día: correrlo dos veces no duplica propuestas.
 */

export const RECENT_DAYS = 7;
export const BASELINE_DAYS = 28;
/** Días tras un cambio aplicado o revertido en los que el ajuste no se vuelve a mover solo. */
export const COOLDOWN_DAYS = 7;
/** Días en que no se vuelve a proponer lo que el equipo acaba de aprobar o rechazar. */
export const DECIDED_QUIET_DAYS = 7;
/** Días en que no se vuelve a proponer un ajuste revertido o ya probado en un experimento. */
export const RETRY_AFTER_DAYS = 28;

const ANALYST_METRICS = [
  "feed.impressions.visible",
  "feed.impressions.per_viewer",
  "feed.commerce.ctr",
  "feed.commerce.share",
  "feed.engagement.rate",
  "not_interested.per_1k_impressions",
  "reports.per_1k_impressions",
];

export type AnalystSummary = {
  day: Day;
  candidates: number;
  proposed: number;
  applied: number;
  experiments: number;
  held: number;
  skipped: number;
};

export type AnalystOptions = {
  now?: Date;
  /** Redacción opcional con IA (solo texto; las cifras las pone el código). */
  narrate?: Narrator;
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Motivo por el que no se puede mover el ajuste ahora (experimento en curso o enfriamiento). */
async function conflictFor(client: Client, tunable: Tunable, now: Date): Promise<string | null> {
  const running = await client.experiment.findFirst({
    where: { status: "RUNNING", settingKey: { startsWith: `${tunable.setting}.` } },
    select: { key: true },
  });
  if (running) return `Hay un experimento en curso sobre este ajuste (${running.key}).`;
  const since = new Date(now.getTime() - COOLDOWN_DAYS * 86_400_000);
  const recent = await client.platformDecision.findFirst({
    where: {
      settingKey: tunable.key,
      OR: [{ appliedAt: { gte: since } }, { revertedAt: { gte: since } }],
    },
    select: { id: true },
  });
  return recent ? `Enfriamiento: este ajuste cambió hace menos de ${COOLDOWN_DAYS} días.` : null;
}

/**
 * ¿Ya hay una propuesta abierta sobre lo mismo (o esta ya se registró hoy), o se acaba de decidir o
 * probar? Sin esto, una señal que sigue en la ventana móvil repropondría cada día lo que el equipo
 * rechazó, y lo revertido por una salvaguarda o descartado por un experimento volvería a aplicarse o
 * probarse en cuanto pasara el enfriamiento (aplicar → revertir → aplicar).
 */
async function isDuplicate(client: Client, candidate: ProposalCandidate, day: Day, now: Date) {
  const kind = `analyst.${candidate.detector}`;
  const sameDay = await client.platformDecision.findFirst({
    where: { kind, evaluation: { path: ["analysis", "day"], equals: day } },
    select: { id: true },
  });
  if (sameDay) return true;
  const decidedSince = new Date(now.getTime() - DECIDED_QUIET_DAYS * 86_400_000);
  const triedSince = new Date(now.getTime() - RETRY_AFTER_DAYS * 86_400_000);
  const blocking = await client.platformDecision.findFirst({
    where: candidate.settingKey
      ? {
          settingKey: candidate.settingKey,
          OR: [
            { status: "PROPOSED" },
            {
              status: "APPROVED",
              launchedExperiment: { is: { status: { in: ["DRAFT", "RUNNING"] } } },
            },
            { status: { in: ["APPROVED", "REJECTED"] }, decidedAt: { gte: decidedSince } },
            { status: "REVERTED", revertedAt: { gte: triedSince } },
          ],
        }
      : {
          kind,
          OR: [
            { status: "PROPOSED" },
            { status: { in: ["APPROVED", "REJECTED"] }, decidedAt: { gte: decidedSince } },
          ],
        },
    select: { id: true },
  });
  if (blocking) return true;
  if (!candidate.settingKey) return false;
  const recentExperiment = await client.experiment.findFirst({
    where: {
      settingKey: candidate.settingKey,
      status: { in: ["STOPPED", "CONCLUDED"] },
      endedAt: { gte: triedSince },
    },
    select: { id: true },
  });
  return recentExperiment !== null;
}

export async function runAnalyst(
  client: Client,
  day: Day,
  options: AnalystOptions = {},
): Promise<AnalystSummary> {
  const now = options.now ?? new Date();
  const summary: AnalystSummary = {
    day,
    candidates: 0,
    proposed: 0,
    applied: 0,
    experiments: 0,
    held: 0,
    skipped: 0,
  };
  const recentDays = dayRange(addDays(day, -(RECENT_DAYS - 1)), day).filter((d) => !isFrozenDay(d));
  const baselineDays = dayRange(
    addDays(day, -(RECENT_DAYS + BASELINE_DAYS - 1)),
    addDays(day, -RECENT_DAYS),
  ).filter((d) => !isFrozenDay(d));
  const rows = await loadMetricRows(
    client,
    ANALYST_METRICS,
    addDays(day, -(RECENT_DAYS + BASELINE_DAYS - 1)),
    day,
  );
  const recent = aggregateWindows(rows, ANALYST_METRICS, recentDays);
  const baseline = aggregateWindows(rows, ANALYST_METRICS, baselineDays);
  // Efecto de diseño por ventana: lo que junta UNA persona en los 7 (o 28) días, no en un día.
  const recentPeople = await feedViewersInPeriod(
    client,
    dayStart(addDays(day, -(RECENT_DAYS - 1))),
    dayEnd(day),
  );
  const baselinePeople = await feedViewersInPeriod(
    client,
    dayStart(addDays(day, -(RECENT_DAYS + BASELINE_DAYS - 1))),
    dayStart(addDays(day, -(RECENT_DAYS - 1))),
  );
  const { policy } = await readFeedPolicySetting(client);

  const candidates = runDetectors({
    day,
    recent,
    baseline,
    policy,
    designEffect: designEffect(windowClusterSize(recentPeople).m, ASSUMED_ICC),
    baselineDesignEffect: designEffect(windowClusterSize(baselinePeople).m, ASSUMED_ICC),
  });
  summary.candidates = candidates.length;
  if (candidates.length === 0) return summary;

  const mode = await readAutonomy(client);
  const freeze = freezePeriodFor(mexicoDay(now));
  const dailyImpressions = personalImpressionsSeries(rows);

  for (const candidate of candidates) {
    if (await isDuplicate(client, candidate, day, now)) {
      summary.skipped++;
      continue;
    }
    const tunable = getTunable(candidate.settingKey);
    let threshold: ThresholdAssessment | null = null;
    if (tunable) {
      const assumptions = await minSampleForTunable(client, tunable, day);
      threshold = assessTrafficThreshold({
        lastDay: day,
        dailyImpressions,
        minSamplePerVariant: assumptions.minSamplePerVariant,
        impressionsVisible: FEED_IMPRESSIONS_ARE_VISIBLE,
      });
    }
    const narrative = await writeNarrative(
      {
        title: candidate.title,
        hypothesis: candidate.hypothesis,
        expectedImpact: candidate.expectedImpact,
        numbers: Object.fromEntries(
          Object.entries(candidate.facts).filter(
            (entry): entry is [string, number] => typeof entry[1] === "number",
          ),
        ),
      },
      options.narrate,
    );
    const created = await client.platformDecision.create({
      data: {
        actor: "AI",
        kind: `analyst.${candidate.detector}`,
        title: candidate.title.slice(0, 200),
        hypothesis: candidate.hypothesis,
        settingKey: candidate.settingKey,
        previousValue: candidate.previousValue ?? undefined,
        newValue: candidate.newValue ?? undefined,
        riskLevel: candidate.risk,
        status: "PROPOSED",
        expectedImpact: candidate.expectedImpact,
        guardrails: candidate.settingKey ? toJson(DEFAULT_GUARDRAILS) : undefined,
        evaluation: toJson({
          analysis: { day, detector: candidate.detector, facts: candidate.facts },
          narrative,
          ...(threshold ? { threshold } : {}),
          trail: [trailEntry("proposed", "AI", now)],
        }),
      },
      select: { id: true, evaluation: true },
    });
    summary.proposed++;

    const conflict = tunable ? await conflictFor(client, tunable, now) : null;
    const decision = decideAutomaticAction({
      risk: candidate.risk,
      mode,
      freeze,
      thresholdMet: threshold?.met ?? false,
      enoughTraffic: threshold?.enoughTraffic ?? false,
      conflict,
    });

    if (decision.action === "apply") {
      const result = await applySettingChange(client, {
        decisionId: created.id,
        actor: "SYSTEM",
        auto: true,
        reason: decision.reason,
        now,
        trail: (current) =>
          updateEvaluation(current, {
            trail: [trailEntry("auto_applied", "SYSTEM", now, { note: decision.reason })],
          }),
      });
      if (result.ok) {
        summary.applied++;
        continue;
      }
      await hold(client, created.id, created.evaluation, result.message, now);
      summary.held++;
      continue;
    }
    if (decision.action === "experiment") {
      const result = await launchExperimentFromDecision(client, {
        decisionId: created.id,
        actor: "SYSTEM",
        allocation: decision.allocation,
        reason: decision.reason,
        now,
      });
      if (result.ok) {
        summary.experiments++;
        continue;
      }
      await hold(client, created.id, created.evaluation, result.message, now);
      summary.held++;
      continue;
    }
    await hold(client, created.id, created.evaluation, decision.reason, now);
    summary.held++;
  }
  return summary;
}

async function hold(client: Client, id: string, evaluation: unknown, reason: string, now: Date) {
  await client.platformDecision.update({
    where: { id },
    data: {
      reason: reason.slice(0, 900),
      evaluation: updateEvaluation(evaluation, {
        trail: [trailEntry("held", "SYSTEM", now, { note: reason })],
      }),
    },
  });
}
