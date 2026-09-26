import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/generated/prisma/enums";
import {
  feedViewersInPeriod,
  type PersonFeedActivity,
  personFeedActivity,
} from "@/modules/analytics/platform-aggregates";
import { readFeedPolicySetting } from "@/modules/platform/apply";
import { addDays, type Day, dayEnd, dayStart, mexicoDay } from "@/modules/platform/calendar";
import { type Client, inTransaction, lockName } from "@/modules/platform/client";
import {
  assignVariant,
  experimentVariantsSchema,
  type Variant,
} from "@/modules/platform/experiments";
import {
  checkChange,
  classifyRisk,
  formatTunableValue,
  getTunable,
  isForbiddenSetting,
  type PrimaryMetricKey,
  readTunable,
  type Tunable,
} from "@/modules/platform/tunables";
import { trailEntry, updateEvaluation } from "./decision-record";
import {
  DEFAULT_GUARDRAILS,
  evaluateGuardrails,
  type GuardrailEvaluation,
  guardrailsSchema,
} from "./guardrails";
import { formatMetricValue, getMetric } from "./metric-catalog";
import { loadMetricRows } from "./metric-rows";
import { sumByVariant } from "./metrics";
import {
  ASSUMED_ICC,
  type Cluster,
  type ClusteredComparison,
  compareClusteredRatios,
  DEFAULT_ALPHA,
  designEffect,
  pearsonDispersion,
} from "./stats";
import {
  minSampleFor,
  type SampleAssumptions,
  THRESHOLD_WINDOW_DAYS,
  windowClusterSize,
} from "./threshold";
import { aggregateWindow, rateKind, type WindowValue } from "./windows";

/**
 * Experimentos A/B sobre parámetros del catálogo (plan-90-dias.md §2.4). Asignación estable por
 * persona (`platform/experiments.ts`), análisis por persona con errores robustos por clúster y el
 * efecto de diseño, y salvaguardas entre variantes (concurrentes: la temporada afecta igual a ambas).
 * Al concluir se PROPONE adoptar (requiere aprobación humana) o se registra el descarte.
 */

export const EXPERIMENT_MAX_DAYS = 42;
const BASELINE_DAYS_FOR_SAMPLE = 28;

export type ExperimentVerdict =
  | "running"
  | "adopt"
  | "discard"
  | "inconclusive"
  | "stopped_guardrail"
  | "stopped_manual"
  | "stopped_stale";

export type ExperimentResult = {
  computedAt: string;
  window: { start: string; end: string };
  primaryMetric: string;
  minSamplePerVariant: number;
  variants: Record<
    Variant,
    { people: number; impressions: number; primary: { x: number; n: number; value: number | null } }
  >;
  comparison: {
    relativeChange: number | null;
    difference: number;
    ci95: [number, number];
    pValue: number;
    z: number;
    designEffect: number;
    icc: number;
  } | null;
  guardrails: GuardrailEvaluation;
  verdict: ExperimentVerdict;
  summary: string;
};

export type ExperimentActionResult =
  { ok: true; experimentId: string } | { ok: false; message: string };

/** Numerador y denominador por persona de la métrica principal. */
function primaryCluster(metric: string, person: PersonFeedActivity): Cluster {
  switch (metric as PrimaryMetricKey | "feed.commerce.ctr") {
    case "feed.commerce.ctr":
      return { x: person.productVisitsFromFeed, n: person.commerceImpressions };
    case "feed.engagement.rate":
      return { x: person.engagements, n: person.impressions };
    default:
      return { x: person.productVisitsFromFeed, n: person.impressions };
  }
}

function windowOf(numerator: number, denominator: number, scale = 1): WindowValue {
  return {
    value: denominator > 0 ? (scale * numerator) / denominator : null,
    sample: denominator,
    numerator: scale * numerator,
    days: 1,
  };
}

/** Numerador y denominador por persona de cada salvaguarda (la persona es la unidad asignada). */
const GUARDRAIL_UNITS: Record<string, (person: PersonFeedActivity) => Cluster> = {
  "reports.per_1k_impressions": (person) => ({ x: person.reports, n: person.impressions }),
  "not_interested.per_1k_impressions": (person) => ({
    x: person.notInterested,
    n: person.impressions,
  }),
  "feed.commerce.share": (person) => ({ x: person.commerceImpressions, n: person.impressions }),
  "feed.commerce.ctr": (person) => ({
    x: person.productVisitsFromFeed,
    n: person.commerceImpressions,
  }),
  "feed.product_visits.rate": (person) => ({
    x: person.productVisitsFromFeed,
    n: person.impressions,
  }),
  "product.visits.per_active_seller": (person) => ({ x: person.productVisitsFromFeed, n: 1 }),
};

/**
 * Salvaguardas por variante. «Visitas por vendedor activo» no se puede partir por persona (los
 * vendedores son los mismos en ambas variantes): en un experimento se vigila su equivalente, las
 * visitas a producto desde el feed POR PERSONA de cada variante (la unidad que se asigna). Cada
 * ventana lleva cuánto varían sus personas (`pearsonDispersion`): una sola cuenta con muchos
 * reportes o «No me interesa» infla la varianza de su variante en vez de detener el experimento.
 */
function variantWindows(
  counts: ReturnType<typeof sumByVariant>[Variant],
  people: readonly PersonFeedActivity[],
) {
  const windows: [string, WindowValue][] = [
    ["reports.per_1k_impressions", windowOf(counts.reports, counts.impressions, 1000)],
    ["not_interested.per_1k_impressions", windowOf(counts.notInterested, counts.impressions, 1000)],
    ["feed.commerce.share", windowOf(counts.commerceImpressions, counts.impressions)],
    ["feed.commerce.ctr", windowOf(counts.productVisitsFromFeed, counts.commerceImpressions)],
    ["feed.product_visits.rate", windowOf(counts.productVisitsFromFeed, counts.impressions)],
    ["product.visits.per_active_seller", windowOf(counts.productVisitsFromFeed, counts.viewers)],
  ];
  return new Map<string, WindowValue>(
    windows.map(([metric, window]) => {
      const unit = GUARDRAIL_UNITS[metric];
      const dispersion = unit ? pearsonDispersion(people.map(unit), rateKind(metric)) : null;
      return [metric, { ...window, dispersion }];
    }),
  );
}

/**
 * Efecto de diseño de una variante (1 + (m − 1)·ρ, ρ = 0.05) con m = impresiones por persona de esa
 * variante, como el analista; sin personas suficientes, el supuesto del plan.
 */
function variantDesignEffect(counts: ReturnType<typeof sumByVariant>[Variant]) {
  const m = windowClusterSize({
    viewers: counts.viewers,
    personalImpressions: counts.impressions,
  }).m;
  return designEffect(m, ASSUMED_ICC);
}

const percent = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("es-MX");

/** Evaluación pura de un experimento a partir de la actividad por persona. */
export function evaluateExperimentData(input: {
  experiment: {
    key: string;
    allocation: number;
    primaryMetric: string;
    minSamplePerVariant: number;
    guardrails: unknown;
    startedAt: Date;
  };
  people: readonly PersonFeedActivity[];
  end: Date;
  now: Date;
}): ExperimentResult {
  const { experiment } = input;
  const guardrails = guardrailsSchema.safeParse(experiment.guardrails).data ?? DEFAULT_GUARDRAILS;
  const clusters: Record<Variant, Cluster[]> = { control: [], treatment: [] };
  const peopleByVariant: Record<Variant, PersonFeedActivity[]> = { control: [], treatment: [] };
  for (const person of input.people) {
    const variant = assignVariant(experiment.key, person.userId, experiment.allocation);
    clusters[variant].push(primaryCluster(experiment.primaryMetric, person));
    peopleByVariant[variant].push(person);
  }
  const totals = sumByVariant(input.people, experiment);
  const comparison: ClusteredComparison | null = compareClusteredRatios(
    clusters.control,
    clusters.treatment,
  );
  const guardrailEvaluation = evaluateGuardrails(
    {
      ...guardrails,
      minExposureImpressions: Math.min(
        guardrails.minExposureImpressions,
        experiment.minSamplePerVariant,
      ),
    },
    {
      baseline: variantWindows(totals.control, peopleByVariant.control),
      comparable: variantWindows(totals.treatment, peopleByVariant.treatment),
      exposure: Math.min(totals.control.impressions, totals.treatment.impressions),
      designEffect: {
        baseline: variantDesignEffect(totals.control),
        comparable: variantDesignEffect(totals.treatment),
      },
    },
  );

  const variantSummary = (variant: Variant) => {
    const x = clusters[variant].reduce((sum, cluster) => sum + cluster.x, 0);
    const n = clusters[variant].reduce((sum, cluster) => sum + cluster.n, 0);
    return {
      people: totals[variant].viewers,
      impressions: totals[variant].impressions,
      primary: { x, n, value: n > 0 ? x / n : null },
    };
  };
  const enough =
    totals.control.impressions >= experiment.minSamplePerVariant &&
    totals.treatment.impressions >= experiment.minSamplePerVariant;
  const ageDays = (input.now.getTime() - experiment.startedAt.getTime()) / 86_400_000;
  const label = getMetric(experiment.primaryMetric)?.label ?? experiment.primaryMetric;

  let verdict: ExperimentVerdict = "running";
  let summary = `En curso: ${integer.format(Math.min(totals.control.impressions, totals.treatment.impressions))} de ${integer.format(experiment.minSamplePerVariant)} impresiones en la variante más chica.`;
  if (guardrailEvaluation.status === "breached") {
    verdict = "stopped_guardrail";
    summary = "Una salvaguarda se rompió en el tratamiento: se detiene y todos vuelven al control.";
  } else if (enough && comparison) {
    const lift = comparison.relativeChange ?? 0;
    if (comparison.pValue < DEFAULT_ALPHA && comparison.difference > 0) {
      verdict = "adopt";
      summary = `${label}: +${percent.format(lift * 100)} % en el tratamiento (p = ${comparison.pValue.toFixed(4)}). Se propone adoptarlo; requiere tu aprobación.`;
    } else {
      verdict = "discard";
      summary = `${label}: sin mejora significativa (${lift >= 0 ? "+" : "−"}${percent.format(Math.abs(lift) * 100)} %, p = ${comparison.pValue.toFixed(4)}). Se mantiene el valor actual.`;
    }
  } else if (ageDays > EXPERIMENT_MAX_DAYS) {
    verdict = "inconclusive";
    summary = `No concluyente: en ${EXPERIMENT_MAX_DAYS} días no se alcanzó la muestra mínima (${integer.format(experiment.minSamplePerVariant)} impresiones por variante).`;
  }

  return {
    computedAt: input.now.toISOString(),
    window: { start: experiment.startedAt.toISOString(), end: input.end.toISOString() },
    primaryMetric: experiment.primaryMetric,
    minSamplePerVariant: experiment.minSamplePerVariant,
    variants: { control: variantSummary("control"), treatment: variantSummary("treatment") },
    comparison: comparison
      ? {
          relativeChange: comparison.relativeChange,
          difference: comparison.difference,
          ci95: comparison.ci95,
          pValue: comparison.pValue,
          z: comparison.z,
          designEffect: comparison.designEffect,
          icc: comparison.icc,
        }
      : null,
    guardrails: guardrailEvaluation,
    verdict,
    summary,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Personas e impresiones del feed en el horizonte de un experimento (los últimos 14 días hasta
 * `lastDay`): el tamaño de clúster del efecto de diseño es lo que junta una persona en todo el
 * experimento, no en un día.
 */
export function experimentHorizonViewers(client: Client, lastDay: Day) {
  return feedViewersInPeriod(
    client,
    dayStart(addDays(lastDay, -(THRESHOLD_WINDOW_DAYS - 1))),
    dayEnd(lastDay),
  );
}

/** Muestra mínima por variante para la métrica principal del parámetro, con lo medido si alcanza. */
export async function minSampleForTunable(
  client: Client,
  tunable: Tunable,
  lastDay: Day,
): Promise<SampleAssumptions> {
  const from = addDays(lastDay, -(BASELINE_DAYS_FOR_SAMPLE - 1));
  const rows = await loadMetricRows(client, [tunable.primaryMetric], from, lastDay);
  const days = [...new Set(rows.map((row) => row.day))];
  const primary = aggregateWindow(rows, tunable.primaryMetric, days);
  const horizon = await experimentHorizonViewers(client, lastDay);
  return minSampleFor({
    baselineRate: primary.value,
    baselineSample: primary.sample,
    impressionsPerPerson:
      horizon.viewers > 0 ? horizon.personalImpressions / horizon.viewers : null,
    viewers: horizon.viewers,
  });
}

function experimentKeyFor(tunable: Tunable, day: Day, decisionId: string) {
  return `${tunable.field}.${day}.${decisionId.replace(/-/g, "").slice(-10)}`;
}

/**
 * Lanza el experimento de una propuesta de riesgo MEDIO (al 10 % por omisión). Lo hace una persona
 * al aprobar o el sistema en modo `low_risk` tras el umbral. Adoptar el resultado es otra decisión.
 */
export async function launchExperimentFromDecision(
  client: Client,
  input: {
    decisionId: string;
    actor: Actor;
    userId?: string | null;
    allocation: number;
    reason: string;
    now?: Date;
  },
): Promise<ExperimentActionResult> {
  const now = input.now ?? new Date();
  const decision = await client.platformDecision.findUnique({
    where: { id: input.decisionId },
    select: {
      id: true,
      status: true,
      settingKey: true,
      riskLevel: true,
      hypothesis: true,
      previousValue: true,
      newValue: true,
      evaluation: true,
      experimentId: true,
      launchedExperiment: { select: { id: true } },
    },
  });
  if (!decision || decision.status !== "PROPOSED") {
    return { ok: false, message: "Esta decisión ya no está pendiente." };
  }
  const tunable = getTunable(decision.settingKey);
  if (!tunable || isForbiddenSetting(decision.settingKey ?? "")) {
    return { ok: false, message: "Ese ajuste no se puede probar desde aquí." };
  }
  if (classifyRisk(tunable.key) !== "MEDIUM" || decision.riskLevel !== "MEDIUM") {
    return {
      ok: false,
      message: "Solo las propuestas de riesgo medio se prueban como experimento.",
    };
  }
  if (decision.experimentId || decision.launchedExperiment) {
    return { ok: false, message: "Esta propuesta ya tiene un experimento." };
  }
  if (!(input.allocation > 0 && input.allocation <= 0.5)) {
    return { ok: false, message: "La fracción del tratamiento debe estar entre 0 y 50 %." };
  }
  const day = mexicoDay(now);
  const assumptions = await minSampleForTunable(client, tunable, addDays(day, -1));

  return inTransaction(client, async (tx) => {
    await lockName(tx, `platform.setting:${tunable.setting}`);
    const running = await tx.experiment.findFirst({
      where: { status: "RUNNING", settingKey: { startsWith: `${tunable.setting}.` } },
      select: { key: true },
    });
    if (running) {
      return {
        ok: false,
        message: `Ya hay un experimento en curso sobre este ajuste (${running.key}); espera a que termine o detenlo.`,
      } as const;
    }
    const { policy } = await readFeedPolicySetting(tx);
    const current = readTunable(policy, tunable);
    if (decision.previousValue !== current) {
      return {
        ok: false,
        message: `El valor cambió desde la propuesta (ahora es ${formatTunableValue(tunable, current)}).`,
      } as const;
    }
    const check = checkChange(tunable, current, decision.newValue);
    if (!check.ok) return { ok: false, message: check.reason } as const;

    const updated = await tx.platformDecision.updateMany({
      where: { id: decision.id, status: "PROPOSED" },
      data: {
        status: "APPROVED",
        decidedAt: now,
        approvedById: input.actor === "HUMAN" ? (input.userId ?? null) : null,
        reason: input.reason.slice(0, 900),
        evaluation: updateEvaluation(decision.evaluation, {
          trail: [
            trailEntry("experiment_started", input.actor, now, {
              userId: input.userId,
              note: `${percent.format(input.allocation * 100)} % al tratamiento; muestra mínima ${integer.format(assumptions.minSamplePerVariant)} impresiones por variante.`,
            }),
          ],
        }),
      },
    });
    if (updated.count !== 1)
      return { ok: false, message: "Esta decisión ya no está pendiente." } as const;
    const experiment = await tx.experiment.create({
      data: {
        key: experimentKeyFor(tunable, day, decision.id),
        settingKey: tunable.key,
        hypothesis: decision.hypothesis,
        status: "RUNNING",
        variants: { control: current, treatment: decision.newValue as number },
        allocation: input.allocation,
        minSamplePerVariant: assumptions.minSamplePerVariant,
        primaryMetric: tunable.primaryMetric,
        guardrails: toJson(DEFAULT_GUARDRAILS),
        startedAt: now,
        decisionId: decision.id,
        result: toJson({ assumptions }),
      },
      select: { id: true },
    });
    return { ok: true, experimentId: experiment.id } as const;
  });
}

/** Inicia un experimento en borrador (validado contra el catálogo y sin otro en curso). */
export async function startDraftExperiment(
  client: Client,
  input: { experimentId: string; now?: Date },
): Promise<ExperimentActionResult> {
  const now = input.now ?? new Date();
  const experiment = await client.experiment.findUnique({
    where: { id: input.experimentId },
    select: { id: true, status: true, settingKey: true, variants: true, allocation: true },
  });
  if (!experiment || experiment.status !== "DRAFT") {
    return { ok: false, message: "Solo se inicia un experimento en borrador." };
  }
  const tunable = getTunable(experiment.settingKey);
  const variants = experimentVariantsSchema.safeParse(experiment.variants);
  if (!tunable || !variants.success) {
    return { ok: false, message: "El experimento no corresponde a un ajuste del catálogo." };
  }
  if (experiment.allocation > 0.5) {
    return { ok: false, message: "La fracción del tratamiento no puede pasar de 50 %." };
  }
  return inTransaction(client, async (tx) => {
    await lockName(tx, `platform.setting:${tunable.setting}`);
    const running = await tx.experiment.findFirst({
      where: { status: "RUNNING", settingKey: { startsWith: `${tunable.setting}.` } },
      select: { key: true },
    });
    if (running) {
      return {
        ok: false,
        message: `Ya hay un experimento en curso sobre este ajuste (${running.key}).`,
      } as const;
    }
    const { policy } = await readFeedPolicySetting(tx);
    const current = readTunable(policy, tunable);
    if (variants.data.control !== current) {
      return {
        ok: false,
        message: `El control ya no es el valor vigente (${formatTunableValue(tunable, current)}).`,
      } as const;
    }
    const check = checkChange(tunable, current, variants.data.treatment);
    if (!check.ok) return { ok: false, message: check.reason } as const;
    const updated = await tx.experiment.updateMany({
      where: { id: experiment.id, status: "DRAFT" },
      data: { status: "RUNNING", startedAt: now },
    });
    return updated.count === 1
      ? ({ ok: true, experimentId: experiment.id } as const)
      : ({ ok: false, message: "Solo se inicia un experimento en borrador." } as const);
  });
}

async function evaluateStored(
  client: Client,
  experiment: {
    key: string;
    allocation: number;
    primaryMetric: string;
    minSamplePerVariant: number;
    guardrails: unknown;
    startedAt: Date | null;
    endedAt: Date | null;
  },
  now: Date,
): Promise<ExperimentResult | null> {
  if (!experiment.startedAt) return null;
  const end = experiment.endedAt && experiment.endedAt < now ? experiment.endedAt : now;
  const people = await personFeedActivity(client, experiment.startedAt, end);
  return evaluateExperimentData({
    experiment: { ...experiment, startedAt: experiment.startedAt },
    people,
    end,
    now,
  });
}

const EXPERIMENT_SELECT = {
  id: true,
  key: true,
  status: true,
  settingKey: true,
  hypothesis: true,
  variants: true,
  allocation: true,
  primaryMetric: true,
  minSamplePerVariant: true,
  guardrails: true,
  startedAt: true,
  endedAt: true,
  result: true,
  decisionId: true,
  decision: { select: { id: true, status: true, evaluation: true } },
} as const;

/** Detiene un experimento en curso: todos vuelven al control de inmediato. */
export async function stopExperiment(
  client: Client,
  input: {
    experimentId: string;
    actor: Actor;
    userId?: string | null;
    reason: string;
    verdict?: ExperimentVerdict;
    now?: Date;
  },
): Promise<ExperimentActionResult> {
  const now = input.now ?? new Date();
  const experiment = await client.experiment.findUnique({
    where: { id: input.experimentId },
    select: EXPERIMENT_SELECT,
  });
  if (!experiment || experiment.status !== "RUNNING") {
    return { ok: false, message: "Solo se detiene un experimento en curso." };
  }
  const result = await evaluateStored(client, { ...experiment, endedAt: now }, now);
  return inTransaction(client, async (tx) => {
    const updated = await tx.experiment.updateMany({
      where: { id: experiment.id, status: "RUNNING" },
      data: {
        status: "STOPPED",
        endedAt: now,
        result: toJson({
          ...(result ?? {}),
          verdict: input.verdict ?? "stopped_manual",
          summary: input.reason,
        }),
      },
    });
    if (updated.count !== 1) {
      return { ok: false, message: "Solo se detiene un experimento en curso." } as const;
    }
    // La propuesta que lo lanzó queda revertida: el tratamiento ya no se muestra a nadie.
    if (experiment.decision && experiment.decision.status === "APPROVED") {
      await tx.platformDecision.update({
        where: { id: experiment.decision.id },
        data: {
          status: "REVERTED",
          revertedAt: now,
          reason: input.reason.slice(0, 900),
          evaluation: updateEvaluation(experiment.decision.evaluation, {
            trail: [
              trailEntry("experiment_stopped", input.actor, now, {
                userId: input.userId,
                note: input.reason,
              }),
            ],
          }),
        },
      });
    }
    return { ok: true, experimentId: experiment.id } as const;
  });
}

/**
 * Tras revertir (o cambiar) un parámetro: los experimentos en curso sobre ese MISMO parámetro cuyo
 * control ya no es el valor vigente se detienen. Ya nadie ve su tratamiento (`resolveFeedPolicy` lo
 * ignora) y su análisis compararía algo distinto de lo que dice. Devuelve cuántos detuvo.
 */
export async function stopStaleExperimentsOn(
  client: Client,
  settingKey: string | null,
  input: { actor: Actor; userId?: string | null; now: Date },
): Promise<number> {
  const tunable = getTunable(settingKey);
  if (!tunable) return 0;
  const running = await client.experiment.findMany({
    where: { status: "RUNNING", settingKey: tunable.key },
    select: { id: true, variants: true },
  });
  if (running.length === 0) return 0;
  const { policy } = await readFeedPolicySetting(client);
  const current = readTunable(policy, tunable);
  let stopped = 0;
  for (const experiment of running) {
    const variants = experimentVariantsSchema.safeParse(experiment.variants);
    if (variants.success && variants.data.control === current) continue;
    const result = await stopExperiment(client, {
      experimentId: experiment.id,
      actor: input.actor,
      userId: input.userId,
      verdict: "stopped_stale",
      reason: `${tunable.label} cambió a ${formatTunableValue(tunable, current)} y el control del experimento ya no es el valor vigente: se detiene y todos ven el valor vigente.`,
      now: input.now,
    });
    if (result.ok) stopped++;
  }
  return stopped;
}

export type ExperimentsSummary = {
  evaluated: number;
  concluded: number;
  stopped: number;
  adoptionsProposed: number;
};

/**
 * Evalúa los experimentos en curso: guarda el progreso, detiene los que rompen una salvaguarda y
 * concluye los que alcanzan la muestra (o el plazo máximo). Idempotente: cada transición es
 * condicional al estado RUNNING.
 */
export async function evaluateRunningExperiments(
  client: Client,
  now: Date = new Date(),
): Promise<ExperimentsSummary> {
  const summary: ExperimentsSummary = {
    evaluated: 0,
    concluded: 0,
    stopped: 0,
    adoptionsProposed: 0,
  };
  // Primero, los que ya no comparan contra el valor vigente (el ajuste cambió mientras corrían).
  const keys = await client.experiment.findMany({
    where: { status: "RUNNING" },
    select: { settingKey: true },
    distinct: ["settingKey"],
  });
  for (const { settingKey } of keys) {
    summary.stopped += await stopStaleExperimentsOn(client, settingKey, { actor: "SYSTEM", now });
  }
  const running = await client.experiment.findMany({
    where: { status: "RUNNING" },
    select: EXPERIMENT_SELECT,
  });
  for (const experiment of running) {
    const result = await evaluateStored(client, experiment, now);
    if (!result) continue;
    summary.evaluated++;
    if (result.verdict === "running") {
      const previous =
        experiment.result && typeof experiment.result === "object" ? experiment.result : {};
      await client.experiment.updateMany({
        where: { id: experiment.id, status: "RUNNING" },
        data: { result: toJson({ ...previous, ...result }) },
      });
      continue;
    }
    if (result.verdict === "stopped_guardrail") {
      const stopped = await stopExperiment(client, {
        experimentId: experiment.id,
        actor: "SYSTEM",
        reason: result.summary,
        verdict: "stopped_guardrail",
        now,
      });
      if (stopped.ok) summary.stopped++;
      continue;
    }
    if (await concludeExperiment(client, experiment, result, now)) {
      summary.concluded++;
      if (result.verdict === "adopt") summary.adoptionsProposed++;
    }
  }
  return summary;
}

async function concludeExperiment(
  client: Client,
  experiment: {
    id: string;
    key: string;
    settingKey: string;
    variants: unknown;
    decision: { id: string; status: string; evaluation: unknown } | null;
  },
  result: ExperimentResult,
  now: Date,
): Promise<boolean> {
  const tunable = getTunable(experiment.settingKey);
  const variants = experimentVariantsSchema.safeParse(experiment.variants);
  return inTransaction(client, async (tx) => {
    const updated = await tx.experiment.updateMany({
      where: { id: experiment.id, status: "RUNNING" },
      data: { status: "CONCLUDED", endedAt: now, result: toJson(result) },
    });
    if (updated.count !== 1) return false;
    if (experiment.decision) {
      await tx.platformDecision.update({
        where: { id: experiment.decision.id },
        data: {
          evaluation: updateEvaluation(experiment.decision.evaluation, {
            trail: [trailEntry("experiment_concluded", "SYSTEM", now, { note: result.summary })],
          }),
        },
      });
    }
    if (!tunable || !variants.success) return true;
    const { policy } = await readFeedPolicySetting(tx);
    const current = readTunable(policy, tunable);
    const from = formatTunableValue(tunable, current);
    const to = formatTunableValue(tunable, variants.data.treatment);
    const comparison = result.comparison;
    const label = getMetric(result.primaryMetric)?.label ?? result.primaryMetric;
    const effect = comparison
      ? `${label}: ${formatMetricValue(result.primaryMetric, result.variants.control.primary.value)} en control y ${formatMetricValue(result.primaryMetric, result.variants.treatment.primary.value)} en tratamiento (diferencia con intervalo de 95 %: ${formatMetricValue(result.primaryMetric, comparison.ci95[0])} a ${formatMetricValue(result.primaryMetric, comparison.ci95[1])}).`
      : `${label}: sin datos suficientes para comparar.`;
    const adopt = result.verdict === "adopt";
    await tx.platformDecision.create({
      data: {
        actor: "SYSTEM",
        kind: adopt ? "experiment.adopt" : "experiment.discard",
        title: adopt
          ? `Adoptar: ${tunable.label} ${from} → ${to}`
          : `Descartado: ${tunable.label} ${from} → ${to}`,
        hypothesis: `${result.summary} ${effect}`,
        settingKey: tunable.key,
        previousValue: current,
        newValue: variants.data.treatment,
        riskLevel: classifyRisk(tunable.key),
        status: adopt ? "PROPOSED" : "REJECTED",
        expectedImpact: adopt ? effect : null,
        measuredImpact: toJson({
          primaryMetric: result.primaryMetric,
          comparison,
          variants: result.variants,
        }),
        guardrails: toJson(DEFAULT_GUARDRAILS),
        experimentId: experiment.id,
        decidedAt: adopt ? null : now,
        reason: adopt
          ? "Adoptar un cambio de riesgo medio requiere tu aprobación."
          : result.summary.slice(0, 900),
        evaluation: updateEvaluation(null, {
          trail: [
            trailEntry(adopt ? "proposed" : "rejected", "SYSTEM", now, {
              note: `Resultado del experimento ${experiment.key}.`,
            }),
          ],
        }),
      },
    });
    return true;
  });
}
