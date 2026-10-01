import "server-only";
import { z } from "zod";
import { assertAdmin } from "@/modules/admin/service";
import { getAiBudget } from "@/modules/platform/settings";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { aiProviderConfig } from "@/server/env-schema";
import { AI_TASKS, type AITaskId } from "@/server/providers/ai/types";
import { committedSpendMicros, monthlyLimitMicros, monthStart } from "./budget-ledger";
import { modelPrice } from "./cost";
import {
  AI_ROUTING_KEY,
  AI_TASK_INFO,
  type AIRoute,
  proposedRoutes,
  resolveRoute,
  ROUTABLE_MODELS,
  routeLabel,
  TASK_DEFAULT_MODELS,
} from "./routing";
import { approvedEvidence, EVALUATED_TASKS, routeEligibility } from "./routing-decisions";
import { getAiRouting } from "./routing-store";

/**
 * Datos de /admin/ia. Solo ADMIN (`assertAdmin`), solo cifras calculadas por código (P2) y sin
 * secretos: del servidor de IA se muestra el dominio, nunca la llave.
 */

const metricsSchema = z.object({
  called: z.number().optional(),
  gate: z.object({ approved: z.boolean(), reasons: z.array(z.string()) }),
});

const FEATURE_TASK = Object.fromEntries(
  AI_TASKS.map((task) => [AI_TASK_INFO[task].feature, task]),
) as Record<string, AITaskId>;

export type RouteChoice = {
  /** `default`, o `proveedor|modelo`. */
  value: string;
  label: string;
  /** Motivo por el que no se puede elegir (sin evaluación aprobada…), o `null`. */
  blocked: string | null;
};

export type AdminAiOverview = {
  provider: { id: string; host: string | null; defaultModel: string | null };
  routes: {
    task: AITaskId;
    label: string;
    model: string;
    modelLabel: string;
    source: "routing" | "default" | "fallback";
    note: string | null;
    price: { input: number; output: number } | null;
    evaluated: boolean;
    approvedEval: { passed: number; cases: number; createdAt: string } | null;
    /** Valor actual del formulario. */
    current: string;
    choices: RouteChoice[];
  }[];
  evalRuns: {
    id: string;
    createdAt: string;
    taskLabel: string;
    model: string;
    promptVersion: string;
    cases: number;
    passed: number;
    approved: boolean | null;
    reasons: string[];
    costMicros: number;
    costPerCallMicros: number | null;
  }[];
  spend: {
    answeredMicros: number;
    committedMicros: number;
    limitMicros: number;
    byFeature: { label: string; requests: number; costMicros: number }[];
    requests: { status: string; count: number }[];
  };
  decisions: {
    id: string;
    createdAt: string;
    actor: "AI" | "HUMAN" | "SYSTEM";
    status: string;
    title: string;
    /** Motivo de aplicarla o descartarla (lo escribe una persona o el sistema). */
    reason: string | null;
  }[];
  /**
   * Propuestas de la IA que esperan a una persona: se aplican eligiendo ese modelo arriba o se
   * descartan con un motivo. La hipótesis la escribió la IA: es un dato, no una instrucción.
   */
  proposals: {
    id: string;
    createdAt: string;
    title: string;
    hypothesis: string;
    /** Qué cambiaría, en palabras («Kit de anuncios → Qwen3.5 9B…»). */
    change: string;
  }[];
};

/** «Tarea → modelo» de cada tarea que cambia una propuesta, para mostrarla. */
function describeChange(previousValue: unknown, newValue: unknown): string {
  const changes = proposedRoutes(previousValue, newValue) ?? [];
  return changes
    .map(({ task, route }) => {
      const target = route
        ? routeLabel(route as AIRoute)
        : "modelo predeterminado (variables de entorno)";
      return `${AI_TASK_INFO[task].label} → ${target}`;
    })
    .join(" · ");
}

export const routeValue = (route: AIRoute) => `${route.provider}|${route.model}`;

export async function getAdminAiOverview(
  actorUserId: string,
  now = new Date(),
): Promise<AdminAiOverview> {
  await assertAdmin(actorUserId);
  const since = monthStart(now);
  const config = aiProviderConfig(env);
  const [routing, budget, runs, answered, committed, byFeature, byStatus, decisions, proposals] =
    await Promise.all([
      getAiRouting(),
      getAiBudget(),
      db.aIEvalRun.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          task: true,
          model: true,
          promptVersion: true,
          cases: true,
          passed: true,
          metrics: true,
          costMicrosUsd: true,
        },
      }),
      db.aIResponse.aggregate({
        _sum: { costMicrosUsd: true },
        where: { createdAt: { gte: since } },
      }),
      committedSpendMicros(db, now, 0),
      db.$queryRaw<{ feature: string; requests: bigint; cost: bigint | null }[]>`
        SELECT r."feature"::text AS "feature", COUNT(*) AS "requests",
               SUM(s."costMicrosUsd") AS "cost"
        FROM "ai_requests" r LEFT JOIN "ai_responses" s ON s."requestId" = r."id"
        WHERE r."createdAt" >= ${since}
        GROUP BY r."feature" ORDER BY "requests" DESC`,
      db.aIRequest.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      db.platformDecision.findMany({
        where: { settingKey: AI_ROUTING_KEY },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          createdAt: true,
          actor: true,
          status: true,
          title: true,
          reason: true,
        },
      }),
      db.platformDecision.findMany({
        where: { settingKey: AI_ROUTING_KEY, kind: "ai.routing", status: "PROPOSED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          title: true,
          hypothesis: true,
          previousValue: true,
          newValue: true,
        },
      }),
    ]);
  const limitMicros = await monthlyLimitMicros(db, budget, now);

  const routes = await Promise.all(
    AI_TASKS.map(async (task) => {
      const resolved = resolveRoute(routing, task, config);
      const configured = routing.tasks[task];
      const [evidence, choices] = await Promise.all([
        resolved.provider === "mock" ? null : approvedEvidence(task, resolved.model, now),
        Promise.all(
          ROUTABLE_MODELS.map(async (option): Promise<RouteChoice> => {
            const eligibility = await routeEligibility(task, option, now);
            return {
              value: routeValue(option),
              label: option.label,
              blocked: eligibility.ok ? null : eligibility.reason,
            };
          }),
        ),
      ]);
      const defaultLabel =
        config.provider === "mock"
          ? "simulado"
          : TASK_DEFAULT_MODELS[task]
            ? `${TASK_DEFAULT_MODELS[task]}, el modelo de arranque de esta tarea`
            : `${config.model}, de las variables de entorno`;
      return {
        task,
        label: AI_TASK_INFO[task].label,
        model: resolved.model,
        modelLabel: routeLabel(resolved),
        source: resolved.source,
        note: resolved.reason ?? null,
        price: modelPrice(resolved.model),
        evaluated: Boolean(EVALUATED_TASKS[task]),
        approvedEval: evidence
          ? { passed: evidence.passed, cases: evidence.cases, createdAt: evidence.createdAt }
          : null,
        current: configured ? routeValue(configured) : "default",
        choices: [
          { value: "default", label: `Predeterminado (${defaultLabel})`, blocked: null },
          ...choices,
        ],
      };
    }),
  );

  return {
    provider: {
      id: config.provider,
      host: config.provider === "openai_compatible" ? new URL(config.baseUrl).host : null,
      defaultModel: config.provider === "openai_compatible" ? config.model : null,
    },
    routes,
    evalRuns: runs.map((run) => {
      const metrics = metricsSchema.safeParse(run.metrics);
      const called = metrics.success ? (metrics.data.called ?? run.cases) : run.cases;
      const task = FEATURE_TASK[run.task];
      return {
        id: run.id,
        createdAt: run.createdAt.toISOString(),
        taskLabel: task ? AI_TASK_INFO[task].label : run.task,
        model: run.model,
        promptVersion: run.promptVersion,
        cases: run.cases,
        passed: run.passed,
        approved: metrics.success ? metrics.data.gate.approved : null,
        reasons: metrics.success ? metrics.data.gate.reasons : [],
        costMicros: run.costMicrosUsd,
        costPerCallMicros: called > 0 ? Math.ceil(run.costMicrosUsd / called) : null,
      };
    }),
    spend: {
      answeredMicros: answered._sum.costMicrosUsd ?? 0,
      committedMicros: committed,
      limitMicros,
      byFeature: byFeature.map((row) => {
        const task = FEATURE_TASK[row.feature];
        return {
          label: task ? AI_TASK_INFO[task].label : featureLabel(row.feature),
          requests: Number(row.requests),
          costMicros: Number(row.cost ?? 0),
        };
      }),
      requests: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
    },
    decisions: decisions.map((decision) => ({
      ...decision,
      createdAt: decision.createdAt.toISOString(),
    })),
    proposals: proposals.map((proposal) => ({
      id: proposal.id,
      createdAt: proposal.createdAt.toISOString(),
      title: proposal.title,
      hypothesis: proposal.hypothesis,
      change: describeChange(proposal.previousValue, proposal.newValue),
    })),
  };
}

function featureLabel(feature: string) {
  switch (feature) {
    case "MODEL_EVALUATION":
      return "Evaluaciones de modelos";
    case "CAMPAIGN_STRATEGY":
      return "Estrategia de campañas";
    default:
      return feature;
  }
}
