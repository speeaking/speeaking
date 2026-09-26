import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { assertAdmin } from "@/modules/admin/service";
import { trailEntry, updateEvaluation } from "@/modules/ceo/decision-record";
import { proposalKey } from "@/modules/ceo/handled-elsewhere";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { type AIProviderConfig, aiProviderConfig } from "@/server/env-schema";
import type { AITaskId } from "@/server/providers/ai/types";
import {
  AI_ROUTING_KEY,
  AI_ROUTING_RISK,
  AI_TASK_INFO,
  type AIRoute,
  type AIRouting,
  aiRoutingSchema,
  DEFAULT_AI_ROUTING,
  isRoutable,
  proposalIsStale,
  routeLabel,
  withRoute,
} from "./routing";
import { adCopyTask } from "./tasks/ad-copy";
import { saleProposalTask } from "./tasks/sale-proposal";

/**
 * Cambios de `ai.routing` (riesgo MEDIO, plan-90-dias.md §2.4): una persona ADMIN los aplica desde
 * /admin/ia; la IA CEO solo los PROPONE con la evaluación como evidencia. Todo queda en
 * `PlatformDecision` con el valor anterior y el nuevo (reversible).
 *
 * Una decisión por cambio: si la IA ya propuso exactamente ese cambio (misma tarea y misma ruta),
 * aplicarlo en /admin/ia cierra ESA propuesta como aplicada (no crea otra decisión), y las copias
 * repetidas que hubiera quedan aplicadas y ligadas a ella con el motivo. Proponer dos veces lo mismo
 * tampoco crea otra propuesta. Todo bajo el mismo candado del ajuste.
 *
 * Una propuesta que ya no cambiaría nada (la tarea ya usa ese modelo) se cierra sola como
 * REJECTED con el motivo (`closeStaleAiRoutingProposals`, al cambiar la ruta y al abrir /admin/ia),
 * y una persona ADMIN puede descartar cualquier otra con su motivo (`discardAiRoutingProposal`).
 */

/** Tareas con evaluación (`pnpm ai:eval`) y la versión de prompt que debe tener la evidencia. */
export const EVALUATED_TASKS: Partial<Record<AITaskId, string>> = {
  sale_proposal: saleProposalTask.promptVersion,
  ad_copy: adCopyTask.promptVersion,
};

/** Antigüedad máxima de la evaluación que respalda un cambio. */
export const EVAL_EVIDENCE_MAX_AGE_DAYS = 30;

/** Lo que se lee de `AIEvalRun.metrics` (las corridas viejas pueden no traer `suite`). */
const runMetricsSchema = z.object({
  gate: z.object({ approved: z.boolean(), reasons: z.array(z.string()) }),
  providerErrors: z.number().optional(),
  suite: z.object({ total: z.number() }).optional(),
});

/** Corridas que se revisan en la ventana (una por día de sobra). */
const EVIDENCE_RUNS_LIMIT = 50;

export class RoutingChangeError extends Error {
  override name = "RoutingChangeError";
  constructor(readonly userMessage: string) {
    super(userMessage);
  }
}

export type EvalEvidence = {
  evalRunId: string;
  model: string;
  promptVersion: string;
  cases: number;
  passed: number;
  createdAt: string;
};

/**
 * Evidencia de que un modelo sirve para una tarea (con el prompt vigente, últimos 30 días), o
 * `null`. Cuentan TODAS las corridas concluyentes de la ventana, no solo la mejor: si alguna
 * reprobó, no hay evidencia (repetir la corrida hasta que salga aprobada sería escoger el resultado;
 * los criterios son de cero fallas). Una corrida con errores del proveedor o parcial (`--limit`) no
 * es concluyente y no cuenta en ningún sentido. El simulador no necesita evidencia.
 */
export async function approvedEvidence(
  task: AITaskId,
  model: string,
  now = new Date(),
): Promise<EvalEvidence | null> {
  const promptVersion = EVALUATED_TASKS[task];
  if (!promptVersion) return null;
  const runs = await db.aIEvalRun.findMany({
    where: {
      task: AI_TASK_INFO[task].feature,
      model,
      promptVersion,
      createdAt: { gte: new Date(now.getTime() - EVAL_EVIDENCE_MAX_AGE_DAYS * 86_400_000) },
    },
    orderBy: { createdAt: "desc" },
    take: EVIDENCE_RUNS_LIMIT,
    select: {
      id: true,
      model: true,
      promptVersion: true,
      cases: true,
      passed: true,
      metrics: true,
      createdAt: true,
    },
  });
  const conclusive = runs.flatMap((row) => {
    const metrics = runMetricsSchema.safeParse(row.metrics);
    if (!metrics.success) return [];
    const { gate, providerErrors = 0, suite } = metrics.data;
    if (providerErrors > 0 || (suite && row.cases < suite.total)) return [];
    return [{ row, approved: gate.approved }];
  });
  if (conclusive.length === 0 || conclusive.some((run) => !run.approved)) return null;
  const run = conclusive[0]!.row;
  return run
    ? {
        evalRunId: run.id,
        model: run.model,
        promptVersion: run.promptVersion,
        cases: run.cases,
        passed: run.passed,
        createdAt: run.createdAt.toISOString(),
      }
    : null;
}

/** ¿Se puede enrutar la tarea a ese modelo? Devuelve la evidencia o el motivo para no hacerlo. */
export async function routeEligibility(task: AITaskId, route: AIRoute | null, now = new Date()) {
  if (route === null || route.provider === "mock") return { ok: true as const, evidence: null };
  if (!isRoutable(route)) {
    return { ok: false as const, reason: "Ese modelo no está en la lista permitida." };
  }
  if (!EVALUATED_TASKS[task]) {
    return {
      ok: false as const,
      reason:
        "Esta tarea aún no tiene evaluación: solo puede usar el modelo predeterminado o el simulado.",
    };
  }
  const evidence = await approvedEvidence(task, route.model, now);
  return evidence
    ? { ok: true as const, evidence }
    : {
        ok: false as const,
        reason: `Ese modelo no tiene evaluación aprobada con el prompt vigente en los últimos ${EVAL_EVIDENCE_MAX_AGE_DAYS} días, o reprobó alguna. Corre: pnpm ai:eval --task ${task} --model ${route.model} --confirm-spend`,
      };
}

async function currentRouting(tx: Pick<typeof db, "platformSetting">): Promise<AIRouting> {
  const row = await tx.platformSetting.findUnique({
    where: { key: AI_ROUTING_KEY },
    select: { value: true },
  });
  return (row && aiRoutingSchema.safeParse(row.value).data) || DEFAULT_AI_ROUTING;
}

function sameRoute(a: AIRoute | undefined, b: AIRoute | undefined) {
  return a?.provider === b?.provider && a?.model === b?.model;
}

/** Propuestas pendientes que se revisan al aplicar o proponer (de sobra: se proponen pocas). */
const PENDING_PROPOSALS_LIMIT = 200;

/** Propuestas de `ai.routing` que esperan a una persona. */
const PENDING_WHERE = {
  settingKey: AI_ROUTING_KEY,
  kind: "ai.routing",
  status: "PROPOSED",
} as const satisfies Prisma.PlatformDecisionWhereInput;

/** Motivo con que se cierra sola una propuesta que ya no cambiaría nada. */
export const STALE_PROPOSAL_REASON =
  "Se cerró sola: la tarea ya usa ese modelo, así que no había nada que aplicar.";

/** Título de una propuesta repetida que se cerró ligada a la que se aplicó. */
const REPEATED_PREFIX = "Repetida (aplicada con otra decisión): ";

type Pending = {
  id: string;
  title: string;
  previousValue: unknown;
  newValue: unknown;
  evaluation: unknown;
};

/**
 * Propuestas pendientes de EXACTAMENTE el cambio `previous` → `next`, la más reciente primero. Se
 * comparan con la misma llave que usa la cola de decisiones para no mostrar repetidas
 * (`proposalKey`: las tareas que cambian y su nueva ruta), no con el valor completo: las demás
 * tareas pudieron cambiar desde que se propuso.
 */
async function pendingProposals(
  tx: Prisma.TransactionClient,
  previous: AIRouting,
  next: AIRouting,
): Promise<Pending[]> {
  const key = proposalKey({
    settingKey: AI_ROUTING_KEY,
    title: "",
    previousValue: previous,
    newValue: next,
  });
  const rows = await tx.platformDecision.findMany({
    where: PENDING_WHERE,
    orderBy: { createdAt: "desc" },
    take: PENDING_PROPOSALS_LIMIT,
    select: { id: true, title: true, previousValue: true, newValue: true, evaluation: true },
  });
  return rows.filter((row) => proposalKey({ ...row, settingKey: AI_ROUTING_KEY }) === key);
}

/** Evaluación de la propuesta con la bitácora nueva y, si la hay, la evidencia vigente al aplicar. */
function appliedEvaluation(
  current: unknown,
  entry: ReturnType<typeof trailEntry>,
  evidence: EvalEvidence | null,
): Prisma.InputJsonValue {
  const updated = updateEvaluation(current, { trail: [entry] }) as Record<string, unknown>;
  return (evidence ? { ...updated, ...evidence } : updated) as Prisma.InputJsonValue;
}

async function lockRouting(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`setting:${AI_ROUTING_KEY}`}, 0))`;
}

/**
 * Cierra (REJECTED, por SYSTEM, con `STALE_PROPOSAL_REASON`) las propuestas pendientes que ya no
 * cambiarían nada con la ruta `routing`. Dentro de la transacción y el candado de quien llama. El
 * `status` va en el filtro: una propuesta que otra operación ya cerró no se toca.
 */
async function closeStaleProposals(
  tx: Prisma.TransactionClient,
  routing: AIRouting,
  config: AIProviderConfig,
  now: Date,
): Promise<number> {
  const rows = await tx.platformDecision.findMany({
    where: PENDING_WHERE,
    orderBy: { createdAt: "desc" },
    take: PENDING_PROPOSALS_LIMIT,
    select: { id: true, previousValue: true, newValue: true, evaluation: true },
  });
  let closed = 0;
  for (const row of rows) {
    if (!proposalIsStale(row, routing, config)) continue;
    const result = await tx.platformDecision.updateMany({
      where: { id: row.id, ...PENDING_WHERE },
      data: {
        status: "REJECTED",
        reason: STALE_PROPOSAL_REASON,
        decidedAt: now,
        evaluation: updateEvaluation(row.evaluation, {
          trail: [trailEntry("rejected", "SYSTEM", now, { note: STALE_PROPOSAL_REASON })],
        }),
      },
    });
    closed += result.count;
  }
  return closed;
}

/**
 * Cierra las propuestas que ya no cambiarían nada con la ruta VIGENTE (p. ej. cambió el modelo
 * predeterminado de las variables de entorno). Idempotente; sin propuestas pendientes no abre
 * transacción. Lo llama /admin/ia al abrirse, después de comprobar que quien la ve es ADMIN.
 */
export async function closeStaleAiRoutingProposals(now = new Date()): Promise<number> {
  const pending = await db.platformDecision.count({ where: PENDING_WHERE });
  if (pending === 0) return 0;
  const config = aiProviderConfig(env);
  return db.$transaction(async (tx) => {
    await lockRouting(tx);
    return closeStaleProposals(tx, await currentRouting(tx), config, now);
  });
}

/**
 * Una persona ADMIN descarta una propuesta pendiente de `ai.routing` (vieja o que no quiere
 * aplicar): queda REJECTED con su motivo, quién la decidió y la bitácora. No cambia la ruta.
 */
export async function discardAiRoutingProposal(
  actorUserId: string,
  { decisionId, reason }: { decisionId: string; reason: string },
  now = new Date(),
): Promise<void> {
  await assertAdmin(actorUserId);
  await db.$transaction(async (tx) => {
    await lockRouting(tx);
    const row = await tx.platformDecision.findFirst({
      where: { id: decisionId, ...PENDING_WHERE },
      select: { evaluation: true },
    });
    const note = `Descartada en /admin/ia. ${reason}`;
    const result = row
      ? await tx.platformDecision.updateMany({
          where: { id: decisionId, ...PENDING_WHERE },
          data: {
            status: "REJECTED",
            reason,
            approvedById: actorUserId,
            decidedAt: now,
            evaluation: updateEvaluation(row.evaluation, {
              trail: [trailEntry("rejected", "HUMAN", now, { userId: actorUserId, note })],
            }),
          },
        })
      : { count: 0 };
    if (result.count === 0) {
      throw new RoutingChangeError("Esa propuesta ya no está pendiente: recarga la página.");
    }
  });
}

/**
 * Una persona ADMIN cambia el modelo de una tarea: se valida la lista blanca y la evaluación, se
 * guarda el ajuste (versión + 1, por HUMAN) y la decisión APPLIED con quién la aprobó. Si la IA ya
 * había propuesto exactamente ese cambio, la decisión aplicada ES esa propuesta (la más reciente;
 * conserva su hipótesis y su autoría) y las repetidas se cierran ligadas a ella: nunca queda una
 * propuesta pendiente de algo que ya se aplicó, ni dos decisiones del mismo cambio.
 */
export async function changeAiRouting(
  actorUserId: string,
  { task, route, reason }: { task: AITaskId; route: AIRoute | null; reason: string },
  now = new Date(),
): Promise<{ decisionId: string; closedProposals: number }> {
  await assertAdmin(actorUserId);
  const eligibility = await routeEligibility(task, route, now);
  if (!eligibility.ok) throw new RoutingChangeError(eligibility.reason);
  const config = aiProviderConfig(env);

  return db.$transaction(async (tx) => {
    await lockRouting(tx);
    const previous = await currentRouting(tx);
    const next = aiRoutingSchema.parse(withRoute(previous, task, route));
    if (sameRoute(previous.tasks[task], next.tasks[task])) {
      throw new RoutingChangeError("Esa tarea ya usa ese modelo.");
    }
    await tx.platformSetting.upsert({
      where: { key: AI_ROUTING_KEY },
      create: { key: AI_ROUTING_KEY, value: next, updatedBy: "HUMAN" },
      update: { value: next, version: { increment: 1 }, updatedBy: "HUMAN" },
    });
    const title = `Modelo de «${AI_TASK_INFO[task].label}»: ${route ? routeLabel(route) : "predeterminado"}`;
    const [proposal, ...repeated] = await pendingProposals(tx, previous, next);

    let decisionId: string;
    if (proposal) {
      // La propuesta de la IA queda aplicada por la persona (como al aprobar una propuesta).
      await tx.platformDecision.update({
        where: { id: proposal.id },
        data: {
          title,
          reason,
          previousValue: previous,
          newValue: next,
          status: "APPLIED",
          approvedById: actorUserId,
          decidedAt: now,
          appliedAt: now,
          evaluation: appliedEvaluation(
            proposal.evaluation,
            trailEntry("applied", "HUMAN", now, {
              userId: actorUserId,
              note: `Aplicada en /admin/ia. ${reason}`,
            }),
            eligibility.evidence,
          ),
        },
      });
      decisionId = proposal.id;
    } else {
      const decision = await tx.platformDecision.create({
        data: {
          actor: "HUMAN",
          kind: "ai.routing",
          title,
          hypothesis: reason,
          reason,
          settingKey: AI_ROUTING_KEY,
          previousValue: previous,
          newValue: next,
          riskLevel: AI_ROUTING_RISK,
          status: "APPLIED",
          approvedById: actorUserId,
          decidedAt: now,
          appliedAt: now,
          ...(eligibility.evidence ? { evaluation: eligibility.evidence } : {}),
        },
        select: { id: true },
      });
      decisionId = decision.id;
    }

    // Copias de la misma propuesta (de antes de que se evitaran): aplicadas por la decisión de
    // arriba y ligadas a ella. Sin `appliedAt`: el cambio se cuenta una sola vez. El título lo dice,
    // para que en /admin/ia (que solo muestra título y estado) no parezca aplicado varias veces.
    const linked = `Repetida: el mismo cambio se aplicó en /admin/ia con la decisión ${decisionId}.`;
    for (const row of repeated) {
      await tx.platformDecision.update({
        where: { id: row.id },
        data: {
          title: `${REPEATED_PREFIX}${row.title}`,
          status: "APPLIED",
          reason: linked,
          approvedById: actorUserId,
          decidedAt: now,
          evaluation: appliedEvaluation(
            row.evaluation,
            trailEntry("applied", "HUMAN", now, { userId: actorUserId, note: linked }),
            null,
          ),
        },
      });
    }
    // Con la ruta nueva, otras propuestas pueden haber quedado sin nada que aplicar.
    const stale = await closeStaleProposals(tx, next, config, now);
    return { decisionId, closedProposals: (proposal ? 1 : 0) + repeated.length + stale };
  });
}

/**
 * Para la IA CEO: PROPONE cambiar el modelo de una tarea, con una evaluación aprobada como
 * evidencia (`evalRunId`). Nunca aplica: queda PROPOSED y una persona la aplica en /admin/ia. La
 * hipótesis la escribe la IA y es un dato, no una instrucción. Si ya hay una propuesta pendiente de
 * exactamente ese cambio, no crea otra: devuelve esa (`created: false`).
 */
export async function proposeAiRoutingChange({
  task,
  route,
  evalRunId,
  hypothesis,
  expectedImpact,
  now = new Date(),
}: {
  task: AITaskId;
  route: AIRoute;
  evalRunId: string;
  hypothesis: string;
  expectedImpact?: string;
  now?: Date;
}): Promise<{ decisionId: string; created: boolean }> {
  if (!isRoutable(route)) throw new RoutingChangeError("Ese modelo no está en la lista permitida.");
  const evidence =
    route.provider === "mock" ? null : await approvedEvidence(task, route.model, now);
  if (route.provider !== "mock" && evidence?.evalRunId !== evalRunId) {
    throw new RoutingChangeError(
      "La propuesta necesita la evaluación aprobada más reciente de ese modelo en esa tarea.",
    );
  }
  return db.$transaction(async (tx) => {
    // El mismo candado que al aplicar: dos propuestas simultáneas no se duplican.
    await lockRouting(tx);
    const previous = await currentRouting(tx);
    const next = aiRoutingSchema.parse(withRoute(previous, task, route));
    // Tampoco se propone lo que ya se usa por las variables de entorno: nacería sin nada que aplicar.
    if (
      sameRoute(previous.tasks[task], next.tasks[task]) ||
      proposalIsStale({ previousValue: previous, newValue: next }, previous, aiProviderConfig(env))
    ) {
      throw new RoutingChangeError("Esa tarea ya usa ese modelo.");
    }
    const [existing] = await pendingProposals(tx, previous, next);
    if (existing) return { decisionId: existing.id, created: false };
    const decision = await tx.platformDecision.create({
      data: {
        actor: "AI",
        kind: "ai.routing",
        title: `Proponer modelo para «${AI_TASK_INFO[task].label}»: ${routeLabel(route)}`,
        hypothesis: hypothesis.slice(0, 1_000),
        expectedImpact: expectedImpact?.slice(0, 500),
        settingKey: AI_ROUTING_KEY,
        previousValue: previous,
        newValue: next,
        riskLevel: AI_ROUTING_RISK,
        status: "PROPOSED",
        ...(evidence ? { evaluation: evidence } : {}),
      },
      select: { id: true },
    });
    return { decisionId: decision.id, created: true };
  });
}
