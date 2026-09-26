import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/generated/prisma/enums";
import { FEED_POLICY_KEY, type FeedPolicy } from "@/modules/feed/policy";
import { AUTONOMY_KEY, AUTONOMY_LABELS, type AutonomyMode, parseAutonomy } from "./autonomy";
import { type Client, inTransaction, lockName } from "./client";
import {
  checkBounds,
  checkChange,
  classifyRisk,
  formatTunableValue,
  getTunable,
  isForbiddenSetting,
  parseFeedPolicy,
  readTunable,
  type Tunable,
  withTunable,
} from "./tunables";

/**
 * El ÚNICO camino que cambia un ajuste del motor de automejora (H9, plan-90-dias.md §2.2): exige una
 * `PlatformDecision`, reclasifica el riesgo con el catálogo (nunca confía en lo guardado), valida
 * límites y paso máximo, exige que el valor actual siga siendo el de la propuesta, guarda la versión
 * nueva y deja la bitácora. `revertSettingChange` restaura el valor anterior con las mismas reglas.
 * Un candado por ajuste serializa los cambios concurrentes.
 */

export type ChangeErrorCode =
  | "NOT_FOUND"
  | "WRONG_STATUS"
  | "NOT_TUNABLE"
  | "FORBIDDEN"
  | "RISK_MISMATCH"
  | "NEEDS_HUMAN"
  | "NEEDS_EXPERIMENT"
  | "STALE"
  | "INVALID_CHANGE"
  | "CONFLICT"
  | "SUPERSEDED";

export type ChangeResult =
  { ok: true; version: number } | { ok: false; code: ChangeErrorCode; message: string };

type TrailFn = (evaluation: unknown) => Prisma.InputJsonValue;

export type ChangeRequest = {
  decisionId: string;
  actor: Actor;
  /** Persona del equipo (ADMIN) que actúa; vacío en lo automático. */
  userId?: string | null;
  /** true solo cuando el sistema aplica solo (riesgo BAJO tras el umbral). */
  auto?: boolean;
  reason: string;
  now?: Date;
  /** Agrega la entrada de bitácora a `evaluation` (lo arma el motor, `ceo/decision-record.ts`). */
  trail: TrailFn;
};

function fail(code: ChangeErrorCode, message: string): ChangeResult {
  return { ok: false, code, message };
}

/** Política del feed vigente y su versión (`null` si nunca se guardó: se usa la de por omisión). */
export async function readFeedPolicySetting(
  client: Client,
): Promise<{ policy: FeedPolicy; version: number | null }> {
  const row = await client.platformSetting.findUnique({
    where: { key: FEED_POLICY_KEY },
    select: { value: true, version: true },
  });
  return { policy: parseFeedPolicy(row?.value), version: row?.version ?? null };
}

async function writePolicy(
  tx: Prisma.TransactionClient,
  policy: FeedPolicy,
  actor: Actor,
): Promise<number> {
  const saved = await tx.platformSetting.upsert({
    where: { key: FEED_POLICY_KEY },
    create: { key: FEED_POLICY_KEY, value: policy, version: 1, updatedBy: actor },
    update: { value: policy, version: { increment: 1 }, updatedBy: actor },
    select: { version: true },
  });
  return saved.version;
}

async function runningExperimentOn(tx: Prisma.TransactionClient, tunable: Tunable) {
  return tx.experiment.findFirst({
    where: { status: "RUNNING", settingKey: { startsWith: `${tunable.setting}.` } },
    select: { key: true },
  });
}

/** Aplica una decisión PROPUESTA de un parámetro del catálogo. */
export async function applySettingChange(
  client: Client,
  request: ChangeRequest,
): Promise<ChangeResult> {
  const now = request.now ?? new Date();
  const decision = await client.platformDecision.findUnique({
    where: { id: request.decisionId },
    select: {
      id: true,
      status: true,
      settingKey: true,
      riskLevel: true,
      previousValue: true,
      newValue: true,
      evaluation: true,
      experiment: { select: { status: true, settingKey: true, variants: true } },
    },
  });
  if (!decision) return fail("NOT_FOUND", "No encontramos esa decisión.");
  if (decision.status !== "PROPOSED") {
    return fail("WRONG_STATUS", "Esta decisión ya no está pendiente.");
  }
  const settingKey = decision.settingKey;
  if (!settingKey || isForbiddenSetting(settingKey)) {
    return fail("FORBIDDEN", "Este cambio queda fuera del alcance del motor: lo hace una persona.");
  }
  const tunable = getTunable(settingKey);
  if (!tunable) return fail("NOT_TUNABLE", "Ese ajuste no se puede cambiar desde aquí.");
  const risk = classifyRisk(settingKey);
  if (risk !== decision.riskLevel) {
    return fail("RISK_MISMATCH", "El nivel de riesgo guardado no coincide con el del catálogo.");
  }
  if (request.auto && (risk !== "LOW" || request.actor !== "SYSTEM")) {
    return fail("NEEDS_HUMAN", "Solo lo de riesgo bajo se aplica sin una persona.");
  }
  if (risk === "MEDIUM") {
    if (request.actor !== "HUMAN") {
      return fail("NEEDS_HUMAN", "Adoptar un cambio de riesgo medio requiere tu aprobación.");
    }
    const experiment = decision.experiment;
    const treatment =
      experiment && typeof experiment.variants === "object" && experiment.variants !== null
        ? (experiment.variants as Record<string, unknown>).treatment
        : undefined;
    if (
      !experiment ||
      experiment.status !== "CONCLUDED" ||
      experiment.settingKey !== settingKey ||
      treatment !== decision.newValue
    ) {
      return fail(
        "NEEDS_EXPERIMENT",
        "Un cambio de riesgo medio se adopta solo con la evidencia de un experimento concluido.",
      );
    }
  }

  return inTransaction(client, async (tx) => {
    await lockName(tx, `platform.setting:${tunable.setting}`);
    const running = await runningExperimentOn(tx, tunable);
    if (running) {
      return fail(
        "CONFLICT",
        `Hay un experimento en curso sobre este ajuste (${running.key}); espera a que termine.`,
      );
    }
    const { policy } = await readFeedPolicySetting(tx);
    const current = readTunable(policy, tunable);
    if (decision.previousValue !== current) {
      return fail(
        "STALE",
        `El valor cambió desde la propuesta (ahora es ${formatTunableValue(tunable, current)}).`,
      );
    }
    const check = checkChange(tunable, current, decision.newValue);
    if (!check.ok) return fail("INVALID_CHANGE", check.reason);
    const next = withTunable(policy, tunable, decision.newValue as number);
    if (!next) return fail("INVALID_CHANGE", "La política resultante no es válida.");

    const updated = await tx.platformDecision.updateMany({
      where: { id: decision.id, status: "PROPOSED" },
      data: {
        status: "APPLIED",
        decidedAt: now,
        appliedAt: now,
        autoApplied: request.auto === true,
        approvedById: request.actor === "HUMAN" ? (request.userId ?? null) : null,
        reason: request.reason.slice(0, 900),
        evaluation: request.trail(decision.evaluation),
      },
    });
    if (updated.count !== 1) {
      return fail("WRONG_STATUS", "Esta decisión ya no está pendiente.");
    }
    const version = await writePolicy(tx, next, request.actor);
    return { ok: true, version } satisfies ChangeResult;
  });
}

/** Revierte una decisión APLICADA: restaura el valor anterior si nadie lo cambió después. */
export async function revertSettingChange(
  client: Client,
  request: ChangeRequest,
): Promise<ChangeResult> {
  const now = request.now ?? new Date();
  const decision = await client.platformDecision.findUnique({
    where: { id: request.decisionId },
    select: {
      id: true,
      status: true,
      settingKey: true,
      previousValue: true,
      newValue: true,
      evaluation: true,
    },
  });
  if (!decision) return fail("NOT_FOUND", "No encontramos esa decisión.");
  if (decision.status !== "APPLIED") {
    return fail("WRONG_STATUS", "Solo se revierte una decisión aplicada.");
  }
  const tunable = getTunable(decision.settingKey);
  if (!tunable || isForbiddenSetting(decision.settingKey ?? "")) {
    return fail("NOT_TUNABLE", "Este cambio no se revierte desde aquí.");
  }
  const bounds = checkBounds(tunable, decision.previousValue);
  if (!bounds.ok) return fail("INVALID_CHANGE", bounds.reason);

  return inTransaction(client, async (tx) => {
    await lockName(tx, `platform.setting:${tunable.setting}`);
    const { policy } = await readFeedPolicySetting(tx);
    const current = readTunable(policy, tunable);
    if (current !== decision.newValue) {
      return fail(
        "SUPERSEDED",
        `El ajuste ya cambió después (ahora es ${formatTunableValue(tunable, current)}); revisa la decisión más reciente.`,
      );
    }
    const next = withTunable(policy, tunable, decision.previousValue as number);
    if (!next) return fail("INVALID_CHANGE", "La política resultante no es válida.");
    const updated = await tx.platformDecision.updateMany({
      where: { id: decision.id, status: "APPLIED" },
      data: {
        status: "REVERTED",
        revertedAt: now,
        reason: request.reason.slice(0, 900),
        evaluation: request.trail(decision.evaluation),
      },
    });
    if (updated.count !== 1) {
      return fail("WRONG_STATUS", "Solo se revierte una decisión aplicada.");
    }
    const version = await writePolicy(tx, next, request.actor);
    return { ok: true, version } satisfies ChangeResult;
  });
}

/** Modo de autonomía vigente. */
export async function readAutonomy(client: Client): Promise<AutonomyMode> {
  const row = await client.platformSetting.findUnique({
    where: { key: AUTONOMY_KEY },
    select: { value: true },
  });
  return parseAutonomy(row?.value).mode;
}

/**
 * Cambia el modo de autonomía. Solo una persona del equipo (lo verifica el servicio con
 * `assertAdmin`); queda en la bitácora como decisión de riesgo ALTO aplicada por HUMAN.
 */
export async function setAutonomyMode(
  client: Client,
  input: { mode: AutonomyMode; userId: string; now?: Date; trail: TrailFn },
): Promise<{ changed: boolean; mode: AutonomyMode }> {
  const now = input.now ?? new Date();
  return inTransaction(client, async (tx) => {
    await lockName(tx, `platform.setting:${AUTONOMY_KEY}`);
    const previous = await readAutonomy(tx);
    if (previous === input.mode) return { changed: false, mode: previous };
    await tx.platformSetting.upsert({
      where: { key: AUTONOMY_KEY },
      create: { key: AUTONOMY_KEY, value: { version: 1, mode: input.mode }, updatedBy: "HUMAN" },
      update: {
        value: { version: 1, mode: input.mode },
        version: { increment: 1 },
        updatedBy: "HUMAN",
      },
    });
    await tx.platformDecision.create({
      data: {
        actor: "HUMAN",
        kind: "autonomy.mode",
        title: `Modo de autonomía: ${AUTONOMY_LABELS[previous]} → ${AUTONOMY_LABELS[input.mode]}`,
        hypothesis:
          input.mode === "low_risk"
            ? "El equipo permite que lo de riesgo bajo se aplique solo y lo de riesgo medio se pruebe al 10 %, siempre con el umbral de tráfico y las salvaguardas."
            : "El equipo regresa al modo observador: la IA solo propone.",
        settingKey: AUTONOMY_KEY,
        previousValue: previous,
        newValue: input.mode,
        riskLevel: "HIGH",
        status: "APPLIED",
        approvedById: input.userId,
        decidedAt: now,
        appliedAt: now,
        reason: "Cambio hecho por el equipo desde /admin/resumen.",
        evaluation: input.trail(null),
      },
    });
    return { changed: true, mode: input.mode };
  });
}
