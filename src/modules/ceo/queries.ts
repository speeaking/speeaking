import "server-only";
import type { DecisionStatus, ExperimentStatus, RiskLevel } from "@/generated/prisma/enums";
import {
  AI_BUDGET_KEY,
  aiBudgetSchema,
  aiCoverageRatio,
  DEFAULT_AI_BUDGET,
} from "@/modules/ai/budget";
import { mxnCentsToMicrosUsd } from "@/modules/ai/cost";
import {
  aiUsage,
  FEED_IMPRESSIONS_ARE_VISIBLE,
  feedViewersInPeriod,
  platformRevenueCents,
} from "@/modules/analytics/platform-aggregates";
import { readAutonomy, readFeedPolicySetting } from "@/modules/platform/apply";
import {
  AUTONOMY_KEY,
  AUTONOMY_LABELS,
  AUTONOMY_MODES,
  type AutonomyMode,
} from "@/modules/platform/autonomy";
import {
  addDays,
  type Day,
  dayEnd,
  dayRange,
  dayStart,
  type FreezePeriod,
  freezePeriodFor,
  mexicoDay,
  nextFreezePeriod,
} from "@/modules/platform/calendar";
import { experimentVariantsSchema } from "@/modules/platform/experiments";
import {
  formatTunableValue,
  getTunable,
  TUNABLES,
  type Tunable,
} from "@/modules/platform/tunables";
import { db } from "@/server/db";
import {
  DECISION_RISK_FILTERS,
  DECISION_STATUS_FILTERS,
  type DecisionRiskFilter,
  type DecisionStatusFilter,
} from "./decision-filters";
import { parseEvaluation } from "./decision-record";
import { type ExperimentResult, experimentHorizonViewers } from "./experiments";
import type { GuardrailEvaluation } from "./guardrails";
import {
  duplicateProposalIds,
  HANDLED_ELSEWHERE_KEYS,
  type HandledElsewhere,
  handledElsewhere,
} from "./handled-elsewhere";
import {
  ACTOR_LABELS,
  EXPERIMENT_STATUS_LABELS,
  formatDateTime,
  RISK_LABELS,
  STATUS_LABELS,
  TRAIL_ACTION_LABELS,
} from "./labels";
import { formatMetricValue, getMetric, type MetricKey } from "./metric-catalog";
import { loadMetricRows, personalImpressionsSeries } from "./metric-rows";
import { aiBudgetLimitMicros, utcMonthStart } from "./metrics";
import {
  minSampleFor,
  type SampleAssumptions,
  assessTrafficThreshold,
  type ThresholdAssessment,
} from "./threshold";
import { aggregateWindow } from "./windows";

/**
 * Lecturas del área /admin del motor de automejora. Devuelven DTOs explícitos con textos listos para
 * pintar (cifras formateadas por código). La autorización está en `service.ts` (`assertAdmin`).
 */

// ───────────────────────────── Decisiones ─────────────────────────────

export type DecisionAction = "approve" | "reject" | "revert";

export type DecisionDTO = {
  id: string;
  kind: string;
  title: string;
  hypothesis: string;
  status: DecisionStatus;
  statusLabel: string;
  risk: RiskLevel;
  riskLabel: string;
  actorLabel: string;
  autoApplied: boolean;
  reason: string | null;
  expectedImpact: string | null;
  setting: { key: string; label: string; from: string; to: string } | null;
  narrative: { source: "template" | "ai"; text: string } | null;
  guardrails: {
    status: GuardrailEvaluation["status"];
    /** Vigilancia cerrada sin revertir: sin daño detectado o sin evidencia de daño (ventana máxima). */
    conclusion: GuardrailEvaluation["conclusion"] | null;
    checks: { summary: string; verdict: string }[];
  } | null;
  impact: { label: string; baseline: string; observed: string; change: string | null } | null;
  experiment: { key: string; status: string; statusLabel: string } | null;
  approvedBy: string | null;
  trail: { at: string; actor: string; action: string; note: string | null }[];
  createdAt: string;
  /** «Solo propuesta»: riesgo alto o sin ajuste del catálogo; el código nunca la aplica. */
  proposalOnly: boolean;
  /**
   * Se decide en otra pantalla (p. ej. `ai.routing` en /admin/ia): aquí solo se muestra con la liga,
   * sin aprobar, rechazar ni revertir.
   */
  handledIn: HandledElsewhere | null;
  approveLabel: string | null;
  actions: DecisionAction[];
};

export {
  DECISION_RISK_FILTERS,
  DECISION_STATUS_FILTERS,
  type DecisionRiskFilter,
  type DecisionStatusFilter,
} from "./decision-filters";

/** Máximo de decisiones por página de la cola (sin paginación todavía; la página lo avisa). */
export const DECISION_PAGE_SIZE = 50;

const percent = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

function approveLabelFor(tunable: Tunable | null, risk: RiskLevel, hasExperiment: boolean) {
  if (!tunable || risk === "HIGH") return "Aprobar (la ejecutas tú)";
  if (risk === "LOW") return "Aprobar y aplicar";
  return hasExperiment ? "Adoptar" : "Probar con el 10 %";
}

/** Valor de un ajuste que no es del catálogo (p. ej. el modo de autonomía) para mostrarlo. */
function settingValueLabel(settingKey: string, value: unknown): string {
  if (settingKey === AUTONOMY_KEY && AUTONOMY_MODES.includes(value as AutonomyMode)) {
    return AUTONOMY_LABELS[value as AutonomyMode];
  }
  if (value === null || value === undefined) return "—";
  // Un valor compuesto (p. ej. `ai.routing`, que registra el módulo de IA) no cabe en una línea.
  if (typeof value === "object") return "valor compuesto";
  return String(value).slice(0, 80);
}

function impactOf(value: unknown): DecisionDTO["impact"] {
  if (!value || typeof value !== "object") return null;
  const impact = value as Record<string, unknown>;
  const metric = typeof impact.metric === "string" ? impact.metric : null;
  if (!metric) return null;
  const baseline = typeof impact.baseline === "number" ? impact.baseline : null;
  const observed = typeof impact.observed === "number" ? impact.observed : null;
  const change = typeof impact.relativeChange === "number" ? impact.relativeChange : null;
  return {
    label: getMetric(metric)?.label ?? metric,
    baseline: formatMetricValue(metric, baseline),
    observed: formatMetricValue(metric, observed),
    change:
      change === null
        ? null
        : `${change >= 0 ? "+" : "−"}${percent.format(Math.abs(change) * 100)} %`,
  };
}

const DECISION_SELECT = {
  id: true,
  kind: true,
  title: true,
  hypothesis: true,
  status: true,
  riskLevel: true,
  actor: true,
  autoApplied: true,
  reason: true,
  expectedImpact: true,
  settingKey: true,
  previousValue: true,
  newValue: true,
  measuredImpact: true,
  evaluation: true,
  createdAt: true,
  experimentId: true,
  experiment: { select: { key: true, status: true } },
  launchedExperiment: { select: { key: true, status: true } },
  approvedBy: { select: { profile: { select: { username: true } } } },
} as const;

type DecisionRow = Awaited<ReturnType<typeof findDecisionRows>>[number];

/**
 * Solo decisiones del motor de automejora: la bitácora de moderación (`moderation.*`,
 * `authenticity.*`, del módulo trust) también usa `PlatformDecision` y se ve en /admin/moderacion.
 */
const ENGINE_DECISIONS = {
  NOT: [{ kind: { startsWith: "moderation." } }, { kind: { startsWith: "authenticity." } }],
} satisfies NonNullable<Parameters<typeof db.platformDecision.findMany>[0]>["where"];

function findDecisionRows(
  where: NonNullable<Parameters<typeof db.platformDecision.findMany>[0]>["where"],
  take: number,
) {
  return db.platformDecision.findMany({
    where: { AND: [ENGINE_DECISIONS, where ?? {}] },
    select: DECISION_SELECT,
    orderBy: { createdAt: "desc" },
    take,
  });
}

async function usernames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const profiles = await db.profile.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, username: true },
  });
  return new Map(profiles.map((profile) => [profile.userId, `@${profile.username}`]));
}

function toDecisionDTO(row: DecisionRow, names: Map<string, string>): DecisionDTO {
  const tunable = getTunable(row.settingKey);
  const evaluation = parseEvaluation(row.evaluation);
  const guardrails = evaluation.guardrails as GuardrailEvaluation | undefined;
  const experiment = row.launchedExperiment ?? row.experiment;
  const handledIn = handledElsewhere(row.settingKey);
  const proposalOnly = !handledIn && (!tunable || row.riskLevel === "HIGH");
  const actions: DecisionAction[] = [];
  if (!handledIn && row.status === "PROPOSED") actions.push("approve", "reject");
  if (!handledIn && row.status === "APPLIED" && tunable) actions.push("revert");
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    hypothesis: row.hypothesis,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    risk: row.riskLevel,
    riskLabel: RISK_LABELS[row.riskLevel],
    actorLabel: row.actor === "AI" ? "Analista (IA CEO)" : ACTOR_LABELS[row.actor],
    autoApplied: row.autoApplied,
    reason: row.reason,
    expectedImpact: row.expectedImpact,
    setting: tunable
      ? {
          key: tunable.key,
          label: tunable.label,
          from: formatTunableValue(tunable, row.previousValue),
          to: formatTunableValue(tunable, row.newValue),
        }
      : row.settingKey
        ? {
            key: row.settingKey,
            label: row.settingKey === AUTONOMY_KEY ? "Modo de autonomía" : row.settingKey,
            from: settingValueLabel(row.settingKey, row.previousValue),
            to: settingValueLabel(row.settingKey, row.newValue),
          }
        : null,
    narrative: evaluation.narrative
      ? { source: evaluation.narrative.source, text: evaluation.narrative.text }
      : null,
    guardrails: guardrails?.checks
      ? {
          status: guardrails.status,
          conclusion: guardrails.final ? (guardrails.conclusion ?? null) : null,
          checks: guardrails.checks.map((check) => ({
            summary: check.summary,
            verdict: check.verdict,
          })),
        }
      : null,
    impact: impactOf(row.measuredImpact),
    experiment: experiment
      ? {
          key: experiment.key,
          status: experiment.status,
          statusLabel: EXPERIMENT_STATUS_LABELS[experiment.status],
        }
      : null,
    approvedBy: row.approvedBy?.profile ? `@${row.approvedBy.profile.username}` : null,
    trail: evaluation.trail.map((entry) => ({
      at: formatDateTime(entry.at),
      actor: entry.userId
        ? (names.get(entry.userId) ?? ACTOR_LABELS[entry.actor])
        : ACTOR_LABELS[entry.actor],
      action: TRAIL_ACTION_LABELS[entry.action],
      note: entry.note ?? null,
    })),
    createdAt: formatDateTime(row.createdAt),
    proposalOnly,
    handledIn,
    approveLabel:
      row.status === "PROPOSED" && !handledIn
        ? approveLabelFor(tunable, row.riskLevel, row.experimentId !== null)
        : null,
    actions,
  };
}

/**
 * Propuestas pendientes repetidas de lo que se decide en otra pantalla (la misma ruta de modelo
 * propuesta dos veces): en la cola se muestra solo la más reciente.
 */
async function duplicatePendingIds(risk: RiskLevel | null = null): Promise<string[]> {
  if (HANDLED_ELSEWHERE_KEYS.length === 0) return [];
  const rows = await db.platformDecision.findMany({
    where: {
      settingKey: { in: [...HANDLED_ELSEWHERE_KEYS] },
      status: "PROPOSED",
      ...(risk ? { riskLevel: risk } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, settingKey: true, title: true, previousValue: true, newValue: true },
  });
  return duplicateProposalIds(rows);
}

async function toDecisionDTOs(rows: DecisionRow[]): Promise<DecisionDTO[]> {
  const ids = new Set<string>();
  for (const row of rows) {
    for (const entry of parseEvaluation(row.evaluation).trail)
      if (entry.userId) ids.add(entry.userId);
  }
  const names = await usernames([...ids]);
  return rows.map((row) => toDecisionDTO(row, names));
}

export async function listDecisions(filters: {
  status: DecisionStatusFilter;
  risk: DecisionRiskFilter | null;
}): Promise<{ items: DecisionDTO[]; counts: Record<DecisionStatusFilter, number> }> {
  const statuses = [...DECISION_STATUS_FILTERS[filters.status]];
  const duplicates = await duplicatePendingIds(
    filters.risk ? DECISION_RISK_FILTERS[filters.risk] : null,
  );
  const [rows, grouped] = await Promise.all([
    findDecisionRows(
      {
        status: { in: statuses },
        ...(filters.risk ? { riskLevel: DECISION_RISK_FILTERS[filters.risk] } : {}),
        ...(duplicates.length > 0 ? { id: { notIn: duplicates } } : {}),
      },
      DECISION_PAGE_SIZE,
    ),
    db.platformDecision.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: {
        ...ENGINE_DECISIONS,
        ...(filters.risk ? { riskLevel: DECISION_RISK_FILTERS[filters.risk] } : {}),
      },
    }),
  ]);
  const byStatus = new Map(grouped.map((row) => [row.status, row._count._all]));
  // Las repetidas son pendientes y no se muestran: tampoco cuentan.
  byStatus.set("PROPOSED", Math.max(0, (byStatus.get("PROPOSED") ?? 0) - duplicates.length));
  const counts = Object.fromEntries(
    Object.entries(DECISION_STATUS_FILTERS).map(([filter, list]) => [
      filter,
      list.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0),
    ]),
  ) as Record<DecisionStatusFilter, number>;
  return { items: await toDecisionDTOs(rows), counts };
}

// ───────────────────────────── Experimentos ─────────────────────────────

export type ExperimentDTO = {
  id: string;
  key: string;
  status: ExperimentStatus;
  statusLabel: string;
  settingLabel: string;
  control: string;
  treatment: string;
  allocation: string;
  hypothesis: string;
  primaryMetric: string;
  minSamplePerVariant: number;
  progress: { control: number; treatment: number } | null;
  comparison: { change: string; interval: string; pValue: string } | null;
  guardrailStatus: GuardrailEvaluation["status"] | null;
  guardrailChecks: string[];
  verdict: string | null;
  startedAt: string;
  endedAt: string;
  origin: string | null;
  actions: ("start" | "stop")[];
};

function experimentResult(value: unknown): Partial<ExperimentResult> {
  return value && typeof value === "object" ? (value as Partial<ExperimentResult>) : {};
}

export async function listExperiments(): Promise<ExperimentDTO[]> {
  const rows = await db.experiment.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      key: true,
      status: true,
      settingKey: true,
      variants: true,
      allocation: true,
      hypothesis: true,
      primaryMetric: true,
      minSamplePerVariant: true,
      result: true,
      startedAt: true,
      endedAt: true,
      decision: { select: { title: true } },
    },
  });
  return rows.map((row) => {
    const tunable = getTunable(row.settingKey);
    const variants = experimentVariantsSchema.safeParse(row.variants);
    const result = experimentResult(row.result);
    const comparison = result.comparison;
    const format = (value: number | undefined) =>
      tunable && value !== undefined ? formatTunableValue(tunable, value) : String(value ?? "—");
    const actions: ExperimentDTO["actions"] = [];
    if (row.status === "DRAFT") actions.push("start");
    if (row.status === "RUNNING") actions.push("stop");
    return {
      id: row.id,
      key: row.key,
      status: row.status,
      statusLabel: EXPERIMENT_STATUS_LABELS[row.status],
      settingLabel: tunable?.label ?? row.settingKey,
      control: format(variants.data?.control),
      treatment: format(variants.data?.treatment),
      allocation: `${percent.format(row.allocation * 100)} %`,
      hypothesis: row.hypothesis,
      primaryMetric: getMetric(row.primaryMetric)?.label ?? row.primaryMetric,
      minSamplePerVariant: row.minSamplePerVariant,
      progress: result.variants
        ? {
            control: result.variants.control.impressions,
            treatment: result.variants.treatment.impressions,
          }
        : null,
      comparison: comparison
        ? {
            change:
              comparison.relativeChange === null
                ? "—"
                : `${comparison.relativeChange >= 0 ? "+" : "−"}${percent.format(Math.abs(comparison.relativeChange) * 100)} %`,
            interval: `${formatMetricValue(row.primaryMetric, comparison.ci95[0])} a ${formatMetricValue(row.primaryMetric, comparison.ci95[1])}`,
            pValue: comparison.pValue.toFixed(4),
          }
        : null,
      guardrailStatus: result.guardrails?.status ?? null,
      guardrailChecks: (result.guardrails?.checks ?? [])
        .filter((check) => check.verdict === "breach")
        .map((check) => check.summary),
      verdict: typeof result.summary === "string" ? result.summary : null,
      startedAt: formatDateTime(row.startedAt),
      endedAt: formatDateTime(row.endedAt),
      origin: row.decision?.title ?? null,
      actions,
    };
  });
}

// ───────────────────────────── Reporte semanal ─────────────────────────────

/**
 * `distinct`: personas distintas en la semana (consulta aparte). Sumar las filas diarias contaría a
 * quien vuelve 7 días como 7 personas.
 */
type ReportMetric = { key: MetricKey; mode: "sum" | "last" | "rate" | "distinct" };

const REPORT_METRICS: readonly ReportMetric[] = [
  { key: "feed.impressions.visible", mode: "sum" },
  { key: "feed.impressions.visible.anonymous", mode: "sum" },
  { key: "feed.impressions.served", mode: "sum" },
  { key: "feed.viewers", mode: "distinct" },
  { key: "feed.commerce.share", mode: "rate" },
  { key: "feed.commerce.ctr", mode: "rate" },
  { key: "feed.product_visits.rate", mode: "rate" },
  { key: "feed.engagement.rate", mode: "rate" },
  { key: "sellers.active", mode: "last" },
  { key: "product.visits.per_active_seller", mode: "rate" },
  { key: "sellers.first_sale.rate_30d", mode: "last" },
  { key: "reports.per_1k_impressions", mode: "rate" },
  { key: "not_interested.per_1k_impressions", mode: "rate" },
  { key: "retention.d1", mode: "rate" },
  { key: "retention.d7", mode: "rate" },
];

export type ReportMetricRow = {
  key: string;
  label: string;
  definition: string;
  current: string;
  previous: string;
  change: string | null;
  /** true = mejoró, false = empeoró, null = neutral o sin datos. */
  improved: boolean | null;
  sample: number;
};

export type WeeklyReportDTO = {
  period: { from: Day; to: Day };
  autonomy: {
    mode: AutonomyMode;
    label: string;
    threshold: ThresholdAssessment;
    assumptions: SampleAssumptions;
  };
  freeze: { active: FreezePeriod | null; next: FreezePeriod };
  counts: {
    proposed: number;
    applied: number;
    autoApplied: number;
    reverted: number;
    pending: number;
  };
  changes: DecisionDTO[];
  metrics: ReportMetricRow[];
  ai: {
    costMonth: string;
    limitMonth: string;
    usedShare: string;
    usedRatio: number | null;
    revenueMonth: string;
    coverage: string;
  };
  jobs: {
    job: string;
    status: string;
    startedAt: string;
    finishedAt: string;
    error: string | null;
  }[];
  alerts: string[];
  tunables: { label: string; value: string; risk: string }[];
};

function windowValue(
  rows: Awaited<ReturnType<typeof loadMetricRows>>,
  metric: ReportMetric,
  days: Day[],
  distinctPeople: number,
) {
  if (metric.mode === "distinct") return { value: distinctPeople, sample: distinctPeople };
  if (metric.mode === "last") {
    const last = [...rows]
      .filter((row) => row.key === metric.key && days.includes(row.day))
      .sort((a, b) => a.day.localeCompare(b.day))
      .at(-1);
    return last ? { value: last.value, sample: last.sampleSize } : { value: null, sample: 0 };
  }
  const window = aggregateWindow(rows, metric.key, days);
  return { value: window.value, sample: window.sample };
}

const usd = (micros: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", currencyDisplay: "code" })
    .format(micros / 1_000_000)
    .replace(/ /g, " ");

const STALE_RUNNING_MS = 2 * 60 * 60 * 1000;

export async function getWeeklyReport(now: Date = new Date()): Promise<WeeklyReportDTO> {
  const today = mexicoDay(now);
  const to = addDays(today, -1);
  const from = addDays(to, -6);
  const currentDays = dayRange(from, to);
  const previousDays = dayRange(addDays(from, -7), addDays(from, -1));
  const weekStart = new Date(now.getTime() - 7 * 86_400_000);
  const monthStart = utcMonthStart(now);

  const [
    rows,
    thresholdRows,
    horizon,
    weekPeople,
    previousWeekPeople,
    mode,
    changes,
    proposed,
    applied,
    autoApplied,
    reverted,
    jobs,
    aiMonth,
    limitMicros,
    revenueCents,
    budgetRow,
  ] = await Promise.all([
    loadMetricRows(
      db,
      REPORT_METRICS.map((metric) => metric.key),
      previousDays[0]!,
      to,
    ),
    loadMetricRows(db, ["feed.impressions.per_viewer", "feed.commerce.ctr"], addDays(to, -27), to),
    experimentHorizonViewers(db, to),
    feedViewersInPeriod(db, dayStart(from), dayEnd(to)),
    feedViewersInPeriod(db, dayStart(previousDays[0]!), dayStart(from)),
    readAutonomy(db),
    findDecisionRows(
      {
        OR: [
          { appliedAt: { gte: weekStart } },
          { revertedAt: { gte: weekStart } },
          { decidedAt: { gte: weekStart }, status: { in: ["APPROVED", "REJECTED"] } },
        ],
      },
      20,
    ),
    // Propuestas nuevas: de la IA o del sistema (adoptar tras un experimento); no los cambios que
    // hizo una persona directamente ni los descartes registrados.
    db.platformDecision.count({
      where: {
        AND: [
          ENGINE_DECISIONS,
          { createdAt: { gte: weekStart }, actor: { in: ["AI", "SYSTEM"] } },
          { kind: { not: "experiment.discard" } },
        ],
      },
    }),
    db.platformDecision.count({
      where: { AND: [ENGINE_DECISIONS, { appliedAt: { gte: weekStart } }] },
    }),
    db.platformDecision.count({
      where: { AND: [ENGINE_DECISIONS, { autoApplied: true, appliedAt: { gte: weekStart } }] },
    }),
    db.platformDecision.count({
      where: { AND: [ENGINE_DECISIONS, { revertedAt: { gte: weekStart } }] },
    }),
    db.jobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 40,
      select: { job: true, status: true, startedAt: true, finishedAt: true, error: true },
    }),
    aiUsage(db, monthStart, now),
    aiBudgetLimitMicros(db, monthStart),
    platformRevenueCents(db, monthStart, now),
    db.platformSetting.findUnique({ where: { key: AI_BUDGET_KEY }, select: { value: true } }),
  ]);

  // Umbral de tráfico con la muestra de la métrica comercial (la más exigente del catálogo) y m = lo
  // que junta una persona en el horizonte de un experimento (14 días).
  const baselineDays = dayRange(addDays(to, -27), to);
  const ctr = aggregateWindow(thresholdRows, "feed.commerce.ctr", baselineDays);
  const assumptions = minSampleFor({
    baselineRate: ctr.value,
    baselineSample: ctr.sample,
    impressionsPerPerson:
      horizon.viewers > 0 ? horizon.personalImpressions / horizon.viewers : null,
    viewers: horizon.viewers,
  });
  const threshold = assessTrafficThreshold({
    lastDay: to,
    dailyImpressions: personalImpressionsSeries(thresholdRows),
    minSamplePerVariant: assumptions.minSamplePerVariant,
    impressionsVisible: FEED_IMPRESSIONS_ARE_VISIBLE,
  });

  const metrics = REPORT_METRICS.map((metric) => {
    const definition = getMetric(metric.key)!;
    const current = windowValue(rows, metric, currentDays, weekPeople.viewers);
    const previous = windowValue(rows, metric, previousDays, previousWeekPeople.viewers);
    const change =
      current.value !== null && previous.value !== null && previous.value !== 0
        ? current.value / previous.value - 1
        : null;
    const improved =
      change === null || change === 0 || definition.better === null
        ? null
        : change > 0 === (definition.better === "up");
    return {
      key: metric.key,
      label: definition.label,
      definition:
        metric.mode === "distinct"
          ? "Cuentas distintas con al menos una impresión visible en la semana (sin quienes desactivaron la personalización, cuya actividad es anónima)."
          : definition.definition,
      current: formatMetricValue(metric.key, current.value),
      previous: formatMetricValue(metric.key, previous.value),
      change:
        change === null
          ? null
          : `${change >= 0 ? "+" : "−"}${percent.format(Math.abs(change) * 100)} %`,
      improved,
      sample: current.sample,
    };
  });

  // El mismo tipo de cambio que usa el guardián de presupuesto (ajuste `ai.budget` validado).
  const budget = aiBudgetSchema.safeParse(budgetRow?.value).data ?? DEFAULT_AI_BUDGET;
  const revenueMicros = mxnCentsToMicrosUsd(revenueCents, budget.mxnPerUsd);
  const coverage = aiCoverageRatio(revenueMicros, aiMonth.costMicrosUsd);
  const usedRatio = limitMicros > 0 ? aiMonth.costMicrosUsd / limitMicros : null;

  const latestByJob = new Map<string, (typeof jobs)[number]>();
  for (const job of jobs) if (!latestByJob.has(job.job)) latestByJob.set(job.job, job);
  const alerts: string[] = [];
  for (const job of jobs) {
    if (job.status === "RUNNING" && now.getTime() - job.startedAt.getTime() > STALE_RUNNING_MS) {
      alerts.push(
        `La tarea «${job.job}» lleva más de 2 horas corriendo (${formatDateTime(job.startedAt)}): pudo morir.`,
      );
    }
    if (job.status === "FAILED" && now.getTime() - job.startedAt.getTime() < 86_400_000) {
      alerts.push(`La tarea «${job.job}» falló el ${formatDateTime(job.startedAt)}.`);
    }
  }
  const lastDaily = latestByJob.get("ops-daily");
  if (!lastDaily || now.getTime() - lastDaily.startedAt.getTime() > 36 * 60 * 60 * 1000) {
    alerts.push(
      "La operación diaria no ha corrido en las últimas 36 horas (pnpm ops:daily o /api/cron/daily).",
    );
  }

  const [{ policy }, proposedCount, duplicates] = await Promise.all([
    readFeedPolicySetting(db),
    db.platformDecision.count({ where: { ...ENGINE_DECISIONS, status: "PROPOSED" } }),
    duplicatePendingIds(),
  ]);
  const pending = Math.max(0, proposedCount - duplicates.length);

  return {
    period: { from, to },
    autonomy: { mode, label: AUTONOMY_LABELS[mode], threshold, assumptions },
    freeze: { active: freezePeriodFor(today), next: nextFreezePeriod(today) },
    counts: { proposed, applied, autoApplied, reverted, pending },
    changes: await toDecisionDTOs(changes),
    metrics,
    ai: {
      costMonth: usd(aiMonth.costMicrosUsd),
      limitMonth: usd(limitMicros),
      usedShare: usedRatio === null ? "—" : `${percent.format(usedRatio * 100)} %`,
      usedRatio,
      revenueMonth: usd(revenueMicros),
      coverage: coverage === null ? "Sin costo de IA este mes" : `${percent.format(coverage)} ×`,
    },
    jobs: [...latestByJob.values()].map((job) => ({
      job: job.job,
      status: job.status,
      startedAt: formatDateTime(job.startedAt),
      finishedAt: formatDateTime(job.finishedAt),
      error: job.error,
    })),
    alerts: [...new Set(alerts)].slice(0, 8),
    tunables: TUNABLES.map((tunable) => ({
      label: tunable.label,
      value: formatTunableValue(tunable, policy[tunable.field]),
      risk: RISK_LABELS[tunable.risk],
    })),
  };
}
