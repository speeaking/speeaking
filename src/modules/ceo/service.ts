import "server-only";
import { assertAdmin } from "@/modules/admin/service";
import { applySettingChange, revertSettingChange, setAutonomyMode } from "@/modules/platform/apply";
import type { AutonomyMode } from "@/modules/platform/autonomy";
import { getTunable } from "@/modules/platform/tunables";
import { db } from "@/server/db";
import { MEDIUM_RISK_ALLOCATION } from "./autonomy-policy";
import { trailEntry, updateEvaluation } from "./decision-record";
import {
  launchExperimentFromDecision,
  startDraftExperiment,
  stopExperiment,
  stopStaleExperimentsOn,
} from "./experiments";
import { handledElsewhere } from "./handled-elsewhere";
import {
  type DecisionRiskFilter,
  type DecisionStatusFilter,
  getWeeklyReport,
  listDecisions,
  listExperiments,
} from "./queries";

/**
 * Servicio del área /admin del motor de automejora. Toda función recibe a quien actúa y llama
 * `assertAdmin` primero (la página o la acción ya lo verificaron; aquí se vuelve a leer el rol).
 * Cada acción humana queda con actor HUMAN, `approvedById` o la bitácora de la decisión.
 */

export type CeoActionResult = { ok: true; message: string } | { ok: false; error: string };

const NOT_FOUND = "No encontramos esa decisión.";

/**
 * La bitácora de moderación (`moderation.*`, `authenticity.*`, módulo trust) comparte la tabla
 * `PlatformDecision`, pero no es del motor: desde aquí no se aprueba, rechaza ni revierte (como si no
 * existiera), aunque alguien mande su id a mano.
 */
function isEngineKind(kind: string) {
  return !kind.startsWith("moderation.") && !kind.startsWith("authenticity.");
}

/**
 * Lo que se decide en otra pantalla (p. ej. `ai.routing` en /admin/ia, que exige la evaluación
 * aprobada del modelo) no se aprueba, rechaza ni revierte desde aquí.
 */
function elsewhereError(settingKey: string | null): CeoActionResult | null {
  const handled = handledElsewhere(settingKey);
  return handled ? { ok: false, error: `${handled.label}.` } : null;
}

export async function getDecisionQueue(
  actorUserId: string,
  filters: { status: DecisionStatusFilter; risk: DecisionRiskFilter | null },
) {
  await assertAdmin(actorUserId);
  return listDecisions(filters);
}

export async function getExperiments(actorUserId: string) {
  await assertAdmin(actorUserId);
  return listExperiments();
}

export async function getCeoWeeklyReport(actorUserId: string, now: Date = new Date()) {
  await assertAdmin(actorUserId);
  return getWeeklyReport(now);
}

function withNote(base: string, note: string | undefined) {
  return note ? `${base} Nota: ${note}` : base;
}

/**
 * Aprobar según el riesgo (del catálogo, nunca de la IA):
 * - BAJO: se aplica (`applySettingChange`, actor HUMAN).
 * - MEDIO: se lanza el experimento al 10 %; si ya viene de un experimento concluido, se adopta.
 * - ALTO o sin ajuste del catálogo: queda APROBADA y la ejecuta una persona («Solo propuesta»).
 */
export async function approveDecision(
  actorUserId: string,
  decisionId: string,
  note?: string,
): Promise<CeoActionResult> {
  await assertAdmin(actorUserId);
  const decision = await db.platformDecision.findUnique({
    where: { id: decisionId },
    select: {
      kind: true,
      status: true,
      riskLevel: true,
      settingKey: true,
      experimentId: true,
      evaluation: true,
    },
  });
  if (!decision || !isEngineKind(decision.kind)) return { ok: false, error: NOT_FOUND };
  const elsewhere = elsewhereError(decision.settingKey);
  if (elsewhere) return elsewhere;
  if (decision.status !== "PROPOSED") {
    return { ok: false, error: "Esta decisión ya no está pendiente." };
  }
  const now = new Date();
  const tunable = getTunable(decision.settingKey);

  if (!tunable || decision.riskLevel === "HIGH") {
    const updated = await db.platformDecision.updateMany({
      where: { id: decisionId, status: "PROPOSED" },
      data: {
        status: "APPROVED",
        decidedAt: now,
        approvedById: actorUserId,
        reason: withNote("Aprobada por el equipo; la ejecuta una persona.", note).slice(0, 900),
        evaluation: updateEvaluation(decision.evaluation, {
          trail: [trailEntry("approved", "HUMAN", now, { userId: actorUserId, note })],
        }),
      },
    });
    return updated.count === 1
      ? {
          ok: true,
          message: "Aprobada. Es solo propuesta: el sistema no cambia nada por su cuenta.",
        }
      : { ok: false, error: "Esta decisión ya no está pendiente." };
  }

  if (tunable.risk === "MEDIUM" && !decision.experimentId) {
    const result = await launchExperimentFromDecision(db, {
      decisionId,
      actor: "HUMAN",
      userId: actorUserId,
      allocation: MEDIUM_RISK_ALLOCATION,
      reason: withNote("Aprobada por el equipo para probarse con el 10 % de las personas.", note),
      now,
    });
    return result.ok
      ? { ok: true, message: "Experimento iniciado con el 10 % de las personas." }
      : { ok: false, error: result.message };
  }

  const reason = withNote(
    tunable.risk === "MEDIUM"
      ? "Adoptada por el equipo con la evidencia del experimento."
      : "Aprobada y aplicada por el equipo.",
    note,
  );
  const result = await applySettingChange(db, {
    decisionId,
    actor: "HUMAN",
    userId: actorUserId,
    reason,
    now,
    trail: (current) =>
      updateEvaluation(current, {
        trail: [trailEntry("applied", "HUMAN", now, { userId: actorUserId, note })],
      }),
  });
  return result.ok
    ? {
        ok: true,
        message:
          "Aplicada. Las salvaguardas la vigilan y la revierten sola si alguna se rompe tras la exposición mínima.",
      }
    : { ok: false, error: result.message };
}

export async function rejectDecision(
  actorUserId: string,
  decisionId: string,
  note?: string,
): Promise<CeoActionResult> {
  await assertAdmin(actorUserId);
  const decision = await db.platformDecision.findUnique({
    where: { id: decisionId },
    select: { kind: true, status: true, evaluation: true, settingKey: true },
  });
  if (!decision || !isEngineKind(decision.kind)) return { ok: false, error: NOT_FOUND };
  const elsewhere = elsewhereError(decision.settingKey);
  if (elsewhere) return elsewhere;
  const now = new Date();
  const updated = await db.platformDecision.updateMany({
    where: { id: decisionId, status: "PROPOSED" },
    data: {
      status: "REJECTED",
      decidedAt: now,
      approvedById: actorUserId,
      reason: withNote("Rechazada por el equipo.", note).slice(0, 900),
      evaluation: updateEvaluation(decision.evaluation, {
        trail: [trailEntry("rejected", "HUMAN", now, { userId: actorUserId, note })],
      }),
    },
  });
  return updated.count === 1
    ? { ok: true, message: "Rechazada." }
    : { ok: false, error: "Esta decisión ya no está pendiente." };
}

export async function revertDecision(
  actorUserId: string,
  decisionId: string,
  note?: string,
): Promise<CeoActionResult> {
  await assertAdmin(actorUserId);
  const decision = await db.platformDecision.findUnique({
    where: { id: decisionId },
    select: { kind: true, settingKey: true },
  });
  if (!decision || !isEngineKind(decision.kind)) return { ok: false, error: NOT_FOUND };
  const elsewhere = elsewhereError(decision.settingKey);
  if (elsewhere) return elsewhere;
  const now = new Date();
  const result = await revertSettingChange(db, {
    decisionId,
    actor: "HUMAN",
    userId: actorUserId,
    reason: withNote("Revertida por el equipo.", note),
    now,
    trail: (current) =>
      updateEvaluation(current, {
        trail: [trailEntry("reverted", "HUMAN", now, { userId: actorUserId, note })],
      }),
  });
  if (!result.ok) return { ok: false, error: result.message };
  const stopped = await stopStaleExperimentsOn(db, decision.settingKey, {
    actor: "HUMAN",
    userId: actorUserId,
    now,
  });
  return {
    ok: true,
    message:
      stopped > 0
        ? "Revertida: el ajuste volvió a su valor anterior y se detuvo el experimento que comparaba contra el valor revertido."
        : "Revertida: el ajuste volvió a su valor anterior.",
  };
}

export async function startExperimentAsAdmin(
  actorUserId: string,
  experimentId: string,
): Promise<CeoActionResult> {
  await assertAdmin(actorUserId);
  const result = await startDraftExperiment(db, { experimentId });
  return result.ok
    ? { ok: true, message: "Experimento iniciado." }
    : { ok: false, error: result.message };
}

export async function stopExperimentAsAdmin(
  actorUserId: string,
  experimentId: string,
  note?: string,
): Promise<CeoActionResult> {
  await assertAdmin(actorUserId);
  const result = await stopExperiment(db, {
    experimentId,
    actor: "HUMAN",
    userId: actorUserId,
    reason: withNote("Detenido por el equipo: todos vuelven al valor actual.", note),
  });
  return result.ok
    ? { ok: true, message: "Experimento detenido: todos ven el valor actual." }
    : { ok: false, error: result.message };
}

export async function changeAutonomyMode(
  actorUserId: string,
  mode: AutonomyMode,
): Promise<CeoActionResult> {
  await assertAdmin(actorUserId);
  const now = new Date();
  const result = await setAutonomyMode(db, {
    mode,
    userId: actorUserId,
    now,
    trail: (current) =>
      updateEvaluation(current, {
        trail: [trailEntry("applied", "HUMAN", now, { userId: actorUserId })],
      }),
  });
  if (!result.changed) return { ok: true, message: "El modo ya estaba así." };
  return {
    ok: true,
    message:
      mode === "low_risk"
        ? "Modo riesgo bajo activado: lo de riesgo bajo se aplica solo cuando hay tráfico suficiente."
        : "Modo observador activado: la IA solo propone.",
  };
}
